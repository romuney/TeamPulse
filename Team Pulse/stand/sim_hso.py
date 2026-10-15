# Симулятор prod_proteus.hr_structure_overall по людям — схема разведки 15.10.2026
# (describe физического датасета 175625, 46 колонок).
#
# Что изменилось против разведки 12.10 (и против прежнего симулятора):
#   - дерево денормализовано: пути юнита — имена уровней lvl1_nm … lvl11_nm и глубина
#     leaf_lvl; пары parent / lvl больше нет. Имена повторяются в разных ветках
#     («Команда 1» есть в нескольких отделах) — родителя датасет ищет по полному пути;
#   - численность: hc_total_cnt, hc_active_cnt, lag_hc_active_cnt, ssch_hc_active_cnt
#     (ССЧ — по активной: (активная + лаг) / 2, лаг NULL → активная);
#   - покраски и IT-специализации нет; тип численности — только внутри симуляции;
#   - атрибуты человека: gender, type_age, experience_group_nm, grade, seniority,
#     employee_contract_type, legal_organization, employee_stream, employment_relation_type;
#   - атрибуты увольнения: fire_reason_group, fire_initiative — только у строк увольнения;
#   - период — 34 точки: 2024-01 … 2026-10 (последний неполный).
# Как и раньше, ЮНИТ ВКЛЮЧАЕТ ВСЁ СВОЁ ПОДДЕРЕВО: строка = месяц × юнит × путь × атрибуты.
#   переводы считаются на границе юнита: уход из A в B — transfer_out у предков A,
#   которые не предки B, transfer_in — наоборот (общий предок перевода не видит).
# Юнит с двумя родителями (последние три месяца) едет двумя путями — копии строк.
# Значения атрибутов — правдоподобная выдумка: настоящие покажет запрос 0д.
# Пишет hso.csv (строки таблицы) и truth.json (правда по людям для сверок).
import calendar, csv, hashlib, json, random, sys
from collections import defaultdict

random.seed(7)
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
MONTHS = [f'{2024 + (i // 12)}-{i % 12 + 1:02d}-01' for i in range(34)]   # 2024-01 … 2026-10

# ---- дерево --------------------------------------------------------------
units = {}            # rk -> dict(nm, lvl, parent)
def add(rk, nm, lvl, parent):
    units[rk] = dict(nm=nm, lvl=lvl, parent=parent)
add('R', 'Группа', 1, None)
add('C', 'Компания', 2, 'R')
for b in range(4):
    bk = f'B{b}'; add(bk, f'Блок {b}', 3, 'C')
    for d in range(3):
        dk = f'{bk}D{d}'; add(dk, f'Деп {b}.{d}', 4, bk)
        for o in range(random.choice([0, 1, 2, 3])):
            ok = f'{dk}O{o}'; add(ok, f'Отдел {b}.{d}.{o}', 5, dk)
            for t in range(random.choice([0, 0, 1, 2])):
                # имя команды повторяется в разных отделах — как в проде (имена не уникальны)
                add(f'{ok}T{t}', f'Команда {t + 1}', 6, ok)
REORG_M = 21            # 2025-10: деп B1D2 переезжает под B2
NEW_M, NEW_UNIT = 25, 'B0D0O9'
add(NEW_UNIT, 'Отдел новый', 5, 'B0D0')
children = defaultdict(list)
for rk, u in units.items():
    if u['parent']:
        children[u['parent']].append(rk)
leaves = [rk for rk in units if not children[rk] and rk != NEW_UNIT]
inner = [rk for rk in units if children[rk] and units[rk]['lvl'] >= 3]
CLOSE_UNIT = next(rk for rk in leaves if units[rk]['lvl'] == 6)

def parent_of(rk, m):
    if rk == 'B1D2' and m >= REORG_M:
        return 'B2'
    return units[rk]['parent']
def alive(rk, m):
    if rk == NEW_UNIT:
        return m >= NEW_M
    if rk == CLOSE_UNIT:
        return m < NEW_M
    return True
