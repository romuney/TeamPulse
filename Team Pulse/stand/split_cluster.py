# Поставка «по частям» на кластерном ClickHouse 25.8 (CHaaS: 6 шардов × 2 реплики, Distributed, distributed_product_mode = global).
#
#   python3 stand/split_cluster.py            # переписать пять датасетов папки «по частям» (повторный запуск ничего не меняет)
#   python3 stand/split_cluster.py --check    # файлы уже переписаны и совпадают с тем, что дал бы скрипт
#
# Что падало. На кластере сервер сам превращает «x IN (SELECT …)» по распределённой таблице в GLOBAL IN — по разу на каждую
# распределённую таблицу в подзапросе. Если в одном IN-подзапросе их две на одном уровне (UNION ALL, в т. ч. через CTE),
# вторая перезапись падает: «Invalid local IN function name globalIn» (src/Storages/buildQueryTreeForShard.cpp). На стенде
# (модель кластера 6 шардов) так падали все 5 частей во всех состояниях фильтров.
#
# Правки (логика расчёта та же):
#   1. IN-подзапрос с таблицами → множество одним скалярным подзапросом:
#        x IN (SELECT c FROM …)  →  x IN (SELECT arrayJoin((SELECT groupArray(__x) FROM (SELECT c AS __x FROM …))))
#      Скаляр считается один раз на инициаторе и уезжает на шарды значением; IN-подзапрос без таблиц сервер не трогает.
#      PK / PKD — развёртка массива уже посчитанной строки (без FROM) — не трогаются.
#   2. Округление при выводе: round(x, d) → round(round(x, 6), d). На кластере частичные суммы с шардов складываются в разном
#      порядке, и сумма дробных чисел отличается в 15-м знаке; на значениях «ровно посередине» (…,x5) десятая «скакала» от
#      запуска к запуску. round(…, 6) снимает шум (он ниже 6-го знака); правило округления прежнее (по двоичному значению).
#      Стенд: ответ стабилен на кластере; от прежнего SQL на одной машине отличаются 23 числа во всём ответе core, ±0,1 —
#      там, где шум прежней суммы сам переходил границу округления; остальные числа — те же.
#
# Почему не через stand/mk_split.py: части собираются из файла 2 единой поставки, а в нём уже годовое ревью — по решению
# владельца оно остаётся только в единой. Поэтому правка накладывается на текущий текст частей; mk_split.py после сборки
# применяет её же (cluster_text), так что повторная сборка правку не потеряет.
# Проверка: stand/split_cluster_check.py (модель кластера: ответ равен ответу прежнего SQL на одной машине).
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub (по частям)')
FILES = ['2.0. Proteus — датасет dict (главный чарт).sql', '2.1. Proteus — датасет core (загрузчик 1).sql',
         '2.2. Proteus — датасет people (загрузчик 2).sql', '2.3. Proteus — датасет flow (загрузчик 3).sql',
         '2.4. Proteus — датасет aux (загрузчик 4).sql']


def match_paren(s, i):
    d = 0; q = None; j = i
    while j < len(s):
        ch = s[j]
        if q:
            if ch == q:
                if j + 1 < len(s) and s[j + 1] == q:
                    j += 2; continue
                q = None
        elif ch in "'`":
            q = ch
        elif ch == '(':
            d += 1
        elif ch == ')':
            d -= 1
            if d == 0:
                return j
        j += 1
    raise ValueError('скобки не сходятся')


def split_top(s, sep_re):
    d = 0; q = None; out = []
    for m in re.finditer(r"[()'`]|" + sep_re, s, re.I):
        t = m.group(0)
        if q:
            if t == q: q = None
            continue
        if t in "'`": q = t
        elif t == '(': d += 1
        elif t == ')': d -= 1
        elif d == 0: out.append(m)
    return out


def strip_alias(c):
    return re.sub(r'\s+AS\s+[A-Za-z_][A-Za-z0-9_]*\s*$', '', c.strip(), flags=re.I)


