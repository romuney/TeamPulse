# Папка «Поставка — TeamPulse Hub (по частям)»: датасеты частей, CSS борда и JSON областей кросс-фильтров.
#
#   python3 stand/mk_split.py                          # номера чартов — как уже в папке (сначала — заглушки 900000…900004)
#   python3 stand/mk_split.py --ids main=814900,core=814901,people=814902,flow=814903,aux=814904
#   python3 stand/mk_split.py --check                  # файлы в папке совпадают с тем, что собрал бы скрипт
#
# Источник один — датасет обычной поставки (файл 2): часть задаёт строка {% set PART = '…' %}, остальной текст тот же
# (гайд MC-22: общие куски чартов борда — дословно одинаковые). Поменяли файл 2 — перезапустить этот скрипт.
# Код чартов (файлы 3 и 3а) пишет proteus/build.js. Ноутбук и таблицы — те же, что у обычной поставки.
# Проверки: stand/split_check.py (сумма частей = целому ответу), stand/serve_split.py + stand/split_board.cjs (браузер).
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ONE = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub')
OUT = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub (по частям)')
SRC = os.path.join(ONE, '2. Proteus — датасет TeamPulse Hub.sql')
CSS = os.path.join(ONE, '4. CSS борда (дописать в конец).css')
SET_ALL = "{% set PART = 'all' %}"
ONE_ID = '814002'                                    # id чарта в CSS обычной поставки
PARTS = [('dict', '2.0. Proteus — датасет dict (главный чарт).sql', 'главный чарт: справочник узлов, от фильтров не зависит'),
         ('core', '2.1. Proteus — датасет core (загрузчик 1).sql', 'загрузчик 1: meta, ряды узлов ответа, строка HQ — первый экран'),
         ('people', '2.2. Proteus — датасет people (загрузчик 2).sql', 'загрузчик 2: разрезы людей и профили'),
         ('flow', '2.3. Proteus — датасет flow (загрузчик 3).sql', 'загрузчик 3: разрезы переводов, водопада и вакансий'),
         ('aux', '2.4. Proteus — датасет aux (загрузчик 4).sql', 'загрузчик 4: AI-инструменты и база похожих подразделений')]
IDS = {'main': '900000', 'core': '900001', 'people': '900002', 'flow': '900003', 'aux': '900004'}    # заглушки
LOADERS = ['core', 'people', 'flow', 'aux']


def datasets():
    s = open(SRC, encoding='utf-8').read()
    assert s.count(SET_ALL) == 1, 'в файле 2 нет строки PART'
    # длинная шапка-описание ответа остаётся в файле 2 обычной поставки; у части — короткая
    end = '============================================================================ -#}\n'
    assert s.startswith('{#- ====') and s.count(end) == 1, 'шапка файла 2 не найдена'
    body = s[s.index(end) + len(end):]
    out = {}
    for p, name, what in PARTS:
        head = ("{#- TeamPulse Hub, дашборд «по частям». ЧАСТЬ " + p + " — " + what + ".\n"
                "    Собрано stand/mk_split.py из датасета обычной поставки (файл 2): тот же текст, отличается одна строка —\n"
                "    {% set PART = '" + p + "' %}. Руками не править: правка — в файле 2, затем скрипт. Описание строк и колонок ответа —\n"
                "    в шапке файла 2. Колонки: role, id, pid, lvl, nm, kids, j, ms, mx. Первая строка части — role = 'part'. -#}\n")
        out[name] = head + body.replace(SET_ALL, "{% set PART = '" + p + "' %}")
    return out