def ancestors(rk, m):          # сам юнит и все предки
    out = []
    while rk:
        out.append(rk); rk = parent_of(rk, m)
    return out
def depth_of(rk, m):
    return len(ancestors(rk, m))
def name_path(rk, m, via=None):
    """имена от корня до юнита; via — другой родитель (юнит с двумя родителями)"""
    if via:
        return name_path(via, m) + [units[rk]['nm']]
    return [units[a]['nm'] for a in reversed(ancestors(rk, m))]
MULTI = next(rk for rk in units if units[rk]['lvl'] == 5 and rk != NEW_UNIT)
MULTI_P2 = 'B3D0'
def paths_for_rows(rk, m):
    p = [name_path(rk, m)]
    if rk == MULTI and m >= len(MONTHS) - 3:
        p.append(name_path(rk, m, via=MULTI_P2))
    return p

# ---- люди ----------------------------------------------------------------
TYPES = [('Активная', .78), ('Декрет', .05), ('Подрядчики', .05), ('Стажеры', .04),
         ('Кандидаты в учебных юнитах', .04), ('Разовые услуги', .02), ('Прогульщики', .02)]
OPER = [('Line', .65), ('Hq', .20), ('Support', .15)]           # только внутри симуляции
REL = [('Штатный сотрудник', .58), ('ГПД ФЛ', .25), ('ГПД ФЛ СМЗ', .06), ('Сотрудник партнерской организации', .03),
       ('Аутсорс', .02), ('ГПД ИП', .015), ('Сотрудник иностранной организации', .01), ('Стажер', .02),
       ('Совместитель', .01), ('Надомник', .005)]                  # 10 значений, как в разведке
GENDER = [('Мужской', .52), ('Женский', .48)]
AGE = [('До 25 лет', .18), ('25-34 лет', .42), ('35-44 лет', .27), ('45 лет и старше', .13)]
SEN = [('Junior', .30), ('Middle', .38), ('Senior', .24), ('Lead', .08)]
GRADE_OF = {'Junior': ['10', '11'], 'Middle': ['11', '12'], 'Senior': ['12', '13'], 'Lead': ['13', '14']}
CONTRACT = [('Бессрочный', .86), ('Срочный', .14)]
LEGAL = ['АО «Банк»', 'ООО «Технологии»', 'ООО «Сервис»']
# 16.10: на верхних уровнях юрлиц и стримов — десятки, отчёт берёт топ. Длинный хвост:
# 21 мелкое юрлицо (у 25% людей) и 14 стримов с убывающими долями.
LEGAL_TAIL = [('ООО «Регион-%02d»' % i, 1 / (i + 1)) for i in range(1, 22)]
STREAM = [('Разработка', .20), ('Аналитика', .11), ('Тестирование', .07), ('Продажи', .22),
          ('Клиентский сервис', .20), ('Бэк-офис', .08), ('Маркетинг', .03), ('Риски', .025),
          ('Юристы', .015), ('Закупки', .012), ('Безопасность', .01), ('HR', .01), ('Финансы', .008),
          ('Дизайн', .006)]
REASONS = [('Лучшее предложение', .26, True), ('Нет роста', .14, True), ('Отношения с руководителем', .10, True),
           ('Выгорание', .08, True), ('Не справился', .12, False), ('Личные обстоятельства', .18, False),
           ('Окончание договора', .12, False)]
INIT_OF = {'Не справился': 'Работодатель', 'Окончание договора': 'Соглашение сторон'}

def pick(opts):
    r, acc = random.random() * sum(o[1] for o in opts), 0
    for o in opts:
        acc += o[1]
        if r <= acc:
            return o[0]
    return opts[-1][0]
