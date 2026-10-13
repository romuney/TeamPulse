# Симулятор prod_proteus.hr_structure_overall по людям.
# Люди живут в юнитах дерева, каждый месяц: увольнения, найм, переводы,
# смена типа численности. Агрегат — как в проде (по ответу 0б): юнит включает
# всё своё поддерево, строка = месяц × юнит × родитель × 4 атрибута.
# Схема — разведка 12.10.2026 (describe датасета 174609): active_type_nm больше
# нет (тип численности живёт только внутри симуляции, строки по нему схлопнуты),
# employment_relation_type вместо _desc, parent_lvl — Int32, и шесть новых колонок:
#   work_day_amt     — отработанные человеко-дни за месяц (декрет — 0, прочие типы — половина);
#   office_visit_amt — посещения офиса, человеко-дни (доля дней зависит от покраски);
#   grt_*_cnt        — заявки T-роста (GRT): одобрено, отклонено, отменено за месяц,
#                      в процессе — на конец месяца. Заявку подаёт только «Активная».
# Новые колонки, как и остальные, накопительные по поддереву — так считает их и
# датасет; в проде это проверяет запрос 0г.
#   переводы считаются на границе юнита: уход из A в B — transfer_out у предков A,
#   которые не предки B, transfer_in — наоборот (общий предок перевода не видит);
#   lag = численность того же ключа месяцем раньше (NULL, если ключа не было);
#   ssch = (emp + ifNull(lag, emp)) / 2.
# Пишет hso.csv (строки таблицы) и truth.json (правда по людям для сверок).
import calendar, csv, hashlib, json, random, sys
from collections import defaultdict

random.seed(7)
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
MONTHS = [f'{2025 + (i // 12)}-{i % 12 + 1:02d}-01' for i in range(22)]   # 2025-01 … 2026-10

# ---- дерево --------------------------------------------------------------
units = {}            # rk -> dict(nm, lvl, parent)
def add(rk, nm, lvl, parent):
    units[rk] = dict(nm=nm, lvl=lvl, parent=parent)
add('R', 'Группа', 1, None)
add('C', 'Компания', 2, 'R')
n = 0
for b in range(4):
    bk = f'B{b}'; add(bk, f'Блок {b}', 3, 'C')
    for d in range(3):
        dk = f'{bk}D{d}'; add(dk, f'Деп {b}.{d}', 4, bk)
        for o in range(random.choice([0, 1, 2, 3])):
            ok = f'{dk}O{o}'; add(ok, f'Отдел {b}.{d}.{o}', 5, dk)
            for t in range(random.choice([0, 0, 1, 2])):
                add(f'{ok}T{t}', f'Команда {b}.{d}.{o}.{t}', 6, ok)
# реорганизация: в месяце 9 (2025-10) деп B1D2 переезжает под B2, а в 2026-02
# появляется новый отдел и закрывается один старый
REORG_M = 9
NEW_M, NEW_UNIT, CLOSE_UNIT = 13, 'B0D0O9', None
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
# юнит с двумя родителями в последние три месяца (как 4 юнита в проде)
MULTI = next(rk for rk in units if units[rk]['lvl'] == 5 and rk != NEW_UNIT)
MULTI_P2 = 'B3D0'
def parents_for_rows(rk, m):
    p = parent_of(rk, m)
    if rk == MULTI and m >= len(MONTHS) - 3:
        return [p, MULTI_P2]
    return [p]

# ---- люди ----------------------------------------------------------------
TYPES = [('Активная', .70), ('POS-агент', .09), ('Клексы', .06), ('Декрет', .04), ('Подрядчики', .04),
         ('Стажеры', .015), ('Кандидаты в учебных юнитах', .015), ('Разовые услуги', .01),
         ('Прогульщики', .005), ('Автор стратегий', .01), ('Мобилизованные', .004), ('Амбассадор', .001)]
OPER = [('Line', .65), ('Hq', .20), ('Support', .14), ('-', .01)]
ITC = [('NonIT', .80), ('IT', .13), ('Digital', .07)]
REL = [('Штатный сотрудник', .58), ('ГПД ФЛ', .31), ('ГПД ФЛ СМЗ', .06), ('Сотрудник партнерской организации', .025),
       ('Аутсорс', .013), ('ГПД ИП', .002), ('Сотрудник иностранной организации', .001)]