def board_css(ids):
    s = open(CSS, encoding='utf-8').read()
    assert ONE_ID in s
    s = s.replace(ONE_ID, ids['main'])
    ld = [ids[k] for k in LOADERS]
    cls = ', '.join('.dashboard-chart-id-' + i for i in ld)
    has = ', '.join('#chart-id-' + i for i in ld)
    end = '/* ==== TeamPulse Hub — CSS борда · КОНЕЦ блока отчёта'
    assert s.count(end) == 1
    block = """/* ==== 8. Чарты-загрузчики (дашборд «по частям») ====================================================================
   Четыре чарта-загрузчика (core """ + ids['core'] + """, people """ + ids['people'] + """, flow """ + ids['flow'] + """, aux """ + ids['aux'] + """) только возят данные главному чарту (""" + ids['main'] + """).
   На экране их нет, но они остаются в окне и не нулевого размера: 1×1 px, прозрачные, клики сквозь них. Так Proteus
   их загружает и перезапрашивает как обычные чарты. display: none НЕ ставить: скрытый так чарт форк может не загрузить.
   Ряд с загрузчиками места не занимает. Ставить этот ряд ПЕРВЫМ на вкладке, выше ряда отчёта.
   В режиме правки дашборда загрузчики видны как обычные чарты — их можно двигать и настраивать. */
.resizable-container:not(.dashboard--editing *):has(> .dashboard-component-chart-holder:is(""" + cls + """)),
.dashboard-component-chart-holder:not(.dashboard--editing *):is(""" + cls + """, :has(""" + has + """)) {
  width: 1px !important; min-width: 0 !important; max-width: 1px !important;
  height: 1px !important; min-height: 0 !important; max-height: 1px !important;
  flex: none !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important;
  opacity: 0 !important; pointer-events: none !important; border: 0 !important; box-shadow: none !important;
}
/* ряд, где стоят только загрузчики: без высоты, зазоров и отступа до следующего ряда */
.dragdroppable-row:not(.dashboard--editing *):has(""" + cls + """):not(:has(.dashboard-chart-id-""" + ids['main'] + """)),
.dragdroppable-row:not(.dashboard--editing *):has(""" + cls + """):not(:has(.dashboard-chart-id-""" + ids['main'] + """)) .grid-row {
  height: 1px !important; min-height: 0 !important; margin: 0 0 -1px 0 !important; padding: 0 !important;
  gap: 0 !important; overflow: hidden !important; opacity: 0 !important; pointer-events: none !important;
}

"""
    s = s.replace(end, block + end)
    note = """/* ==== ДАШБОРД «ПО ЧАСТЯМ»: номера чартов ============================================================================
   Собрано stand/mk_split.py из CSS обычной поставки (файл 4) + блок 8 (чарты-загрузчики).
   Номера чартов в этом файле: главный """ + ids['main'] + """, загрузчики core """ + ids['core'] + """, people """ + ids['people'] + \
        """, flow """ + ids['flow'] + """, aux """ + ids['aux'] + """.
   Если это заглушки (900000 … 900004) — замените каждую на id своего чарта во ВСЕХ местах (Ctrl+H) или
   пришлите номера: скрипт подставит сам. Id чарта — число после slice_id= в адресе «Редактировать график».
   ================================================================================================================== */
"""
    return note + s


def board_json(ids):
    n = {k: int(v) for k, v in ids.items()}
    ld = [n[k] for k in LOADERS]
    cfg = {str(n['main']): {'id': n['main'], 'crossFilters': {'scope': {'rootPath': ['ROOT_ID'], 'excluded': [n['main']]},
                                                               'chartsInScope': ld}}}
    for i in ld:
        cfg[str(i)] = {'id': i, 'crossFilters': {'scope': {'rootPath': ['ROOT_ID'], 'excluded': [n['main']] + ld}, 'chartsInScope': []}}
    return json.dumps({'cross_filters_enabled': True, 'chart_configuration': cfg}, ensure_ascii=False, indent=2) + '\n'


def files(ids):
    out = datasets()
    out['4. CSS борда (дописать в конец).css'] = board_css(ids)
    out['5. JSON дашборда — области кросс-фильтров.json'] = board_json(ids)
    return out


def main():
    ids = dict(IDS)
    a = sys.argv[1:]
    if '--ids' in a:
        for kv in a[a.index('--ids') + 1].split(','):
            k, v = kv.split('=')
            assert k in ids and re.fullmatch(r'\d+', v), 'номера: main=…,core=…,people=…,flow=…,aux=…'
            ids[k] = v
        assert len(set(ids.values())) == 5, 'номера чартов должны быть разными'
    elif os.path.exists(os.path.join(OUT, '5. JSON дашборда — области кросс-фильтров.json')):
        # без --ids — номера, уже проставленные в папке (чтобы пересборка их не сбрасывала)
        j = json.load(open(os.path.join(OUT, '5. JSON дашборда — области кросс-фильтров.json'), encoding='utf-8'))
        cc = j['chart_configuration']
        main_id = next(k for k, v in cc.items() if v['crossFilters']['chartsInScope'])
        ids = dict(zip(['main'] + LOADERS, [main_id] + [str(x) for x in cc[main_id]['crossFilters']['chartsInScope']]))
    fs = files(ids)
    if '--check' in a:
        bad = [n for n, t in fs.items() if not os.path.exists(os.path.join(OUT, n)) or open(os.path.join(OUT, n), encoding='utf-8').read() != t]
        print('папка «по частям»:', 'файлы совпадают со сборкой' if not bad else 'УСТАРЕЛИ: ' + ', '.join(bad))
        sys.exit(1 if bad else 0)
    os.makedirs(OUT, exist_ok=True)
    for n, t in fs.items():
        open(os.path.join(OUT, n), 'w', encoding='utf-8').write(t)
    print('папка «по частям»: %d файлов; номера чартов — %s' % (len(fs), ', '.join('%s %s' % (k, ids[k]) for k in ['main'] + LOADERS)))


if __name__ == '__main__':
    main()