UNIT_LEGAL = {rk: LEGAL[int(hashlib.md5(rk.encode()).hexdigest(), 16) % 3] for rk in units}   # основное юрлицо подразделения
def new_person(unit, mi):
    sen = pick(SEN)
    return dict(unit=unit, type=pick(TYPES), oper=pick(OPER), rel=pick(REL), gender=pick(GENDER), age=pick(AGE),
                sen=sen, grade=random.choice(GRADE_OF[sen]), contract=pick(CONTRACT), stream=pick(STREAM),
                legal=pick(LEGAL_TAIL) if random.random() < .25 else None,
                hired=mi - random.randint(0, 80) if mi == 0 else mi,
                perf=pick([('normal', .7), ('low', .05), ('high', .15), ('gray', .10)]), app=None)
def tenure(p, mi):
    m = mi - p['hired']
    return 'До 1 года' if m < 12 else '1-3 года' if m < 36 else '3-5 лет' if m < 60 else 'Более 5 лет'
def workdays(mi):
    y, m = map(int, MONTHS[mi].split('-')[:2])
    return sum(1 for d in range(1, calendar.monthrange(y, m)[1] + 1) if calendar.weekday(y, m, d) < 5)
OFFICE = {'Hq': .55, 'Support': .35, 'Line': .15}
def place(m):
    live_leaves = [u for u in leaves if alive(u, m)]
    return random.choice(live_leaves) if random.random() < .85 else random.choice(inner)
people = [new_person(place(0), 0) for _ in range(2500)]

def key_attrs(p, mi, reason=None, init=None):
    return (p['gender'], p['age'], tenure(p, mi), p['grade'], p['sen'], p['contract'], p.get('legal') or UNIT_LEGAL[p['unit']],
            p['stream'], p['rel'], reason, init)
def perf_of(p):
    return p['perf'] if (p['type'] == 'Активная' and p['oper'] == 'Hq') else 'gray'

M = ['emp', 'act', 'hire', 'fire', 'regret', 'tin', 'tout', 'tcand', 'tint', 'pn', 'pl', 'ph', 'pg',
     'wd', 'ov', 'ga', 'gd', 'gc', 'gi']
agg = {}                                   # (mi, unit, attrs) -> measures
truth = {'months': MONTHS, 'company': [], 'multi': MULTI, 'reorg': 'B1D2'}
OUTCOME = [('ga', .6), ('gd', .3), ('gc', .1)]
def bump(mi, unit, attrs, k, v=1):
    d = agg.setdefault((mi, unit, attrs), dict.fromkeys(M, 0))
    d[k] += v