def pick(opts):
    r, acc = random.random() * sum(w for _, w in opts), 0
    for v, w in opts:
        acc += w
        if r <= acc:
            return v
    return opts[-1][0]
def new_person(unit):
    oper = pick(OPER)
    return dict(unit=unit, type=pick(TYPES), oper=oper, it='-' if oper == '-' else pick(ITC), rel=pick(REL),
                perf=pick([('normal', .7), ('low', .05), ('high', .15), ('gray', .10)]), app=None)
def workdays(mi):
    y, m = map(int, MONTHS[mi].split('-')[:2])
    return sum(1 for d in range(1, calendar.monthrange(y, m)[1] + 1) if calendar.weekday(y, m, d) < 5)
OFFICE = {'Hq': .55, 'Support': .35, 'Line': .15, '-': 0}
def place(m):
    live_leaves = [u for u in leaves if alive(u, m)]
    return random.choice(live_leaves) if random.random() < .85 else random.choice(inner)
people = [new_person(place(0)) for _ in range(2500)]

def key_attrs(p):
    grp = 'Активная' if p['type'] == 'Активная' else 'Прочие'
    return (grp, p['type'], p['oper'], p['it'], p['rel'])
def perf_of(p):
    return p['perf'] if (p['type'] == 'Активная' and p['oper'] == 'Hq') else 'gray'

M = ['emp', 'cand', 'tint', 'hire', 'hact', 'fire', 'regret', 'tin', 'tout', 'pn', 'pl', 'ph', 'pg',
     'wd', 'ov', 'ga', 'gd', 'gc', 'gi']
agg = {}                                   # (mi, unit, attrs) -> measures
truth = {'months': MONTHS, 'company': [], 'own_full': {}, 'multi': MULTI, 'reorg': 'B1D2'}
OUTCOME = [('ga', .6), ('gd', .3), ('gc', .1)]
def bump(mi, unit, attrs, k, v=1):
    d = agg.setdefault((mi, unit, attrs), dict.fromkeys(M, 0))
    d[k] += v

for mi in range(len(MONTHS)):
    hires = fires = regrets = tins = 0
    if not alive(CLOSE_UNIT, mi):          # закрытый юнит: люди переходят к родителю
        for p in people:
            if p['unit'] == CLOSE_UNIT:
                old = p['unit']; p['unit'] = parent_of(old, mi)
                a_old, a_new = set(ancestors(old, mi - 1)), set(ancestors(p['unit'], mi))
                for u in a_old - a_new: bump(mi, u, key_attrs(p), 'tout')
                for u in a_new - a_old: bump(mi, u, key_attrs(p), 'tin')
    nxt = []
    for p in people:
        r = random.random()
        rate = .015 if p['type'] == 'Активная' else .06
        if mi > 0 and r < rate:                                  # увольнение
            for u in ancestors(p['unit'], mi):
                bump(mi, u, key_attrs(p), 'fire')
            if p['type'] == 'Активная' and p['oper'] == 'Hq' and random.random() < .1:
                for u in ancestors(p['unit'], mi): bump(mi, u, key_attrs(p), 'regret')
                regrets += 1
            fires += 1
            continue
        if mi > 0 and r < rate + .02:                            # перевод в другой юнит
            old = p['unit']; p['unit'] = place(mi)
            a_old, a_new = set(ancestors(old, mi)), set(ancestors(p['unit'], mi))
            for u in a_old - a_new: bump(mi, u, key_attrs(p), 'tout')
            for u in a_new - a_old: bump(mi, u, key_attrs(p), 'tin')
            tins += 1
        if mi > 0 and random.random() < .002:                    # перевод внутри юнита
            for u in ancestors(p['unit'], mi): bump(mi, u, key_attrs(p), 'tint')
        if mi > 0 and random.random() < .005:                    # смена типа: декрет ↔ работа
            p['type'] = 'Декрет' if p['type'] == 'Активная' else ('Активная' if p['type'] == 'Декрет' else p['type'])
        if mi > 0 and p['type'] == 'Кандидаты в учебных юнитах' and random.random() < .3:
            p['type'] = 'Активная'
            for u in ancestors(p['unit'], mi): bump(mi, u, key_attrs(p), 'hact'); bump(mi, u, key_attrs(p), 'cand')
        nxt.append(p)
    people = nxt
    if mi > 0:                                                   # найм
        for _ in range(int(len(people) * random.uniform(.02, .035))):
            p = new_person(place(mi)); people.append(p); hires += 1
            for u in ancestors(p['unit'], mi):
                bump(mi, u, key_attrs(p), 'hire')
                if p['type'] == 'Активная': bump(mi, u, key_attrs(p), 'hact')
    wdn, grt = workdays(mi), dict(ga=0, gd=0, gc=0, gi=0)
    for p in people:                                             # численность на конец месяца
        anc = ancestors(p['unit'], mi)
        for u in anc:
            bump(mi, u, key_attrs(p), 'emp')
            bump(mi, u, key_attrs(p), {'normal': 'pn', 'low': 'pl', 'high': 'ph', 'gray': 'pg'}[perf_of(p)])
        # отработанные дни и посещения офиса
        wd = 0 if p['type'] == 'Декрет' else round(wdn * (random.uniform(.8, 1) if p['type'] == 'Активная' else .5))
        ov = min(wd, round(wd * OFFICE[p['oper']] * random.uniform(.6, 1.3)))
        # заявка T-роста: подаёт только «Активная», решение через 1–3 месяца
        out = None
        if p['app'] is not None:
            p['app'] -= 1
            if p['app'] <= 0:
                out, p['app'] = pick(OUTCOME), None
        elif mi > 0 and p['type'] == 'Активная' and random.random() < .012:
            p['app'] = random.choice([1, 2, 3])
        for u in anc:
            if wd: bump(mi, u, key_attrs(p), 'wd', wd)
            if ov: bump(mi, u, key_attrs(p), 'ov', ov)
            if out: bump(mi, u, key_attrs(p), out)
            if p['app'] is not None: bump(mi, u, key_attrs(p), 'gi')
        if out: grt[out] += 1
        if p['app'] is not None: grt['gi'] += 1
    truth['company'].append(dict(month=MONTHS[mi], emp=len(people), hire=hires, fire=fires, regret=regrets, moves=tins, **grt))