def rewrite_in(sql):
    n = 0; pos = 0
    pat = re.compile(r'(?<![A-Za-z_])((?:NOT\s+)?IN)\s*\(\s*SELECT\b', re.I)
    while True:
        m = pat.search(sql, pos)
        if not m:
            break
        op = sql.index('(', m.start(1)); cl = match_paren(sql, op)
        body = sql[op + 1:cl].strip()[len('SELECT'):]
        froms = split_top(body, r'\bFROM\b')
        if not froms or body.lstrip().startswith('arrayJoin((SELECT groupArray'):
            pos = cl; continue
        cols = body[:froms[0].start()]; rest = body[froms[0].start():]
        seps = split_top(cols, ',')
        parts = [strip_alias(cols[a:b]) for a, b in zip([0] + [x.end() for x in seps], [x.start() for x in seps] + [len(cols)])]
        tup = parts[0] if len(parts) == 1 else 'tuple(' + ', '.join(parts) + ')'
        new = '(SELECT arrayJoin((SELECT groupArray(__x) FROM (SELECT ' + tup + ' AS __x ' + rest + '))))'
        sql = sql[:op] + new + sql[cl + 1:]
        n += 1; pos = op + len('(SELECT arrayJoin((SELECT groupArray(__x) FROM (SELECT ')
    return sql, n


# Jinja-переменные с IN-подзапросом по таблицам (одна колонка). PK / PKD — без таблиц, не трогаем.
JINJA_SETS = {'UX': 2}


def rewrite_jinja(sql):
    n = 0
    for name, cnt in JINJA_SETS.items():
        pat = re.compile(r'(?<![A-Za-z_])((?:NOT\s+)?IN) \{\{ ' + name + r' \}\}')
        sql, k = pat.subn(lambda m: m.group(1) + ' (SELECT arrayJoin((SELECT groupArray(*) FROM {{ ' + name + ' }})))', sql)
        if k != cnt:
            raise ValueError(f'IN {{{{ {name} }}}}: ожидалось {cnt}, найдено {k} — пересмотреть JINJA_SETS')
        n += k
    return sql, n


def rewrite_round(sql):
    """toString(round(x, d)) / toString(round(x)) → с round(…, 6) внутри; уже переписанные не трогаются"""
    n = 0; pos = 0
    while True:
        i = sql.find('toString(round(', pos)
        if i < 0:
            break
        op = i + len('toString(round'); cl = match_paren(sql, op)
        args = sql[op + 1:cl]
        seps = split_top(args, ',')
        x = args if not seps else args[:seps[0].start()]
        d = '' if not seps else args[seps[0].end():]
        if x.strip().startswith('round(') and x.strip().endswith(', 6)'):
            pos = cl; continue
        x = x.strip()
        new = '(round(' + x + ', 6)' + (', ' + d.strip() if seps else '') + ')'
        sql = sql[:op] + new + sql[cl + 1:]
        n += 1; pos = op + len(new)
    return sql, n


def cluster_text(text):
    """весь набор правок; повторное применение ничего не меняет"""
    head_end = text.index('-#}\n') + 4          # шапка части — без изменений
    body = text[head_end:]
    body, a = rewrite_jinja(body) if '{{ UX }})))' not in body else (body, 0)
    body, b = rewrite_in(body)
    body, c = rewrite_round(body)
    return text[:head_end] + body, (a, b, c)


def main():
    check = '--check' in sys.argv
    bad = 0
    for f in FILES:
        p = os.path.join(OUT, f)
        old = open(p, encoding='utf-8').read()
        new, cnt = cluster_text(old)
        if check:
            if new != old:
                bad += 1; print('НЕ ПЕРЕПИСАН:', f)
        elif new != old:
            open(p, 'w', encoding='utf-8').write(new)
            print('переписан', f, '— UX, IN-подзапросов, округлений:', cnt)
        else:
            print('без изменений', f)
    if check:
        print('OK: все пять частей переписаны' if not bad else f'FAIL: {bad}')
        sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