for mi in range(len(MONTHS)):
    hires = fires = regrets = 0
    if not alive(CLOSE_UNIT, mi):          # закрытый юнит: люди переходят к родителю
        for p in people:
            if p['unit'] == CLOSE_UNIT:
                old = p['unit']; p['unit'] = parent_of(old, mi)
                a_old, a_new = set(ancestors(old, mi - 1)), set(ancestors(p['unit'], mi))
                for u in a_old - a_new: bump(mi, u, key_attrs(p, mi), 'tout')
                for u in a_new - a_old: bump(mi, u, key_attrs(p, mi), 'tin')
    nxt = []
    for p in people:
        r = random.random()
        rate = .015 if p['type'] == 'Активная' else .05
        if mi > 0 and r < rate:                                  # увольнение
            reason = pick(REASONS)
            init = INIT_OF.get(reason, 'Работник')
            regret = p['type'] == 'Активная' and dict((x[0], x[2]) for x in REASONS)[reason] and random.random() < .5
            for u in ancestors(p['unit'], mi):
                bump(mi, u, key_attrs(p, mi, reason, init), 'fire')
                if regret: bump(mi, u, key_attrs(p, mi, reason, init), 'regret')
            fires += 1; regrets += regret
            continue
        if mi > 0 and r < rate + .02:                            # перевод в другой юнит
            old = p['unit']; p['unit'] = place(mi)
            a_old, a_new = set(ancestors(old, mi)), set(ancestors(p['unit'], mi))
            for u in a_old - a_new: bump(mi, u, key_attrs(p, mi), 'tout')
            for u in a_new - a_old: bump(mi, u, key_attrs(p, mi), 'tin')
        if mi > 0 and random.random() < .002:                    # перевод внутри юнита
            for u in ancestors(p['unit'], mi): bump(mi, u, key_attrs(p, mi), 'tint')
        if mi > 0 and random.random() < .005:                    # смена типа: декрет ↔ работа
            p['type'] = 'Декрет' if p['type'] == 'Активная' else ('Активная' if p['type'] == 'Декрет' else p['type'])
        if mi > 0 and p['type'] == 'Кандидаты в учебных юнитах' and random.random() < .3:
            p['type'] = 'Активная'
            for u in ancestors(p['unit'], mi): bump(mi, u, key_attrs(p, mi), 'tcand')
        nxt.append(p)
    people = nxt
    if mi > 0:                                                   # найм
        for _ in range(int(len(people) * random.uniform(.02, .035))):
            p = new_person(place(mi), mi); people.append(p); hires += 1
            for u in ancestors(p['unit'], mi):
                bump(mi, u, key_attrs(p, mi), 'hire')
    wdn, grt = workdays(mi), dict(ga=0, gd=0, gc=0, gi=0)
    for p in people:                                             # численность на конец месяца
        anc = ancestors(p['unit'], mi)
        ka = key_attrs(p, mi)
        for u in anc:
            bump(mi, u, ka, 'emp')
            if p['type'] == 'Активная': bump(mi, u, ka, 'act')
            bump(mi, u, ka, {'normal': 'pn', 'low': 'pl', 'high': 'ph', 'gray': 'pg'}[perf_of(p)])
        wd = 0 if p['type'] == 'Декрет' else round(wdn * (random.uniform(.8, 1) if p['type'] == 'Активная' else .5))
        ov = min(wd, round(wd * OFFICE[p['oper']] * random.uniform(.6, 1.3)))
        out = None
        if p['app'] is not None:
            p['app'] -= 1
            if p['app'] <= 0:
                out, p['app'] = pick(OUTCOME), None
        elif mi > 0 and p['type'] == 'Активная' and random.random() < .012:
            p['app'] = random.choice([1, 2, 3])
        for u in anc:
            if wd: bump(mi, u, ka, 'wd', wd)
            if ov: bump(mi, u, ka, 'ov', ov)
            if out: bump(mi, u, ka, out)
            if p['app'] is not None: bump(mi, u, ka, 'gi')
        if out: grt[out] += 1
        if p['app'] is not None: grt['gi'] += 1
    truth['company'].append(dict(month=MONTHS[mi], emp=len(people), hire=hires, fire=fires, regret=regrets, **grt))

# ---- строки таблицы -----------------------------------------------------
rows = []
for (mi, u, a), d in sorted(agg.items(), key=lambda kv: (kv[0][0], kv[0][1], tuple(str(x) for x in kv[0][2]))):
    prev = agg.get((mi - 1, u, a))
    lag = prev['act'] if prev is not None else None
    ssch = (d['act'] + (lag if lag is not None else d['act'])) / 2
    for path in paths_for_rows(u, mi):
        names = path + [None] * (11 - len(path))
        rows.append([MONTHS[mi], hashlib.md5(u.encode()).hexdigest(), len(path), *names, *a,
                     d['emp'], d['act'], lag, ssch, d['hire'], d['fire'], d['regret'], d['tin'], d['tout'],
                     d['tcand'], d['tint'], d['pn'], d['pl'], d['ph'], d['pg'],
                     d['wd'], d['ov'], d['ga'], d['gd'], d['gc'], d['gi']])
with open(f'{OUT}/hso.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    for r in rows:
        w.writerow(['\\N' if v is None else v for v in r])
json.dump(truth, open(f'{OUT}/truth.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('строк', len(rows), 'юнитов', len(units), 'людей в конце', len(people), 'колонок', len(rows[0]))