# правда: люди прямо в узле на предпоследний месяц (последний — неполный)
FULL = len(MONTHS) - 2
own = defaultdict(int)
# восстановить нельзя (люди уже сдвинулись) — считаем по агрегату: emp(узла) − Σ emp(детей) по живым детям
emp_unit = defaultdict(float)
for (mi, u, a), d in agg.items():
    if mi == FULL: emp_unit[u] += d['emp']
for u in units:
    kids = [c for c in units if alive(c, FULL) and parent_of(c, FULL) == u]
    if kids:
        own[u] = emp_unit[u] - sum(emp_unit[c] for c in kids)
truth['own_full'] = own

# ---- строки таблицы -----------------------------------------------------
# Типа численности (active_type_nm) в таблице больше нет: строки с разным типом
# внутри одной группы «Активная / Прочие» складываются, лаг — по новому ключу.
flat = {}
for (mi, u, a), d in agg.items():
    k = (mi, u, (a[0],) + a[2:])
    f = flat.setdefault(k, dict.fromkeys(M, 0))
    for m in M:
        f[m] += d[m]
rows = []
for (mi, u, a), d in sorted(flat.items()):
    prev = flat.get((mi - 1, u, a))
    lag = prev['emp'] if prev is not None else None
    ssch = (d['emp'] + (lag if lag is not None else d['emp'])) / 2
    for par in parents_for_rows(u, mi):
        pu = units.get(par) if par else None
        plvl = units[par]['lvl'] if par else None
        rows.append([MONTHS[mi], hashlib.md5(u.encode()).hexdigest(), units[u]['nm'], units[u]['lvl'],
                     hashlib.md5(par.encode()).hexdigest() if par else None,
                     pu['nm'] if pu else None, plvl, *a,
                     d['emp'], d['cand'], d['tint'], d['hire'], d['hact'], d['fire'], d['regret'], d['tin'], d['tout'],
                     d['pn'], d['pl'], d['ph'], d['pg'], lag, ssch,
                     d['wd'], d['ov'], d['ga'], d['gd'], d['gc'], d['gi']])
with open(f'{OUT}/hso.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    for r in rows:
        w.writerow(['\\N' if v is None else v for v in r])
json.dump(truth, open(f'{OUT}/truth.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('строк', len(rows), 'юнитов', len(units), 'людей в конце', len(people))
