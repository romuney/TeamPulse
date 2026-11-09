# Стенд ноутбука сборки TP 2.0 (Helicopter, «TP 2.0.yaml» в папке поставки): код ноутбука
# как есть — на синтетическом источнике по людям и дням — и сверка с правдой по людям.
#
#   python3 stand/nb_tp20.py [--pg host:port] [--fix]
#
# Нужен PostgreSQL (Greenplum ноутбука; «distributed by» вырезается). Параграфы берутся из YAML
# по заголовку и выполняются в одном пространстве имён, dal_client подменён на psycopg2.
# Источник — usr_cross_data.hr_executive_proteus по дням (юнит, атрибуты, флаги событий),
# перформанс, посещаемость, заявки T-роста. Правда — прямо по людям: численность на последний
# календарный день месяца, ССЧ — полусумма численности узла, переводы — через границу узла.
# --fix — тот же прогон с правками из «Предложения — физическая таблица под датасет.md».
import argparse, calendar, datetime as dt, io, os, random, re, sys, types
from collections import defaultdict
import pandas as pd
import psycopg2
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
YAML = os.path.join(HERE, '..', 'Архив поставки', 'TP 2.0.yaml')   # 05.11: исходник TP 2.0 — в архиве поставки
D0, D1 = dt.date(2025, 1, 1), dt.date(2026, 10, 12)      # источник загружен по 12.10 — октябрь неполный
DAYS = [D0 + dt.timedelta(d) for d in range((D1 - D0).days + 1)]
NL = 11
ROOTS = int(os.environ.get('NB_ROOTS', '1'))   # NB_ROOTS=2 — два корня в структуре

# ---- синтетический источник ------------------------------------------------
def tree():
    u = {'1': ('ТБанк', None)}
    u['11'] = ('Компания', '1')
    for b in range(1, 4):
        bk = f'11{b}'; u[bk] = (f'Блок {b}', '11')
        for d in range(1, 4):
            dk = f'{bk}{d}'; u[dk] = (f'Деп {b}.{d}', bk)
            for t in range(1, random.choice([1, 3, 4])):
                u[f'{dk}{t}'] = (f'Команда {b}.{d}.{t}', dk)
    if ROOTS > 1:                     # второй корень — проверка общего корня «all» в build_hub
        u['2'] = ('Второй корень', None)
        for d in range(1, 3):
            u[f'2{d}'] = (f'Деп В.{d}', '2')
    return u


def path(u, rk):
    p = []
    while rk:
        p.append(rk); rk = u[rk][1]
    return p[::-1]


def simulate(seed=11):
    random.seed(seed)
    U = tree()
    kids = defaultdict(list)
    for k, (_, par) in U.items():
        if par: kids[par].append(k)
    leaves = [k for k in U if not kids[k]]
    homes = leaves + [k for k in U if len(k) == 5 and kids[k]]   # люди в листьях и немного в департаментах
    pick = lambda opts: random.choices([o for o, _ in opts], [w for _, w in opts])[0]
    people, rk = [], 600000

    def new(day):
        nonlocal rk
        rk += 1
        g = random.choice([12, 13, 14, 15, 16, 17])
        return dict(rk=rk, start=day, end=None, unit=[(day, random.choice(homes))], grade=[(day, g)],
                    gender=pick([('Мужчина', .55), ('Женщина', .45)]), age=pick([('до 25', .2), ('от 25 до 30', .35), ('30+', .45)]),
                    rel=pick([('Штатный сотрудник', .86), ('ГПД ФЛ', .08), ('ГПД ИП', .06)]),
                    con=pick([('Гибридный', .5), ('Офисный', .35), ('Удалённый', .15)]),
                    legal=pick([('АО «ТБанк»', .7), ('ООО «ТЦР»', .3)]),
                    stream=pick([('Управление', .3), ('Финансы', .2), ('Разработка', .4), (None, .1)]),
                    # 09.11, пропорции боя (файл 5): новые — 20% кандидаты учебных юнитов (найм переходом в БГ ~20% найма),
                    # стажёры ~4%; покраска HQ / Line / Support ~29 / 54 / 17%
                    act=(pick([('Активная', .8), ('Подрядчики', .05), ('Декрет', .04), ('Стажеры', .07),
                               ('Кандидаты в учебных юнитах', .04)]) if day == D0 else
                         pick([('Активная', .72), ('Кандидаты в учебных юнитах', .2), ('Стажеры', .04), ('Подрядчики', .03),
                               ('Декрет', .01)])),
                    it=pick([('IT', .4), ('Digital', .15), ('NonIT', .45)]), oper=pick([('HQ', .29), ('Line', .54), ('Support', .17)]),
                    hired=day - dt.timedelta(random.randint(0, 2500)) if day == D0 else day,
                    reason=None, init=None, regret=0, nonreg=0,
                    company=pick([('Банк', .6), ('ИТ-компания группы', .25), ('Страхование', .15)]),
                    spec=pick([('Backend', .25), ('Frontend', .15), ('Аналитик данных', .15), ('QA', .1),
                               ('Продуктовый менеджер', .1), ('Аккаунт-менеджер', .15), ('Операционист', .1)]),
                    source=pick([('Рекомендация', .2), ('Работные сайты', .4), ('Хантинг', .15), ('Карьерный сайт', .15),
                                 ('Стажировка', .1)]))

    def new_p(day):
        p = new(day)
        p['acth'], p['conv'] = [(day, p.pop('act'))], []      # тип активности по дням; переходы в активную
        # 21.10: срез меняется и без смены юнита — покраска, IT-код, штат (переводы под фильтры)
        for k in ('oper', 'it', 'rel'):
            p[k + 'h'] = [(day, p.pop(k))]
        return p

    W = {'HQ': .29, 'Line': .54, 'Support': .17}           # 09.11: доли покраски боя — и у смены покраски

    def shift(p, k, day, opts):
        cur = p[k + 'h'][-1][1]
        rest = [o for o in opts if o != cur]
        p[k + 'h'].append((day, random.choices(rest, [W.get(o, 1) for o in rest])[0]))
    people = [new_p(D0) for _ in range(320)]
    for day in DAYS[1:]:
        alive = [p for p in people if p['end'] is None]
        if day.weekday() < 5:
            spike = day.month in (5, 7)                         # 09.11, как на бою: месяцы массового выхода из «Активной»
            for p in alive:
                # 09.11, пропорции боя: кандидат и стажёр переходят в боевую / штат быстро (~50% в месяц) — найм переходом
                if p['acth'][-1][1] in CONV and (day.year, day.month) != (p['start'].year, p['start'].month) \
                        and random.random() < .03:
                    p['conv'].append((day, CONV[p['acth'][-1][1]]))
                    p['acth'].append((day, 'Активная'))
                    continue
                if spike and p['acth'][-1][1] == 'Активная' and random.random() < .0002:
                    p['acth'].append((day, 'Декрет'))           # ~1,3% за месяц сверх обычного
                    continue
                r = random.random()
                if r < .0022:                                   # 09.11: ~4,8% в месяц, как на бою
                    p['end'] = day
                    p['reason'] = pick([('Лучшее предложение', .4), ('Личные обстоятельства', .3), ('Нет роста', .3)])
                    p['init'] = pick([('Работник', .8), ('Работодатель', .2)])
                    p['regret'] = int(random.random() < .2)
                    p['nonreg'] = int(not p['regret'] and random.random() < .7)
                elif r < .0021:                                 # ~2% в месяц переходят в другой юнит
                    cur = p['unit'][-1][1]
                    p['unit'].append((day, random.choice([h for h in homes if h != cur])))
                    if random.random() < .3:                    # часть — со сменой покраски в тот же день
                        shift(p, 'oper', day, OPER)
                    # 09.11, случай боя: переход в другое подразделение и в тот же день выход из «Активной» — у общих узлов
                    # пути и у корня это «Перевод-» (флаг выхода из типа на строке «из»)
                    if p['acth'][-1][1] == 'Активная' and random.random() < .03:
                        p['acth'].append((day, 'Декрет'))
                elif r < .0026:
                    p['grade'].append((day, p['grade'][-1][1] + 1))
                elif r < .0066 and p['acth'][-1][1] in CONV:
                    # ~8% в месяц: стажёр — в штат, кандидат учебного юнита — в боевую группу (найм по
                    # методологии DD; флаги transfer_internal_flg / transfer_candidate_flg источника)
                    p['conv'].append((day, CONV[p['acth'][-1][1]]))
                    p['acth'].append((day, 'Активная'))
                elif r < .0072:                                 # ~1,3% в месяц — смена покраски
                    shift(p, 'oper', day, OPER)
                elif r < .0076:                                 # ~0,9% — смена IT-кода
                    shift(p, 'it', day, ITC)
                elif r < .0079:                                 # ~0,6% — смена штата (ГПД ↔ штат)
                    shift(p, 'rel', day, REL)
                elif (r < .0082 and p['acth'][-1][1] in ('Активная', 'Декрет')    # декрет и выход из него —
                      and (day.year, day.month) != (p['start'].year, p['start'].month)):   # не в месяц найма
                    p['acth'].append((day, 'Декрет' if p['acth'][-1][1] == 'Активная' else 'Активная'))
                elif (r < .0100 and p['acth'][-1][1] == 'Подрядчики'
                      and (day.year, day.month) != (p['start'].year, p['start'].month)):
                    # 22.10, поставка 60: подрядчик — в штат (~4% в месяц): тип «Подрядчики» → «Активная» и в тот же
                    # день оформление — штат. При выборе «Активная» + «Подрядчики» это не перевод, при одной «Активной» —
                    # перевод «в»
                    p['acth'].append((day, 'Активная'))
                    if p['relh'][-1][1] != 'Штатный сотрудник':
                        p['relh'].append((day, 'Штатный сотрудник'))
                elif (.0100 <= r < .0101 and p['acth'][-1][1] == 'Активная'
                      and (day.year, day.month) != (p['start'].year, p['start'].month)):
                    p['acth'].append((day, 'Подрядчики'))      # редко — обратно в подрядчики
            for _ in range(sum(random.random() < .0013 for _ in alive) + (1 if random.random() < .15 else 0)):
                people.append(new_p(day))
    return U, people


CONV = {'Стажеры': 'transfer_internal_flg', 'Кандидаты в учебных юнитах': 'transfer_candidate_flg'}
# 22.10, поставка 61: активная — тип «Активная», подрядчики в неё не входят (в поставке 60 было «Активная» +
# «Подрядчики», как в TP 2.0). Выбор отчёта — любой набор типов численности (active_type_nm), по умолчанию — ACTIVE;
# «Активная» + «Подрядчики», как в мастер-отчёте, — набор из двух типов
ACTIVE = ('Активная',)
OPER, ITC, REL = ('HQ', 'Line', 'Support'), ('IT', 'Digital', 'NonIT'), ('Штатный сотрудник', 'ГПД ФЛ', 'ГПД ИП')


def attr(p, k, day):
    """покраска (oper), IT-код (it), отношения (rel) на день"""
    return at(p[k + 'h'], day)


def at(hist, day):
    v = hist[0][1]
    for d, x in hist:
        if d <= day: v = x
    return v


def tenure(p, day):
    m = (day.year - p['hired'].year) * 12 + day.month - p['hired'].month
    return 'До 1 года' if m < 12 else '1-3 года' if m < 36 else '3-5 лет' if m < 60 else 'Стаж более 5 лет'


def seniority(g):
    return 'Junior' if g <= 13 else 'Middle' if g <= 15 else 'Senior' if g <= 17 else 'Lead'


# флаги смены типа (покраска, IT, тип активности, штат): с 21.10 симуляция их меняет; специализация — с 31.10
# (sp_change), стрим — всегда 0
TYPES = ['active_type', 'hq', 'it', 'specialization', 'stream', 'employment_relation_type']
COLS = (['calendar_dt', 'mdm_employee_rk']
        + [f'lvl{i}_mapped_management_unit_rk' for i in range(1, NL + 1)]
        + [f'lvl{i}_mapped_management_unit_nm' for i in range(1, NL + 1)]
        + [f'lvl{i}_mngt_unit_in_trsf_flg' for i in range(1, NL + 1)]
        + [f'lvl{i}_mngt_unit_out_trsf_flg' for i in range(1, NL + 1)]
        + ['active_type_nm', 'active_count_flg', 'emp_specialization_it_code', 'emp_specialization_oper_code', 'employment_relation_type_desc', 'gender', 'type_age',
           'experience_group_nm', 'grade', 'seniority', 'fire_reason_group', 'fire_initiative',
           'employee_contract_type_desc', 'lvl1_legal_unit_nm', 'employee_stream_desc',
           'hire_flg', 'transfer_candidate_flg', 'transfer_internal_flg', 'fire_flg', 'regrettable_fire_flg']
        + [f'transfer_{d}_{t}_flg' for d in ('to', 'out') for t in TYPES]
        # 21.10: поля прод-ноутбуков HQ и УС — нежелательное/обычное увольнение, тип компании,
        # специализация, источник найма
        + ['non_regrettable_fire_flg', 'type_company', 'employee_specialization_desc', 'source_type_nm']
        # 22.10, поставка 58: 12-й уровень — как в бою (описание источника: lvl1..lvl12); людей на нём нет.
        # SQL-параграфы build_hub читают флаги переводов юнита всех 12 уровней
        + ['lvl12_mapped_management_unit_rk', 'lvl12_mapped_management_unit_nm',
           'lvl12_mngt_unit_in_trsf_flg', 'lvl12_mngt_unit_out_trsf_flg']
        # 22.10, поставка 59: признак последнего дня месяца — по нему мастер-отчёт переносит перевод «из»
        + ['last_day_of_month_flg']
        # 22.10, поставка 62: регион сотрудника — разрез портрета и конструктора
        + ['residential_state_nm']
        # 23.10, поставка 64: формат работы — в fields параграфа EXEC build_all_metrics заказчика
        + ['type_of_work']
        # 26.10, поставка 66 (Адель): признак руководителя юнита — в fields (сегмент посещаемости)
        + ['management_head_flg']
        # 29.10, поставка 73: возраст (поле age — fields Адели, средний возраст) и ключ специализации (рост доступен — по
        # справочнику специализаций, как отчёт «Рост»)
        + ['age', 'emp_specialization_dk']
        # 05.11, поставка 104 (переводы по правилам мастер-отчёта): активен ли человек в предыдущий день
        + ['prev_active_count_flg'])
# регион — по ключу человека, без генератора: случайный ряд симуляции не сдвигается; у части людей пусто
REGIONS = ['г. Москва', 'г. Москва', 'г. Москва', 'Московская область', 'г. Санкт-Петербург', 'Свердловская область',
           'Новосибирская область', 'Республика Татарстан', None]
WORKS = ['Офис', 'Гибрид', 'Удалённо', 'Офис', None]


def heads(U, people):
    """месяц → юнит → руководитель (rk): живой человек юнита на конец месяца с меньшим rk (structure_rows,
    management_head_flg источника по дням — поставка 66)"""
    alive = lambda p, d: p['start'] <= d and (p['end'] is None or d < p['end'])
    H = {}
    for m in months():
        e, h = eom(m), {}
        for p in people:
            if alive(p, e):
                u = at(p['unit'], e)
                h[u] = min(h.get(u, p['rk']), p['rk'])
        H[m] = h
    return H


def head_flg(H, p, d):
    """руководитель ли человек в день d: руководитель своего юнита на конец месяца дня"""
    return int(H[dt.date(d.year, d.month, 1)].get(at(p['unit'], d)) == p['rk'])


def sp_change(p):
    """31.10, п. 10: у части людей (по ключу, без генератора — остальная симуляция не сдвигается) одна смена
    специализации в середине жизни: (первый день в новой, новая специализация) или None. Меняется только
    employee_specialization_desc источника и флаги transfer_to / transfer_out_specialization_flg"""
    if p['rk'] % 11 != 3:
        return None
    s0, last = max(p['start'], D0), p['end'] or D1
    span = (last - s0).days
    if span < 4:
        return None
    return s0 + dt.timedelta(1 + p['rk'] * 37 % (span - 2)), SPECS[(SPECS.index(p['spec']) + 1) % len(SPECS)]


def spec_at(p, d):
    ch = sp_change(p)
    return ch[1] if ch and d >= ch[0] else p['spec']


def source_at(p, d):
    """источник найма на день d (поставка 103, файл 9, п. 12): у части нанятых в окне поле меняется после дня найма в том
    же месяце (каждый 4-й — «Внутренний перевод»), у каждого 13-го в день найма пусто и заполняется на следующий день —
    отчёт берёт значение дня найма ('-'), а не последнее за месяц"""
    if p['start'] > D0 and d.year == p['start'].year and d.month == p['start'].month:
        if p['rk'] % 13 == 0 and d == p['start']:
            return None
        if p['rk'] % 5 in (1, 2, 3) and d == p['start']:   # 09.11, как на бою: у большинства наймов пусто в день найма
            return None
        if p['rk'] % 4 == 0 and d > p['start']:
            return 'Внутренний перевод'
    return p['source']


def source_rows(U, people):
    H = heads(U, people)
    for p in people:
        last = p['end'] or D1
        d = max(p['start'], D0)
        while d <= last:
            pu = path(U, at(p['unit'], d))
            prev = path(U, at(p['unit'], d - dt.timedelta(1))) if d > p['start'] else None
            nxt = path(U, at(p['unit'], d + dt.timedelta(1))) if d < last else None
            # флаг юнита уровня — значение уровня сменилось, в том числе на «-» и с «-» (поставка 64, как в выгрузке
            # боя 23.10: из корня юнита в его подразделение — lvl5_out_trsf_flg = 1 у строки с 5-м уровнем «-»)
            lv = lambda q, i: q[i] if i < len(q) else None
            inf = [int(prev is not None and lv(pu, i) != lv(prev, i)) for i in range(NL)]
            outf = [int(nxt is not None and lv(pu, i) != lv(nxt, i)) for i in range(NL)]
            g = at(p['grade'], d)
            fired = int(p['end'] == d)
            act = at(p['acth'], d)
            cv = {f for c, f in p['conv'] if c == d}
            # флаги смены типа, как в источнике: «в» — первый день в новом значении, «из» — последний в
            # старом (смена в течение жизни, не найм и не увольнение)
            vals = lambda day: (at(p['acth'], day), attr(p, 'oper', day), attr(p, 'it', day), attr(p, 'rel', day))
            cur = vals(d)
            pv = vals(d - dt.timedelta(1)) if d > p['start'] else cur
            nx = vals(d + dt.timedelta(1)) if d < last else cur
            # 21.10, поставка 56: по методологии переводов флаг — любая смена значения (не только «в HQ»,
            # «в IT», «в Активную»); так и в TP 2.0 «в»/«из» — против прошлого и следующего дня
            want = (None, None, None, None)
            tf = {t: int(pv[i] != cur[i] and (want[i] is None or cur[i] == want[i]))
                  for i, t in enumerate(('active_type', 'hq', 'it', 'employment_relation_type'))}
            of = {t: int(nx[i] != cur[i] and (want[i] is None or cur[i] == want[i]))
                  for i, t in enumerate(('active_type', 'hq', 'it', 'employment_relation_type'))}
            # 09.11, как на бою (файл 5, блок 11: «Перевод-» мастера по флагу строки больше, чем у отчёта): источник бывает
            # несогласован — у части выходов из «Активной» на следующей строке нет флага входа в новый тип
            if tf['active_type'] and cur[0] not in ACTIVE and pv[0] in ACTIVE and p['rk'] % 9 == 0:
                tf['active_type'] = 0
            # 31.10, п. 10: смена специализации — «в» в первый день новой, «из» в последний день старой
            spd = spec_at(p, d)
            tf['specialization'] = int(d > p['start'] and spec_at(p, d - dt.timedelta(1)) != spd)
            of['specialization'] = int(d < last and spec_at(p, d + dt.timedelta(1)) != spd)
            yield ([d, p['rk']] + [pu[i] if i < len(pu) else None for i in range(NL)]
                   + [U[pu[i]][0] if i < len(pu) else None for i in range(NL)]
                   + inf + outf
                   + [act, int(act in ACTIVE), cur[2], cur[1], cur[3], p['gender'], p['age'], tenure(p, d), str(g), seniority(g),
                      p['reason'] if fired else None, p['init'] if fired else None,
                      p['con'], p['legal'], p['stream'],
                      int(d == p['start'] and p['start'] > D0), int('transfer_candidate_flg' in cv),
                      int('transfer_internal_flg' in cv), fired, p['regret'] if fired else 0]
                   + [tf.get(t, 0) for t in TYPES] + [of.get(t, 0) for t in TYPES]
                   + [p['nonreg'] if fired else 0, p['company'], spd, source_at(p, d)]
                   + [None, None, 0, 0]
                   + [int((d + dt.timedelta(1)).day == 1)]
                   + [REGIONS[p['rk'] * 7 % len(REGIONS)]]
                   + [WORKS[p['rk'] * 3 % len(WORKS)]]
                   + [head_flg(H, p, d)]
                   + [age_num(p), SPECS.index(p['spec']) + 1]
                   + [int(d > p['start'] and at(p['acth'], d - dt.timedelta(1)) in ACTIVE)])
            d += dt.timedelta(1)


# ---- вакансии (21.10): usr_cross_data.vacancy_daily по дням, как источник TP 2.0 ----------
VAC_COLS = (['issue_full_nm', 'issue_day', 'approved_dt', 'approved_dt_last', 'close_flg', 'end_of_month_flg', 'last_dt_flg',
             'status_name', 'status_name_chng_group', 'search_reason', 'mapping_channel_name', 'act_month',
             'specialization', 'lvl_position_adj', 'finalist_level_candy']
            + [f'resource_level_{i}_rk' for i in range(1, NL + 1)])


def vacancies(U, seed=7):
    """вакансия: юнит, согласована, в работе (Backlog → В работе → Готово к выходу, бывает Холд), закрыта
    или отменена; у части — открыта на последний день. Есть вакансии в юнитах без людей (блоки)"""
    random.seed(seed)
    kids = defaultdict(list)
    for k, (_, par) in U.items():
        if par: kids[par].append(k)
    units = [k for k in U if not kids[k]] + [k for k in U if len(k) in (4, 5) and kids[k]]
    pick = lambda opts: random.choices([o for o, _ in opts], [w for _, w in opts])[0]
    out, n = [], 0
    for u in units:
        for _ in range(random.randint(3, 14)):
            n += 1
            adt = D0 - dt.timedelta(60) + dt.timedelta(random.randint(0, (D1 - D0).days + 60))
            r = random.random()
            end, kind = (adt + dt.timedelta(random.randint(12, 130)), 'close') if r < .62 else \
                ((adt + dt.timedelta(random.randint(5, 60)), 'cancel') if r < .7 else (None, 'open'))
            if end and end > D1:
                end, kind = None, 'open'
            hold = adt + dt.timedelta(random.randint(15, 40)) if random.random() < .15 else None
            out.append(dict(id=f'VAC-{n}', unit=u, adt=adt, end=end, kind=kind, hold=hold,
                            reason=pick([('Замена сотрудника', .45), ('Новая позиция', .45), ('Расширение функции', .1)]),
                            # поставка 86: каналы из списка Адели + процессинг (юрлицо выдумано) + канал вне списка
                            channel=pick([('Активный поиск', .4), ('Отклики с внешних площадок', .2), ('Ротация', .15),
                                          ('Процессинг Тест', .1), ('Внешний найм', .15)]),
                            spec=pick([('Разработка', .4), ('Аналитика', .2), ('Тестирование', .15), ('Продажи', .15), ('Поддержка', .1)]),
                            pos=pick([('Junior', .3), ('Middle', .4), ('Senior', .25), ('Lead', .05)]),
                            cand=pick([('Junior', .3), ('Middle+', .45), ('Senior', .25)])))
    return out


def vac_status(v, d):
    """статус и группа на день d (None — строки нет)"""
    last = v['end'] or D1
    if d < max(v['adt'], D0) or d > last:
        return None
    if v['end'] == d:
        return ('Закрыта', 'Закрытые') if v['kind'] == 'close' else ('Отменена', 'Отменённые')
    if v['hold'] and v['hold'] <= d < v['hold'] + dt.timedelta(20):
        return 'Hold', 'Согласованные'      # поставка 103: в источнике — 'Hold' (ноутбук 2_11 считает по нему дни холда)
    if d < v['adt'] + dt.timedelta(10):
        return 'Backlog', 'Согласованные'
    if v['end'] and v['kind'] == 'close' and d >= v['end'] - dt.timedelta(10):
        return 'Готово к выходу', 'Согласованные'
    return 'В работе', 'Согласованные'


def vacancy_rows(U, vacs):
    for v in vacs:
        pu = path(U, v['unit'])
        last = v['end'] or D1
        d = max(v['adt'], D0)
        while d <= last:
            st, gr = vac_status(v, d)
            nxt = d + dt.timedelta(1)
            yield ([v['id'], d, v['adt'], v['adt'], int(v['end'] == d and v['kind'] == 'close'), int(nxt.month != d.month),
                    int(d == last), st, gr, v['reason'], v['channel'], f'{d.year}-{d.month:02d}', v['spec'], v['pos'],
                    v['cand'] if v['kind'] == 'close' and d == v['end'] else None]
                   + [pu[i] if i < len(pu) else '-' for i in range(NL)])
            d = nxt


VAC_CHANNELS = {'Активный поиск', 'Внешняя реферальная программа', 'Кадровое агентство', 'Найден руководителем', 'Наша база',
                'Не удалось получить источник в Candy(Внешнийтип поиска)', 'Образовательные программы',
                'Отклики с внешних площадок', 'Отклики с нашего сайта', 'Приведи друга', 'Ротация'}
vac_ok = lambda v: v['channel'] in VAC_CHANNELS or v['channel'].startswith('Процессинг ')   # поставка 86, structure_x_vacancy


def vac_ttf(v):
    """поставка 103 (ноутбук 2_11): срок закрытой вакансии — дней от согласования до закрытия без дней в Hold; дни холда —
    по строкам источника (с D0) внутри [согласование; закрытие]"""
    hold = sum(1 for k in range((v['end'] - max(v['adt'], D0)).days + 1)
               if vac_status(v, max(v['adt'], D0) + dt.timedelta(k))[0] == 'Hold')
    return max((v['end'] - v['adt']).days - hold, 0)


def truth_vac(U, vacs):
    """узел × месяц → открыто на конец месяца (у текущего — на последний день), закрыто, новые, срок
    (сумма дней и число закрытых); как structure_x_vacancy + build_hub, шаг 11"""
    T = defaultdict(lambda: defaultdict(float))
    root = ['all'] if ROOTS > 1 else []
    # поставка 103 (2_11): открытые и новые — по всем каналам, закрытые и срок — по каналам из списка (in_ch)
    for v in vacs:
        nodes = root + path(U, v['unit'])
        ok = vac_ok(v)
        for m in months():
            e = eom(m)
            st = vac_status(v, e)
            add = {}
            if st and st[1] == 'Согласованные':
                add['vop'] = 1
            if ok and v['kind'] == 'close' and v['end'] and (v['end'].year, v['end'].month) == (m.year, m.month):
                add['vcl'] = 1
                add['vtd'] = vac_ttf(v)
                add['vtn'] = 1
                add['vjn'] = int(v['cand'] == 'Junior')
            if v['adt'] >= D0 and (v['adt'].year, v['adt'].month) == (m.year, m.month):
                add['vap'] = 1
            for n in nodes:
                for k, x in add.items():
                    T[(n, m)][k] += x
    return T


# ---- AI по неделям (06.11, поставка 106; месячный дайджест больше не читается): как
#      usr_mlpa.ai_bi_all_copilots_usage_digest_weekly — человек × неделя (Пн) × пара «юнит → дочерний на пути к листу»
#      (лист — сам с собой); стажёры помечены is_intern_flg ----
def ai_week_user(p, w):
    return (p['rk'] * 31 + w.toordinal() // 7 * 3) % 100 < 55


def ai_weeks():
    w = dt.date(D0.year - 1, 9, 1)      # с запасом: ноутбук берёт недели от начала сетки минус 4 месяца
    w += dt.timedelta((7 - w.weekday()) % 7)
    while w <= D1:
        yield w
        w += dt.timedelta(7)


AI_TOOLS = ['Корпоративный ассистент', 'Copilot', 'Nestor IDE', 'Nessy CLI', 'AI-поиск по базе знаний', 'Генерация документов',
            'AI в аналитике', 'Переводчик', 'Ассистент встреч', 'Код-ревью', 'Генерация тестов', 'Ассистент почты',
            'Помощник по SQL', 'Распознавание речи']
AI_TASKS = ['Написание кода', 'Поиск ошибок', 'Тесты', 'Ревью кода', 'Документация']


def ai_extra(p, w, u):
    """поставка 106: поля человека-недели как у источника — инструменты, дни, задачи и сообщения (детерминированно)"""
    h = (p['rk'] * 7919 + w.toordinal() * 31) % 100003
    if not u:
        return [], 0, [], [], 0, 0
    nt = 1 + h % 4
    tools = [AI_TOOLS[min(len(AI_TOOLS) - 1, int(((h // 7 + k * 5) % 100) ** 2 / 700))] for k in range(nt)]
    tools = sorted(set(tools), key=AI_TOOLS.index)
    days = 1 + (h // 11) % 5
    dev = [t for t in tools if t in ('Copilot', 'Nestor IDE', 'Nessy CLI')]
    msgs = (h // 13) % 40 + 5 if dev else 0
    tasks, tm = [], []
    if msgs:
        k = 1 + (h // 17) % 3
        tasks = [AI_TASKS[(h // 19 + j) % len(AI_TASKS)] for j in range(k)]
        part = msgs * 3 // 4
        tm = [part // k + (part % k if j == 0 else 0) for j in range(k)]
    return tools, days, tasks, tm, sum(tm), msgs


def pg_arr(a):
    return '{' + ','.join('"' + str(x).replace('"', '') + '"' for x in a) + '}'


def ai_week_rows(U, people, full=False):
    alive = lambda p, d: p['start'] <= d and (p['end'] is None or d < p['end'])
    for w in ai_weeks():
        for p in people:
            if not alive(p, w):
                continue
            pth = path(U, at(p['unit'], w))
            it = int(at(p['acth'], w) == 'Стажеры')
            u = int(ai_week_user(p, w))
            ex = (attr(p, 'oper', w),) + ai_extra(p, w, u) if full else ()
            for i, n in enumerate(pth):
                yield (w, p['rk'], n, pth[i + 1] if i + 1 < len(pth) else n, it, u) + ex


def ai_week_src(U, people):
    """строки таблицы источника: массивы — литералом text[] PG"""
    for r in ai_week_rows(U, people, True):
        paint, tools, days, tasks, tm, cls, msgs = r[6:]
        yield r[:6] + (paint, pg_arr(tools), len(tools), days, pg_arr(tasks), pg_arr(tm), cls, msgs)


def ai_closed_week():
    """последняя полная неделя: понедельник + 6 <= дата данных (D1), иначе неделя перед последней"""
    lw = list(ai_weeks())[-1]
    return lw if lw + dt.timedelta(6) <= D1 else lw - dt.timedelta(7)


def truth_aix(U, people):
    """поставка 106: «Кто» и «Как пользуется» за последнюю полную неделю — узел → {(ключ, значение): n}"""
    cw = ai_closed_week()
    P = defaultdict(dict)
    for r in ai_week_rows(U, people, True):
        if r[0] != cw:
            continue
        P[r[2]][r[1]] = (r[4], r[5]) + r[6:]
    out = {}
    for n, ppl in P.items():
        T = defaultdict(float)
        T[('aik', str(cw))] = 1
        for e, (it, u, paint, tools, days, tasks, tm, cls, msgs) in ppl.items():
            if it:
                T[('aih', '')] += 1
                if u:
                    T[('aiu', '')] += 1
                    T[('aif', str(days))] += 1
                for t in tools:
                    T[('ait', t)] += 1
            else:
                T[('aph', paint)] += 1
                for t in tools:
                    T[('apt', paint + '|' + t)] += 1
                    T[('aut', t)] += 1
                if u:
                    T[('auf', str(days))] += 1
                    T[('aun', str(min(len(tools), 4)))] += 1
                T[('aum', '')] += msgs
                T[('auc', '')] += cls
                for k, m in zip(tasks, tm):
                    T[('auk', k)] += m
        # 07.11: ранги инструментов (как row_number в ноутбуке: людей ↓, имя ↑) и люди с инструментами вне топ-10
        for it_, kr, ko in ((0, 'aur', 'auo'), (1, 'air', 'aio')):
            cnt = defaultdict(set)
            for e, v in ppl.items():
                if v[0] == it_:
                    for t in v[3]:
                        cnt[t].add(e)
            order = sorted(cnt, key=lambda t: (-len(cnt[t]), t.encode('utf-8')))
            for i, t in enumerate(order):
                T[(kr, t)] = i + 1
            rest = set(order[10:])
            po = defaultdict(set)
            for e, v in ppl.items():
                if v[0] == it_ and rest & set(v[3]):
                    T[(ko, '')] += 1
                    if not it_:
                        po[v[2]].add(e)
            for pt, es in po.items():
                T[('apo', pt)] = len(es)
        out[n] = {k: v for k, v in T.items() if v > 0}
    return out


def truth_aiw(U, people):
    """(узел, неделя) → (WAU, численность): без стажёров, узел — всё поддерево, count distinct"""
    hc, wau = defaultdict(set), defaultdict(set)
    for w, e, n, _, it, u in ai_week_rows(U, people):
        if not it:
            hc[(n, w)].add(e)
            if u:
                wau[(n, w)].add(e)
    return {k: (len(wau[k]), len(v)) for k, v in hc.items()}


# ---- PostgreSQL и подмена dal_client -------------------------------------------
class PG:
    def __init__(self, dsn):
        self.c = psycopg2.connect(**dsn)
        self.c.autocommit = True

    def run(self, sql):
        sql = re.sub(r'(?i)\bdistributed\s+(by\s*\([^)]*\)|randomly)', '', sql)
        cur = self.c.cursor()
        cur.execute(sql)
        if cur.description:
            return pd.DataFrame(cur.fetchall(), columns=[d[0] for d in cur.description])
        return pd.DataFrame()

    def copy(self, table, cols, rows):
        buf = io.StringIO()
        for r in rows:
            buf.write('\t'.join('\\N' if v is None else str(v) for v in r) + '\n')
        buf.seek(0)
        self.c.cursor().copy_expert(f"COPY {table} ({', '.join(cols)}) FROM STDIN", buf)


def side(people):
    """перформанс за месяц, посещаемость по рабочим дням, заявки T-роста (у части людей — две в месяц)"""
    perf, office, grt = [], [], []
    random.seed(5)
    for p in people:
        last = p['end'] or D1
        m = dt.date(max(p['start'], D0).year, max(p['start'], D0).month, 1)
        while m <= last:
            # 09.11, как на бою: размечен в основном HQ, Line почти нет, Support — немного
            pm = at(p['operh'], min(last, dt.date(m.year + m.month // 12, m.month % 12 + 1, 1) - dt.timedelta(1)))
            pw = ([.68, .02, .005, .11, .02, .165] if pm == 'HQ' else [.0005, 0, 0, .0005, 0, .999] if pm == 'Line'
                  else [.035, .001, 0, .014, .002, .948])
            perf.append((p['rk'], m, random.choices(['normal', 'low', 'super_low', 'high', 'super_high', None], pw)[0]))
            r = random.random()
            for k in range(2 if r < .015 else 1 if r < .06 else 0):
                st = random.choices(['FNS', 'DCL', 'CNL', 'INP'], [.55, .25, .1, .1])[0]
                grt.append((p['rk'], dt.datetime(m.year, m.month, 5 + k * 7, 10), st, 0, '5999-01-01'))
            m = dt.date(m.year + m.month // 12, m.month % 12 + 1, 1)
        d = max(p['start'], D0)
        while d <= last:
            if d.weekday() < 5:
                pd = at(p['operh'], d)                  # 09.11: посещаемость по покраске, как на бою
                ov = int(random.random() < {'HQ': .4, 'Line': .2}.get(pd, .38))
                office.extend(office_rows(p, d, ov))
            d += dt.timedelta(1)
    return perf, office, grt_ext(people, grt)


# 27.10, поставка 71 (Адель): у заявки T-роста — грейд и специализация сейчас и желаемые, поток T@T (желаемый уровень
# T@T). По ключу человека и дню, без генератора: случайный ряд симуляции не сдвигается. Тип: смена грейда (65%),
# специализации (20%), обоих (15%); T@T — у каждой четвёртой
SPECS = ['Backend', 'Frontend', 'Аналитик данных', 'QA', 'Продуктовый менеджер', 'Аккаунт-менеджер', 'Операционист']


def grt_ext(people, grt):
    """поставка 73 (эталон «Роста»): кортеж заявки — rk, создана, статус, deleted, valid_to, грейд сейчас / желаемый,
    специализация сейчас / желаемая (ключ), T@T, итог (valid_from — последняя смена статуса: у закрытой — через 5–54
    дня, у заявки в работе — день создания), старт согласования (hd1, у трети), покраска человека в день создания,
    дата найма, номер заявки"""
    byrk = {p['rk']: p for p in people}
    out = []
    for i, (rk, ts, st, dl, vt) in enumerate(grt):
        p, h = byrk[rk], (rk * 7919 + ts.toordinal() * 104729 + ts.day) % 1000
        kind = 'g' if h < 650 else 's' if h < 850 else 'gs'
        g, sp = at(p['grade'], ts.date()), SPECS.index(p['spec']) + 1
        fin = ts if st == 'INP' else min(ts + dt.timedelta(days=5 + h % 50), dt.datetime(D1.year, D1.month, D1.day, 12))
        hd1 = ts + dt.timedelta(days=2) if h % 3 == 0 else None
        out.append((rk, ts, st, dl, vt, g, g + 1 if 'g' in kind else g, sp, sp % len(SPECS) + 1 if 's' in kind else sp,
                    1 if h % 4 == 0 else None, fin, hd1, attr(p, 'oper', ts.date()), p['hired'], 1000 + i))
    return out


# поставка 73: «рост доступен» — у специализации в справочнике есть дата запуска T-роста (у двух последних — нет)
SPEC_GROW = {s_: i < 5 for i, s_ in enumerate(SPECS)}


def age_num(p):
    """поставка 73: возраст в годах — в своей группе, по ключу человека (без генератора)"""
    rk = p['rk']
    return 21 + rk % 4 if p['age'] == 'до 25' else 25 + rk % 5 if p['age'] == 'от 25 до 30' else 30 + rk % 26


def mon_days(people):
    """поставка 71: мониторинг по дням (performance_metric_d): плановый рабочий день, часы, баланс (−1 — прогул, 1 —
    работа в выходной), часы звонков. Склонность к прогулам, выходным и доля звонков — у человека своя; по ключу
    человека и дню, без генератора"""
    out = []
    for p in people:
        rk, d, last = p['rk'], max(p['start'], D0), p['end'] or D1
        talk, ab, we = (rk * 37 % 100) / 100 * 0.6, 5 + rk % 6 * 40, rk % 7 * 90
        while d <= last:
            h = (rk * 7919 + d.toordinal() * 104729) % 1000
            plan = int(d.weekday() < 5)
            bal = -1 if plan and h < ab else 1 if not plan and h < we else 0
            dur = 0.0 if bal == -1 else round(7 + h % 30 / 10, 1) if plan else 4.0 if bal == 1 else 0.0
            if plan or bal == 1:
                # поставка 104: дневная категория перформанса (hub · 3н — категория недели = последняя непустая дневная)
                cat = ['normal', 'normal', 'normal', 'low', 'high', 'super_low', 'super_high', None][(rk * 13 + d.toordinal() // 7) % 8]
                out.append((rk, d, dur, plan, bal, round(dur * talk, 2) if plan else 0.0, cat))
            d += dt.timedelta(1)
    return out


# 26.10, поставка 66 (посещения Адели): бронирование, город офиса, визит в другой регион, день недели — по ключу
# человека и дню, без генератора (случайный ряд симуляции не сдвигается)
OFFICE_CITY = ['Москва', 'Москва', 'Санкт-Петербург', 'Екатеринбург', 'Казань', 'Новосибирск']
OFFICE_EXT = ['booking_flg', 'booking_violation_flg', 'visit_violation_flg', 'office_city_nm', 'region_visit_flg',
              'day_short_nm', 'day_sort']


# поставка 107 (база мастера «Посещаемость и бронирование офисов», 06.11): у строки источника — номер офиса дня
# main_office_visit_rn (0 — без визита, 1 — главный офис, 2 — второй офис того же дня), закреплённый офис
# (active_office_emp_flg 'Да'/'Нет'), фикс / флекс (fix_flex_cat), тип численности дня (active_type_nm); бронь вне учёта
# нарушений — booking_violation_flg NULL. Строка: (день, rk, рабочий день, визит) + OFFICE_EXT + OFFICE_X
OFFICE_X = ['main_office_visit_rn', 'active_office_emp_flg', 'fix_flex_cat', 'active_type_nm']


def office_rows(p, d, ov):
    rk = p['rk']
    h = (rk * 7919 + d.toordinal() * 104729) % 1000
    emp, fix, act = ('Да' if rk % 7 else 'Нет'), ('фикс' if rk % 5 == 0 else 'флекс'), at(p['acth'], d)
    bk, bkv, vsv, city, reg, dn, ds = office_row(rk, d, ov, {'HQ': .23, 'Line': .71}.get(at(p['operh'], d), .44))
    if not ov and bk and h % 29 == 0:
        bkv = None                                   # бронь вне учёта нарушений
    if ov and h % 31 == 0:
        vsv = None                                   # 09.11, как на бою: посещение вне учёта нарушений (NULL)
    home = OFFICE_CITY[rk % len(OFFICE_CITY)]
    if city is None and emp == 'Да':
        city = home                                  # день без визита — город закреплённого офиса (рабочие дни города)
    out = [(d, rk, 1, ov, bk, bkv, vsv, city, reg, dn, ds, 1 if ov else 0, emp, fix, act)]
    if ov and h % 23 == 0:                           # второй офис того же дня: в посещаемость не идёт (rn = 2)
        c2 = OFFICE_CITY[(rk + 3) % len(OFFICE_CITY)]
        out.append((d, rk, 1, 1, 0, 0, 0, c2, int(c2 != home), dn, ds, 2, emp, fix, act))
    return out


def office_row(rk, d, ov, nb=.22):
    """дополнение строки посещаемости (OFFICE_EXT): бронь, бронь без посещения, посещение без брони, город офиса
    (у посещения или брони), посещение в другом городе, день недели и его номер"""
    h = (rk * 7919 + d.toordinal() * 104729) % 1000
    if ov:
        bk, bkv, vsv = int(h < 1000 * (1 - nb)), 0, int(h >= 1000 * (1 - nb))   # nb — доля посещений без брони
    else:
        bk = bkv = int(h < 60)
        vsv = 0
    home = OFFICE_CITY[rk % len(OFFICE_CITY)]
    city = (OFFICE_CITY[(rk + d.day) % len(OFFICE_CITY)] if h % 17 == 0 else home) if (ov or bk) else None
    return (bk, bkv, vsv, city, int(bool(ov) and city != home), ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][d.weekday()],
            d.weekday() + 1)


def load(pg, U, people):
    pg.run("""DROP SCHEMA IF EXISTS usr_cross_data, prod_v_sse_crossdata, prod_v_dds, prod_v_dds_dic, prod_v_emart, usr_mlpa CASCADE;
              DROP SCHEMA public CASCADE; CREATE SCHEMA public;
              CREATE SCHEMA usr_cross_data; CREATE SCHEMA prod_v_sse_crossdata; CREATE SCHEMA prod_v_dds; CREATE SCHEMA prod_v_dds_dic;
              CREATE SCHEMA prod_v_emart; CREATE SCHEMA usr_mlpa;""")
    typ = lambda c: ('date' if c == 'calendar_dt' else 'bigint' if c == 'mdm_employee_rk'
                     else 'int' if c.endswith('_flg') else 'text')
    pg.run(f"CREATE TABLE usr_cross_data.hr_executive_proteus ({', '.join(f'{c} {typ(c)}' for c in COLS)})")
    pg.copy('usr_cross_data.hr_executive_proteus', COLS, source_rows(U, people))
    perf, office, grt = side(people)
    pg.run("CREATE TABLE prod_v_sse_crossdata.performance_metric_m (mdm_employee_rk bigint, calendar_dt date, performance_category text)")
    pg.copy('prod_v_sse_crossdata.performance_metric_m', ['mdm_employee_rk', 'calendar_dt', 'performance_category'], perf)
    pg.run("CREATE TABLE usr_cross_data.office_traffic_attendance (calendar_dt date, mdm_employee_rk bigint, work_day_flg int, "
           "office_visit_flg int, booking_flg int, booking_violation_flg int, visit_violation_flg int, office_city_nm text, "
           "region_visit_flg int, day_short_nm text, day_sort int, main_office_visit_rn int, active_office_emp_flg text, "
           "fix_flex_cat text, active_type_nm text)")
    pg.copy('usr_cross_data.office_traffic_attendance', ['calendar_dt', 'mdm_employee_rk', 'work_day_flg', 'office_visit_flg']
            + OFFICE_EXT + OFFICE_X, office)
    # поставка 73: заявки T-роста — usr_cross_data.mdm_employee_application_grt, как эталон отчёта «Рост»
    pg.run("""CREATE TABLE usr_cross_data.mdm_employee_application_grt (mdm_employee_application_id bigint,
              creator_mdm_employee_rk bigint, company_hire_dt date, create_dt timestamp, hd1_init_dt timestamp,
              valid_from_dttm timestamp, valid_to_dttm timestamp, current_grade_num int, required_grade_num int,
              current_specialization_desc text, required_specialization_desc text, current_specialization_oper_code text,
              mdm_employee_appl_status_cd text, specialization_change_flg int, current_tat_num int, required_tat_num int,
              lvl1_management_unit_rk text)""")
    pg.copy('usr_cross_data.mdm_employee_application_grt',
            ['mdm_employee_application_id', 'creator_mdm_employee_rk', 'company_hire_dt', 'create_dt', 'hd1_init_dt',
             'valid_from_dttm', 'valid_to_dttm', 'current_grade_num', 'required_grade_num', 'current_specialization_desc',
             'required_specialization_desc', 'current_specialization_oper_code', 'mdm_employee_appl_status_cd',
             'specialization_change_flg', 'current_tat_num', 'required_tat_num', 'lvl1_management_unit_rk'],
            # поставка 103 (2_11): юнит 1-го уровня заявки; каждая 23-я — чужой компании (отсекается фильтром rost_info)
            [(r[14], r[0], r[13], r[1], r[11], r[10], '5999-01-01 00:00:00', r[5], r[6], SPECS[r[7] - 1], SPECS[r[8] - 1],
              'Hq' if r[12] == 'HQ' else r[12], r[2], int(r[7] != r[8]), None, r[9],
              'x' if r[14] % 23 == 0 else '1') for r in grt])
    # поставка 71: справочник специализаций (rost_info Адели), поставка 73 — с датой запуска T-роста
    pg.run("CREATE TABLE prod_v_dds_dic.employee_specialization (employee_specialization_dk int, employee_specialization_desc text, "
           "deleted_flg int, valid_from_dttm date, valid_to_dttm date, tgrowth_effective_dt date)")
    pg.copy('prod_v_dds_dic.employee_specialization', ['employee_specialization_dk', 'employee_specialization_desc', 'deleted_flg',
                                                       'valid_from_dttm', 'valid_to_dttm', 'tgrowth_effective_dt'],
            [(i + 1, s_, 0, '2000-01-01', '5999-01-01', '2024-01-01' if SPEC_GROW[s_] else None) for i, s_ in enumerate(SPECS)])
    pg.run("CREATE TABLE prod_v_sse_crossdata.performance_metric_d (mdm_employee_rk bigint, calendar_dt date, duration_hour numeric, "
           "plan_working_day_flg int, working_balance int, talk_call_duration_h numeric, performance_category text)")
    pg.copy('prod_v_sse_crossdata.performance_metric_d', ['mdm_employee_rk', 'calendar_dt', 'duration_hour', 'plan_working_day_flg',
                                                         'working_balance', 'talk_call_duration_h', 'performance_category'],
            mon_days(people))
    pg.run("""CREATE TABLE prod_v_dds_dic.mdm_employee_appl_status (mdm_employee_appl_status_cd text, mdm_employee_appl_status_desc text);
              INSERT INTO prod_v_dds_dic.mdm_employee_appl_status VALUES ('FNS','Одобрена'),('DCL','Отклонена'),('CNL','Отменена'),('INP','В работе')""")
    # 19.10: структура сотрудников с логинами — источник логина руководителя юнита (build_hub, как
    # в HRBP HUB). На конец каждого месяца: руководитель юнита — живой человек юнита с меньшим rk,
    # его логин h<юнит>, его руководитель — h<родитель>; у остальных руководитель — h<юнит>
    # 26.10, поставка 66: + юнит, имя и фамилия, признаки последнего дня — для unit_head_structure Адели
    pg.run("""CREATE TABLE prod_v_emart.mdm_employee_structure_d (business_dt date, mdm_employee_rk bigint,
              management_head_flg int, ad_login text, management_head_ad_login text, management_unit_rk text,
              management_unit_nm text, first_nm text, last_nm text, last_day_flg int, last_day_of_month_flg int)""")
    pg.copy('prod_v_emart.mdm_employee_structure_d', ['business_dt', 'mdm_employee_rk', 'management_head_flg', 'ad_login',
                                                     'management_head_ad_login', 'management_unit_rk', 'management_unit_nm',
                                                     'first_nm', 'last_nm', 'last_day_flg', 'last_day_of_month_flg'],
            structure_rows(U, people))
    # 21.10: вакансии по дням (источник structure_x_vacancy)
    vtyp = lambda c: 'date' if c in ('issue_day', 'approved_dt', 'approved_dt_last') else 'int' if c.endswith('_flg') else 'text'
    pg.run(f"CREATE TABLE usr_cross_data.vacancy_daily ({', '.join(f'{c} {vtyp(c)}' for c in VAC_COLS)})")
    pg.copy('usr_cross_data.vacancy_daily', VAC_COLS, vacancy_rows(U, vacancies(U)))
    # 06.11, поставка 106: AI по неделям — строка на человека × неделю × пару пути
    pg.run("""CREATE TABLE usr_mlpa.ai_bi_all_copilots_usage_digest_weekly (week date, person_id bigint, mngt_unit_rk text,
              next_lvl_mngt_unit_rk text, is_intern_flg int, ai_usage_flg int, paint text, tools text[], tools_count int,
              usage_days_in_week int, tasks text[], task_messages int[], total_tasks_messages int,
              total_copilot_nestor_messages int)""")
    pg.copy('usr_mlpa.ai_bi_all_copilots_usage_digest_weekly',
            ['week', 'person_id', 'mngt_unit_rk', 'next_lvl_mngt_unit_rk', 'is_intern_flg', 'ai_usage_flg', 'paint', 'tools',
             'tools_count', 'usage_days_in_week', 'tasks', 'task_messages', 'total_tasks_messages',
             'total_copilot_nestor_messages'],
            ai_week_src(U, people))
    return perf, office, grt


FIRST_NM = ['Анна', 'Мария', 'Елена', 'Ольга', 'Алексей', 'Дмитрий', 'Сергей', 'Павел', 'Игорь']
LAST_NM = ['Соколов', 'Волков', 'Лебедев', 'Козлов', 'Новиков', 'Морозов', 'Павлов', None]


def person_nm(rk):
    """имя и фамилия сотрудника стенда (у части — без фамилии)"""
    f = FIRST_NM[rk % len(FIRST_NM)]
    ln = LAST_NM[rk * 5 % len(LAST_NM)]
    return f, (ln + ('а' if f in ('Анна', 'Мария', 'Елена', 'Ольга') else '') if ln else None)


def structure_rows(U, people):
    alive = lambda p, d: p['start'] <= d and (p['end'] is None or d < p['end'])
    for m in months():
        e = eom(m)
        here = defaultdict(list)
        for p in people:
            if alive(p, e):
                here[at(p['unit'], e)].append(p['rk'])
        # поставка 66: признаки дня — последний загруженный день (last_day_flg) и конец полного месяца
        ld, lm_ = int(e == D1), int((e + dt.timedelta(1)).day == 1)
        for u, rks in here.items():
            hd = min(rks)
            for rk in rks:
                nm = person_nm(rk)
                if rk == hd:
                    yield (e, rk, 1, 'h' + u, 'h' + U[u][1] if U[u][1] else None, u, U[u][0]) + nm + (ld, lm_)
                else:
                    yield (e, rk, 0, 'u' + str(rk), 'h' + u, u, U[u][0]) + nm + (ld, lm_)


# ---- правда по людям --------------------------------------------------------
def months():
    m, out = D0, []
    while m <= D1:
        out.append(m); m = dt.date(m.year + m.month // 12, m.month % 12 + 1, 1)
    return out


def eom(m):
    return min(dt.date(m.year, m.month, calendar.monthrange(m.year, m.month)[1]), D1)


def closed_month():
    """поставка 90: последний закрытый месяц (cm ноутбука, teampulse_hub_cal) — последний месяц, если дата данных (D1) —
    его последний день или он январь, иначе месяц перед ним. «С начала года» — январь..cm (стенд: D1 = 12.10 → сентябрь)"""
    lm = months()[-1]
    if lm.month == 1 or D1.day == calendar.monthrange(lm.year, lm.month)[1]:
        return lm
    return dt.date(lm.year - (lm.month == 1), (lm.month - 2) % 12 + 1, 1)


def ytd_months():
    """поставка 106 (владелец): месяцы разбивок и количеств «с начала года» — январь года последнего месяца данных ..
    он сам, вместе с незакрытым (было — январь..cm, поставка 90)"""
    lm = months()[-1]
    return [m for m in months() if m.year == lm.year]


def truth(U, people, perf, grt, pred=lambda p, d: True, agg=False, act=ACTIVE, hday=False):
    """узел (rk) × месяц → меры. Численность — на последний календарный день месяца (у текущего
    неполного — на последний загруженный); ССЧ — полусумма численности узла с прошлым месяцем.
    act — выбранные типы численности (по умолчанию ACTIVE — «Активная»): человек месяца —
    в строке со своим типом на последний день в месяце (как измерения ноутбука), в счёт — только типы
    выбора; найм — по методологии HR: в компанию с типом из выбора и переход кандидата / стажёра в тип
    из выбора из типа вне его. act=None — вся численность, найм — в компанию.
    pred(p, день) — фильтр среза; срез человека в месяце — на его последний день в месяце (измерения
    ноутбука — на конец месяца, DIM_SRC = 'eom')"""
    T = defaultdict(lambda: defaultdict(float))
    ld = lambda p, m: min(eom(m), p['end'] or D1)
    P = lambda p, m: pred(p, ld(p, m))
    # hday (2а, поставка 56) — срез найма на день события: найм в компанию — на день найма, переход кандидата
    # или стажёра — на день перехода; иначе — на конец месяца, как измерения TP 2.0 (файл 2)
    PH = (lambda p, m, d: pred(p, d)) if hday else (lambda p, m, d: P(p, m))
    alive = lambda p, d: p['start'] <= d and (p['end'] is None or d < p['end'])   # в день увольнения уже не в численности
    inA = lambda t: act is None or t in act
    ok = lambda p, m: P(p, m) and inA(at(p['acth'], ld(p, m)))
    ms = months()
    for p in people:
        for m in ms:
            e = eom(m)
            if alive(p, e):
                for n in path(U, at(p['unit'], e)):
                    T[(n, m)]['hc'] += ok(p, m)
                    # активная численность (hc_active_cnt) — тип «Активная» среди выбранных типов
                    T[(n, m)]['act'] += P(p, m) and at(p['acth'], e) in ACTIVE and inA(at(p['acth'], e))
        if p['end']:
            m = dt.date(p['end'].year, p['end'].month, 1)
            for n in path(U, at(p['unit'], p['end'])):
                T[(n, m)]['fire'] += ok(p, m)
                T[(n, m)]['nreg'] += ok(p, m) and p['nonreg']
                T[(n, m)]['reg'] += ok(p, m) and p['regret']    # поставка 65: светофор HQ сверяет и нежелательные
        if p['start'] > D0:
            m = dt.date(p['start'].year, p['start'].month, 1)
            for n in path(U, at(p['unit'], p['start'])):
                T[(n, m)]['hire'] += PH(p, m, p['start']) and inA(at(p['acth'], p['start']))
        for c, fl in (p['conv'] if act else []):   # найм по методологии DD: переход в активную — тоже найм
            if not (inA(at(p['acth'], c)) and not inA(at(p['acth'], c - dt.timedelta(1)))):
                continue                          # переход внутри выбора или вне его — не вход в выбор
            m = dt.date(c.year, c.month, 1)
            # поставка 65: вид — из учебной группы в боевую (hcd) или стажёр в штат (hst)
            kd = 'hcd' if fl == 'transfer_candidate_flg' else 'hst'
            for n in path(U, at(p['unit'], c)):
                T[(n, m)]['hire'] += PH(p, m, c)
                T[(n, m)][kd] += PH(p, m, c)
            # agg — таблица, где люди уже сложены (hr_structure_overall, файл 2): тип активности
            # там на конец месяца, и стажёр, принятый и переведённый в одном месяце, — ещё и в
            # найме в компанию (hire_amt). Разделить без людей нельзя — правда с тем же завышением
            if agg and p['start'] > D0 and (c.year, c.month) == (p['start'].year, p['start'].month):
                for n in path(U, at(p['unit'], p['start'])):
                    T[(n, m)]['hire'] += P(p, m)
        for (d, new), (_, old) in zip(p['unit'][1:], p['unit'][:-1]):
            # «в» — месяц первого дня в новом юните, «из» — месяц последнего дня в старом
            m, mo = dt.date(d.year, d.month, 1), dt.date((d - dt.timedelta(1)).year, (d - dt.timedelta(1)).month, 1)
            pn, po = path(U, new), path(U, old)
            for n in pn:
                if n not in po: T[(n, m)]['tin'] += ok(p, m)
            for n in po:
                if n not in pn: T[(n, mo)]['tout'] += ok(p, mo)
    for m_i, m in enumerate(ms):
        for n in U:
            prev = T[(n, ms[m_i - 1])]['hc'] if m_i else T[(n, m)]['hc']
            T[(n, m)]['ssch'] = (T[(n, m)]['hc'] + prev) / 2
    byrk = {p['rk']: p for p in people}
    last_unit = lambda p, m: at(p['unit'], min(eom(m), p['end'] or D1))
    # поставка 103 (файл 9, п. 1): мониторинг — люди численности на конец месяца, у каждого одна категория (без записи
    # перформанса — «не размечено»): в сумме по категориям — численность
    for (n, m) in list(T.keys()):
        T[(n, m)]['perf'] = T[(n, m)]['hc']
    # поставка 73: решения T-роста — заявки HQ (покраска в день создания), в месяц итога; человек в этом месяце есть в
    # таблице (строка месяца — его последняя)
    for r in grt:
        if r[14] % 23 == 0:            # поставка 103 (2_11): заявка чужой компании — rost_info её отсекает
            continue
        rk_, st, fin = r[0], r[2], r[10]
        m = dt.date(fin.year, fin.month, 1)
        p_ = byrk.get(rk_)
        if r[12] != 'HQ' or p_ is None or m < D0 or not (p_['start'] <= eom(m) and (p_['end'] is None or p_['end'] >= m)) \
                or not ok(p_, m):
            continue
        for n in path(U, last_unit(byrk[rk_], m)):
            T[(n, m)]['grt'] += 1
            T[(n, m)]['grt2'] += st in ('FNS', 'DCL')
    return T


def truth_trf(U, people, pred=lambda p, d: True, act=ACTIVE, chg=()):
    """переводы под фильтры (21.10, заказчик): переход — день, когда у человека сменился юнит или
    срез (покраска, IT-код, штат, тип численности). Выбор — узел и фильтры (pred, типы численности act;
    None — все). В выбор — вчера человек был вне выбора, сегодня внутри; из выбора — наоборот. Месяц —
    дня перехода. В выбор — не в день перевода стажёра в штат / учебной группы в боевую (кандидат и стажёр
    из «в» исключаются всегда, как в transfers.yaml мастер-отчёта; поставка 63).
    chg — история атрибутов, по которым стоит фильтр ('operh', 'ith', 'relh', 'acth'): смена такого атрибута,
    когда человек и вчера, и сегодня внутри выбора (Подрядчики → Активная при «Активная + Подрядчики»), — и
    «из», и «в»: мастер-отчёт считает флаг смены как есть (сверено на выгрузке 22.10, поставка 63)"""
    T = defaultdict(lambda: defaultdict(float))
    root = ['all'] if ROOTS > 1 else []
    F = lambda p, d: pred(p, d) and (act is None or at(p['acth'], d) in act)
    # поставка 64: «напрямую в юните» — свой узел (юнит + ':d'): люди в самом юните, без его подразделений
    own = lambda u: path(U, u) + [u + ':d']
    for p in people:
        last = p['end'] or D1
        conv = {c for c, _ in p['conv']}
        for d in sorted({d for k in ('unit', 'acth', 'operh', 'ith', 'relh') for d, _ in p[k][1:]}):
            if not (max(p['start'], D0) < d <= last):
                continue
            a = d - dt.timedelta(1)
            pa, pb = root + own(at(p['unit'], a)), root + own(at(p['unit'], d))
            fa, fb = F(p, a), F(p, d)
            m = dt.date(d.year, d.month, 1)
            for n in set(pa) | set(pb):
                ia, ib = n in pa and fa, n in pb and fb
                if ib and not ia and d not in conv:              # кандидат/стажёр — не перевод
                    T[(n, m)]['tin'] += 1
                if ia and not ib:
                    T[(n, m)]['tout'] += 1
                if ia and ib and any(at(p[k], a) != at(p[k], d) for k in chg):
                    T[(n, m)]['tout'] += 1
                    if d not in conv:
                        T[(n, m)]['tin'] += 1
    return T


def truth_spec_move(U, people, rk, pred=lambda p, d: True, act=ACTIVE, chg=()):
    """31.10, п. 7 и 10; поставка 90 (заказчик): переводы по специализациям узла rk — по флагам переводов под фильтры (как
    truth_trf: вход в узел и выбор, выход из них, смена атрибута, по которому стоит фильтр) ИЛИ по флагу смены
    специализации внутри выбора; одно событие — один перевод. «В» — в специализацию первого дня нового состояния, «из» —
    из специализации последнего дня старого; кандидат или стажёр в «в» не идёт, кроме смены специализации. Так
    «на начало + найм + переводы в − отток − переводы из = на конец» сходится по каждой специализации и в ИТОГО.
    Месяц — день события (последний день старого состояния в конце месяца — уже следующий). С января по дату данных
    (поставка 106; было — по cm).
    Поставка 103 (файл 9, п. 9): tsi / tso — только перевод юнита уровня узла (узел в пути нового дня и не в пути старого:
    флаг юнита этого уровня), строка проходит фильтры; остальное из прежнего правила — tci / tco («внутри юнита»)"""
    lm = months()[-1]
    out = {'tsi': defaultdict(float), 'tso': defaultdict(float)}
    lvl = {'tsi': defaultdict(float), 'tso': defaultdict(float)}
    inu = lambda p, d: rk != 'all' and rk in path(U, at(p['unit'], d))
    F = lambda p, d: pred(p, d) and (act is None or at(p['acth'], d) in act)
    inn = lambda p, d: F(p, d) and (rk == 'all' or rk in path(U, at(p['unit'], d)))
    for p in people:
        last = p['end'] or D1
        conv = {c for c, _ in p['conv']}
        ch = sp_change(p)
        days = {d for k in ('unit', 'acth', 'operh', 'ith', 'relh') for d, _ in p[k][1:]} | ({ch[0]} if ch else set())
        for d in sorted(days):
            if not (max(p['start'], D0) < d <= last):
                continue
            m = dt.date(d.year, d.month, 1)
            if not (m.year == lm.year and m <= lm):
                continue
            a = d - dt.timedelta(1)
            ia, ib, sa, sb = inn(p, a), inn(p, d), spec_at(p, a), spec_at(p, d)
            if inu(p, d) and not inu(p, a) and F(p, d) and d not in conv:
                lvl['tsi'][sb] += 1
            if inu(p, a) and not inu(p, d) and F(p, a):
                lvl['tso'][sa] += 1
            if ib and not ia:
                if d not in conv:
                    out['tsi'][sb] += 1
            elif ia and not ib:
                out['tso'][sa] += 1
            elif ia and ib and (sa != sb or any(at(p[k], a) != at(p[k], d) for k in chg)):
                out['tso'][sa] += 1
                if sa != sb or d not in conv:
                    out['tsi'][sb] += 1
    res = {k: {v: n for v, n in lvl[k].items() if n} for k in lvl}
    for k, c in (('tsi', 'tci'), ('tso', 'tco')):
        res[c] = {v: n - lvl[k].get(v, 0) for v, n in out[k].items() if n - lvl[k].get(v, 0)}
    return res


def truth_fire_init(U, people, rk, pred=lambda p, d: True, act=ACTIVE):
    """26.10-б: увольнения узла rk по инициатору и месяцу за всю сетку — {«инициатор|ГГГГ-ММ»: число}; срез и тип —
    на день ухода, как увольнения в truth"""
    out = defaultdict(float)
    for p in people:
        if not p['end']:
            continue
        m = dt.date(p['end'].year, p['end'].month, 1)
        last = min(eom(m), p['end'])
        if not (pred(p, last) and (act is None or at(p['acth'], last) in act)):
            continue
        if rk in path(U, at(p['unit'], p['end'])):
            out[(p['init'] or '') + '|' + m.strftime('%Y-%m')] += 1
    return dict(out)


def truth_office(U, people, office, pred=lambda p, d: True, act=ACTIVE):
    """поставка 66 (посещения Адели), правда по людям под фильтры (pred, типы численности act; None — все):
    T  (узел, месяц) → рабочие дни (wday), посещения (ovis), бронирования (bk — дней с бронью, bkv — бронь без
       посещения, vsv — посещение без брони), рабочие дни и посещения руководителей (hwd, hov);
    Dd (узел, день) с месяца перед последним закрытым по текущий (поставка 90) → dw (люди с рабочим днём), do (из них в офисе);
    C  узел → {'oc': {город: посещений}, 'ocp': {город: людей}} за последний закрытый месяц (поставка 90);
    MH узел → {'1': руководителей, '0': остальных} — численность на конец последнего месяца.
    Человек месяца — его последняя строка в месяце (last_row_flg): юнит, срез и признак руководителя — на последний
    день в месяце, как у посещений в with_office_traffic и календаря office_traffic"""
    T, Dd = defaultdict(lambda: defaultdict(float)), defaultdict(lambda: defaultdict(float))
    C = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    MH = defaultdict(lambda: defaultdict(float))
    H = heads(U, people)
    byrk = {p['rk']: p for p in people}
    root = ['all'] if ROOTS > 1 else []
    ms = months()
    lm, cm = ms[-1], closed_month()
    two = set(ms[ms.index(cm) - 1:])
    ld = lambda p, m: min(eom(m), p['end'] or D1)
    ok = lambda p, m: pred(p, ld(p, m)) and (act is None or at(p['acth'], ld(p, m)) in act)
    nodes = lambda p, d: root + path(U, at(p['unit'], d))
    city = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    vcity = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    for r in office:
        d, rk, wd, ov, bk, bkv, vsv, cty = r[:8]
        rn, emp, fix, dact = r[11:15]
        p, m = byrk[rk], dt.date(d.year, d.month, 1)
        # поставка 107, база мастера: активная численность дня; посещаемость — закреплённый офис, визит — главный офис дня
        # (rn = 1), рабочий день — строки rn <= 1; фиксы — то же у fix_flex_cat = 'фикс'; брони — с определённым нарушением
        if dact != 'Активная' or not ok(p, m):
            continue
        E = emp == 'Да'
        wdx, ovx = int(E and rn <= 1) * wd, int(E and rn == 1) * ov
        fwx, fox = int(fix == 'фикс' and rn <= 1) * wd, int(fix == 'фикс' and rn == 1) * ov
        bkx, bvx = (bk if bkv is not None else 0), (bkv or 0)
        vsx = (vsv or 0) if E and rn == 1 else 0
        vbx = ov if E and rn == 1 and vsv == 0 else 0
        last = ld(p, m)
        hf = head_flg(H, p, last)
        for n in nodes(p, last):
            t = T[(n, m)]
            t['wday'] += wdx; t['ovis'] += ovx; t['bk'] += bkx; t['bkv'] += bvx; t['vsv'] += vsx
            t['fwday'] += fwx; t['fovis'] += fox; t['vbk'] += vbx
            t['hwd'] += wdx * hf; t['hov'] += ovx * hf
            if m in two and E:
                Dd[(n, d)]['dw'] += int(rn <= 1)
                Dd[(n, d)]['do'] += int(rn == 1) * ov
        if m == cm and cty:
            city[rk][cty]['vis'] += ovx
            city[rk][cty]['wd'] += wdx
            # 27.10-в, п. 14: нарушения брони по городу (ov) и база (ob) — последнего закрытого месяца (поставка 90)
            vcity[rk][cty]['ov'] += bvx + vsx
            vcity[rk][cty]['ob'] += bkx + vsx
    for rk, cs in city.items():
        p = byrk[rk]
        for n in nodes(p, ld(p, cm)):
            for c, v in cs.items():
                C[n]['oc'][c] += v['vis']
                C[n]['ocp'][c] += int(v['vis'] > 0)
                C[n]['ocd'][c] += v['wd']
    for rk, cs in vcity.items():
        p = byrk[rk]
        for n in nodes(p, ld(p, cm)):
            for c, v in cs.items():
                C[n]['ov'][c] += v['ov']
                C[n]['ob'][c] += v['ob']
    e = eom(lm)
    for p in people:
        if p['start'] <= e and (p['end'] is None or e < p['end']) and ok(p, lm):
            for n in nodes(p, e):
                MH[n][str(head_flg(H, p, e))] += 1
    return T, Dd, C, MH


def mon_month(md):
    """поставка 71: мониторинг человека за месяц, как performance_metric_d_aggr Адели: средние часы рабочего дня и звонков
    по плановым дням, прогулы, работа в выходной, доля разговоров и сегменты"""
    from decimal import Decimal, ROUND_HALF_UP
    A = defaultdict(lambda: [0.0, 0, 0, 0, 0.0])
    for rk, d, dur, plan, bal, talk, *_ in md:
        a = A[(rk, dt.date(d.year, d.month, 1))]
        if plan:
            a[0] += dur; a[1] += 1; a[4] += talk
        a[2] += bal == -1; a[3] += bal == 1
    out = {}
    for k, (ds, pd, ab, wo, ts) in A.items():
        dur = ds / pd if pd else 0.0
        sh = float(Decimal(100.0 * ts / ds).quantize(Decimal('0.1'), ROUND_HALF_UP)) if pd and ds else 0.0
        out[k] = dict(dur=dur, talk=ts / pd if pd else 0.0, ab=ab, wo=wo,
                      ts='нет данных' if dur <= 0 else 'до 20%' if sh < 20 else '20-30%' if sh <= 30 else
                         '30-50%' if sh <= 50 else '50%+',
                      as_='0-1' if ab <= 1 else '2-5' if ab <= 5 else '5+', ws='0-1' if wo <= 1 else '2-5' if wo <= 5 else '5+')
    return out


def truth_mon(U, people, mm, pred=lambda p, d: True, act=ACTIVE):
    """поставка 71: ряды мониторинга по дням — узел × месяц: ab25 ab5 we25 we5 t23 t35 t5 (люди в сегментах), hrs, hrn,
    tlk (сумма средних часов дня и звонков по людям с часами, сколько таких людей). Человек месяца — его последняя строка
    (юнит и срез на последний день в месяце), как перформанс"""
    T = defaultdict(lambda: defaultdict(float))
    root = ['all'] if ROOTS > 1 else []
    byrk = {p['rk']: p for p in people}
    for (rk, m), x in mm.items():
        p = byrk[rk]
        d = min(eom(m), p['end'] or D1)
        if not (pred(p, d) and (act is None or at(p['acth'], d) in act)):
            continue
        for n in root + path(U, at(p['unit'], d)):
            t = T[(n, m)]
            t['ab25'] += x['as_'] == '2-5'; t['ab5'] += x['as_'] == '5+'
            t['we25'] += x['ws'] == '2-5'; t['we5'] += x['ws'] == '5+'
            t['t23'] += x['ts'] == '20-30%'; t['t35'] += x['ts'] == '30-50%'; t['t5'] += x['ts'] == '50%+'
            if x['dur'] > 0:
                t['hrs'] += x['dur']; t['hrn'] += 1; t['tlk'] += x['talk']
    return T


MPW = 16          # поставка 108: KPI мониторинга — за столько последних полных недель (как MPW в hub_sql.py)


def mon_period(md):
    """поставка 108: период KPI мониторинга — MPW полных недель (пн–вс), конец — последнее воскресенье не позже последнего
    дня дневного источника (и не позже даты данных D1)"""
    mx = max(d for _, d, *_ in md if d <= D1)
    we = mx - dt.timedelta((mx.weekday() + 1) % 7)
    return we - dt.timedelta(MPW * 7 - 1), we


def truth_monp(U, people, md, pred=lambda p, d: True, act=ACTIVE):
    """поставка 108: KPI мониторинга за период (mon_period) по людям — узел → {'mp': {hc ab25 ab5 we25 we5 t23 t35 t5},
    'mpd': {'начало|конец': людей}}. Человек — в численности месяца конца периода (на его последний день, как hc_total_cnt
    с eom_flg; юнит, срезы и тип — на этот день). Прогулы и работа в выходные — дни за весь период (2–5, больше 5);
    звонки — 100 × часы звонков ÷ рабочие часы по плановым дням периода, до 0,1 (20–30, 30–50, больше 50; без часов —
    не в звонках)"""
    from decimal import Decimal, ROUND_HALF_UP
    ws, we = mon_period(md)
    A = defaultdict(lambda: [0, 0, Decimal(0), Decimal(0)])
    for rk, d, dur, plan, bal, talk, *_ in md:
        if ws <= d <= we:
            a = A[rk]
            a[0] += bal == -1; a[1] += bal == 1
            if plan:
                a[2] += Decimal(str(dur)); a[3] += Decimal(str(talk))
    e = eom(dt.date(we.year, we.month, 1))
    root = ['all'] if ROOTS > 1 else []
    T = defaultdict(lambda: {'mp': defaultdict(float), 'mpd': defaultdict(float)})
    key = f'{ws}|{we}'
    for p in people:
        if not (p['start'] <= e and (p['end'] is None or e < p['end'])):
            continue
        if not (pred(p, e) and (act is None or at(p['acth'], e) in act)):
            continue
        ab, wo, ds, ts = A[p['rk']] if p['rk'] in A else (0, 0, Decimal(0), Decimal(0))
        sh = float((100 * ts / ds).quantize(Decimal('0.1'), ROUND_HALF_UP)) if ds > 0 else None
        x = {'hc': 1, 'ab25': 2 <= ab <= 5, 'ab5': ab > 5, 'we25': 2 <= wo <= 5, 'we5': wo > 5,
             't23': sh is not None and 20 <= sh <= 30, 't35': sh is not None and 30 < sh <= 50, 't5': sh is not None and sh > 50}
        for n in root + path(U, at(p['unit'], e)):
            for k, v in x.items():
                T[n]['mp'][k] += int(v)
            T[n]['mpd'][key] += 1
    return {n: {k: {v: c for v, c in d.items() if c} for k, d in t.items()} for n, t in T.items()}


def truth_age(U, people, rk, pred=lambda p, d: True, act=ACTIVE):
    """поставка 73: разрез e узла rk — возраст в годах → людей численности последнего месяца"""
    e, out = eom(months()[-1]), defaultdict(float)
    for p in people:
        if p['start'] <= e and (p['end'] is None or e < p['end']) and pred(p, e) \
                and (act is None or at(p['acth'], e) in act) and (rk == 'all' or rk in path(U, at(p['unit'], e))):
            out[str(age_num(p))] += 1
    return dict(out)


def truth_rost(U, people, grt, rk, pred=lambda p, d: True, act=ACTIVE):
    """поставка 73 (эталон «Роста»): разрезы T-роста узла rk — rm (заявки с итогом по месяцам итога), rq (успешность по
    желаемому за окно — поставка 90: январь..последний закрытый месяц), rs (статус роста людей численности последнего
    месяца по заявкам того же окна). Заявки —
    только HQ (покраска в день создания); юнит и срез заявки — человека в месяце начала (старт согласования, иначе
    создание), как structure_x_rost; тип — s, если меняется специализация, иначе g"""
    byrk = {p['rk']: p for p in people}
    ms = months()
    lm, g0, cm = ms[-1], ms[0], closed_month()
    cm = lm                                       # поставка 106: окно rq / rs — январь..дата данных (было январь..cm)
    w12 = dt.date(cm.year, 1, 1)
    mon = lambda t: dt.date(t.year, t.month, 1)
    ok = lambda p, d: pred(p, d) and (act is None or at(p['acth'], d) in act)
    inn = lambda u: rk == 'all' or rk in path(U, u)
    has_row = lambda p, m: m >= D0 and p['start'] <= eom(m) and (p['end'] is None or p['end'] >= m)
    tp = lambda r: 's' if r[7] != r[8] else 'g'
    out = {'rm': defaultdict(float), 'rq': defaultdict(float), 'rs': defaultdict(float)}
    hq = [r for r in grt if r[12] == 'HQ' and r[14] % 23 != 0]   # поставка 103: без заявок чужой компании (2_11)
    for r in hq:
        p, am, fm = byrk[r[0]], mon(r[11] or r[1]), mon(r[10])
        res = 'ok' if r[2] == 'FNS' else 'no' if r[2] == 'DCL' else None
        if res is None or not has_row(p, am):
            continue
        d = min(eom(am), p['end'] or D1)
        if not ok(p, d) or not inn(at(p['unit'], d)):
            continue
        tat = '1' if r[9] is not None else '0'
        if g0 <= fm <= lm:
            out['rm'][f"{fm:%Y-%m}|{tp(r)}|{tat}|{res}"] += 1
        if w12 <= fm <= cm:
            # поставка 81: пятое поле — текущее (откуда переходят)
            out['rq'][f"{tp(r)}|{tat}|{res}|{r[6] if tp(r) == 'g' else SPECS[r[8] - 1]}|"
                      f"{r[5] if tp(r) == 'g' else SPECS[r[7] - 1]}"] += 1
    e = eom(lm)
    win = defaultdict(list)
    for r in hq:
        if w12 <= mon(r[10]) <= cm:
            win[r[0]].append(r)
    for p in people:
        if not (p['start'] <= e and (p['end'] is None or e < p['end']) and ok(p, e) and inn(at(p['unit'], e))):
            continue
        a = win.get(p['rk'], [])
        okA = [r for r in a if r[2] == 'FNS']
        acA = [r for r in a if r[2] not in ('FNS', 'DCL', 'CNL')]
        dcA = [r for r in a if r[2] == 'DCL']
        g_ = lambda L: any(tp(r) == 'g' for r in L)
        if acA:
            st, t = ('again' if okA else 'first'), 'g' if g_(acA) else 's'
        elif okA:
            st = 'done'
            t = 'gs' if g_(okA) and any(tp(r) == 's' for r in okA) else 'g' if g_(okA) else 's'
        elif dcA:
            st, t = 'denied', 'g' if g_(dcA) else 's'
        else:
            st, t = 'none', 'av' if SPEC_GROW[p['spec']] else 'nd'
        out['rs'][f"{st}|{t}|{at(p['grade'], e)}"] += 1
    return {k: dict(v) for k, v in out.items()}



# ---- прогон ноутбука ----------------------------------------------------------
def paragraphs():
    d = yaml.safe_load(open(YAML, encoding='utf-8'))
    return {p['title']: p.get('code') or '' for p in d['paragraphs']}


def run_notebook(pg, fix):
    P = paragraphs()
    dal = types.SimpleNamespace(get_df=lambda datasource, query: pg.run(query))
    sys.modules['dal_client'] = types.SimpleNamespace(query=dal)
    ns = {'__name__': 'nb'}
    exe = lambda title: exec(patch(title, P[title], fix), ns)
    sql = lambda title: pg.run(patch(title, P[title], fix))
    exe('_PARAMS_'); exe('build_all_metrics'); exe('EXEC build_all_metrics')
    sql('with_performance'); sql('with_office_traffic'); sql('with_TRost')
    exe('group_and_sum_metrics'); exe('EXEC group'); exe('calc_ssch'); exe('EXEC calc_ssch')
    return pg.run('SELECT * FROM hr_structure_with_ssch')


# Правки — те же, что в «Предложения — физическая таблица под датасет.md», часть 1. Шаг k
# включает правки 1…k: (шаг, параграф, было, стало)
FIX = [
    # 1. численность — на последний календарный день месяца (у неполного — на последний
    #    загруженный); уволенный в этот день уже не в численности. Прежний признак «последняя
    #    строка человека в месяце» остаётся как last_row_flg: к нему шаг 3 цепляет перформанс,
    #    посещаемость и T-рост (одна строка на человека и месяц)
    (1, 'build_all_metrics', "    snap.append('row_number() OVER w_eom AS rn')",
     "    snap.append('row_number() OVER w_eom AS rn')\n"
     "    snap.append(\"(calendar_dt::date = least((date_trunc('month', calendar_dt) + interval '1 month' - interval '1 day')::date, \"\n"
     "                f\"(SELECT max(calendar_dt)::date FROM {source_table}))\"\n"
     "                + (\" AND coalesce(fire_flg::text,'0') <> '1'\" if has('fire_flg') else '') + ')::int AS eom_flg')"),
    (1, 'build_all_metrics', "    m = ['max((rn = 1)::int) AS hc_total_cnt']",
     "    m = ['max((rn = 1 AND eom_flg = 1)::int) AS hc_total_cnt', 'max((rn = 1)::int) AS last_row_flg']"),
    (1, 'build_all_metrics', "        m.append(\"max((rn = 1 AND active_type_gr_nm = 'Активная')::int) \"",
     "        m.append(\"max((rn = 1 AND eom_flg = 1 AND active_type_gr_nm = 'Активная')::int) \""),
    (1, 'group_and_sum_metrics', "    'mdm_employee_rk', 'leaf_lvl', 'lvl', 'parent_lvl', 'rn',",
     "    'mdm_employee_rk', 'leaf_lvl', 'lvl', 'parent_lvl', 'rn', 'last_row_flg',"),
    # 2. заявки T-роста — сначала сумма по человеку и месяцу: иначе две заявки — две копии всей
    #    строки человека (численность, найм, увольнения тоже вдвое)
    (2, 'with_TRost', "select m.* \n    , coalesce(o.is_approved, 0) as grt_approve_cnt",
     ", grt_month as (\n    select mdm_employee_rk, month, sum(is_approved) as is_approved, sum(is_declined) as is_declined,\n"
     "           sum(is_cancelled) as is_cancelled, sum(is_inprogress) as is_inprogress\n"
     "    from grt_application group by mdm_employee_rk, month\n)\n"
     "select m.* \n    , coalesce(o.is_approved, 0) as grt_approve_cnt"),
    (2, 'with_TRost', "left join grt_application o \n    on o.month = m.report_month \n    and o.mdm_employee_rk = m.mdm_employee_rk",
     "left join grt_month o \n    on o.month = m.report_month \n    and o.mdm_employee_rk = m.mdm_employee_rk"),
    # 3. перформанс, посещаемость, T-рост — к одной строке человека в месяце: у перешедшего
    #    в месяце строк две (старый и новый юнит)
    (3, 'with_performance', "    on nm.mdm_employee_rk = perf.mdm_employee_rk and perf.calendar_dt = nm.report_month--::date",
     "    on nm.mdm_employee_rk = perf.mdm_employee_rk and perf.calendar_dt = nm.report_month--::date\n    and nm.last_row_flg = 1"),
    (3, 'with_office_traffic', "    and o.mdm_employee_rk = m.mdm_employee_rk",
     "    and o.mdm_employee_rk = m.mdm_employee_rk\n    and m.last_row_flg = 1"),
    (3, 'with_TRost', "left join grt_month o \n    on o.month = m.report_month \n    and o.mdm_employee_rk = m.mdm_employee_rk",
     "left join grt_month o \n    on o.month = m.report_month \n    and o.mdm_employee_rk = m.mdm_employee_rk\n    and m.last_row_flg = 1"),
    # 4. уровень перевода — в ключ сводной таблицы: узел уровня L берёт переводы с уровнем ≤ L
    (4, 'EXEC group', "    fields=fields,", "    fields=fields + ['transfer_in_lvl', 'transfer_out_lvl'],"),
    # 5. ключи пути рядом с именами (rk уровней в snap уже есть — их просто не выводили)
    # 6. IT-код — как в источнике: IT, Digital, NonIT (три покраски, не сводятся). «Активная» — тип «Активная», без
    #    подрядчиков (поставка 61; в 60 — Активная + Подрядчики, как в TP 2.0; с 26 до 59 — флаг active_count_flg)
    (6, '_PARAMS_', """    {'alias': 'active_type_gr_nm',
     'cols': ['active_type_nm'],
     'expr': "CASE WHEN active_type_nm IN ('Активная','Подрядчики') "
             "THEN 'Активная' ELSE 'Прочие' END"},
    {'alias': 'emp_specialization_it_code',
     'cols': ['emp_specialization_it_code'],
     'expr': "CASE WHEN emp_specialization_it_code = 'IT' "
             "THEN 'IT' ELSE 'nonIT' END"},""",
     """    # «Активная» — тип численности «Активная», подрядчики в неё не входят (22.10, поставка 61; в TP 2.0 —
    # Активная + Подрядчики). Тип численности целиком — колонка act_type_nm (HUB_FIELDS): по ней фильтр отчёта,
    # «Активная» — выбор по умолчанию, подрядчиков и другие типы добавляют в фильтре
    {'alias': 'active_type_gr_nm',
     'cols': ['active_type_nm'],
     'expr': "CASE WHEN active_type_nm = 'Активная' "
             "THEN 'Активная' ELSE 'Прочие' END"},
    # IT-код — как в источнике: IT, Digital, NonIT — три разные покраски, не сводятся
    {'alias': 'emp_specialization_it_code',
     'cols': ['emp_specialization_it_code'],
     'expr': "coalesce(emp_specialization_it_code::text, '-')"},"""),
    (6, 'build_all_metrics', """    for d_ in FIXED_DIMS:
        if all(has(c) for c in d_['cols']):
            add_dim(d_['expr'], _ident(d_['alias']))
        else:
            print(f"[WARN] {d_['alias']}: нет колонок {d_['cols']}, пропущено")""",
     """    for d_ in FIXED_DIMS:
        if d_['alias'] in dim_keys:
            continue                       # первый подходящий вариант уже взят
        if all(has(c) for c in d_['cols']):
            add_dim(d_['expr'], _ident(d_['alias']))
            print(f"[INFO] {d_['alias']}: по {d_['cols']}")
        else:
            print(f"[INFO] {d_['alias']}: нет колонок {d_['cols']} — следующий вариант")"""),
    (6, 'group_and_sum_metrics', """        if alias in all_set and alias not in path_set:
            fixed_keys.append(alias)""",
     """        if alias in all_set and alias not in path_set and alias not in fixed_keys:
            fixed_keys.append(alias)"""),
    (5, 'build_all_metrics', "            nm_agg.append(f'max(lvl{i}_nm) AS lvl{i}_nm')",
     "            nm_agg.append(f'max(lvl{i}_nm) AS lvl{i}_nm')\n            nm_agg.append(f'max(lvl{i}_rk) AS lvl{i}_rk')"),
]
STEPS = ['как есть', '1 численность на конец месяца', '2 заявки T-роста суммой', '3 перформанс и др. — к одной строке',
         '4 уровень перевода в ключе', '5 ключи пути', '6 IT — три значения']


def patch(title, code, k):
    for step, t, old, new in FIX:
        if step <= k and t == title:
            assert code.count(old) == 1, (title, old[:60])
            code = code.replace(old, new)
    return code


# ---- сверка ---------------------------------------------------------------------
def nodes_of(df):
    """строка таблицы → узлы по началу пути (как датасет): ключи имён → rk симуляции"""
    out = []
    for r in df.itertuples(index=False):
        names = [getattr(r, f'lvl{i}_nm') for i in range(1, int(r.leaf_lvl) + 1)]
        out.append(names)
    return out


def compare(U, T, df, fix, quiet=False):
    name2rk = {}
    for k in U:
        name2rk[tuple(U[x][0] for x in path(U, k))] = k
    depth = {k: len(path(U, k)) for k in U}
    G = defaultdict(lambda: defaultdict(float))
    num = [c for c in df.columns if c.endswith(('_cnt', '_amt', '_lvl')) or c.startswith('perf_')]
    df = df.copy()
    df[num] = df[num].apply(pd.to_numeric).astype(float).fillna(0)
    for r, names in zip(df.itertuples(index=False), nodes_of(df)):
        m = pd.Timestamp(r.report_month).date()
        for d in range(1, len(names) + 1):
            n = name2rk[tuple(names[:d])]
            g = G[(n, m)]
            g['hc'] += r.hc_total_cnt or 0
            g['act'] += r.hc_active_cnt or 0
            g['fire'] += r.fire_amt or 0
            g['hire'] += r.hire_amt or 0
            g['ssch'] += float(r.ssch_hc_active_cnt or 0)
            g['perf'] += (r.perf_normal or 0) + (r.perf_low or 0) + (r.perf_high or 0) + (r.perf_gray or 0)
            g['grt'] += (r.grt_approve_cnt or 0) + (r.grt_decline_cnt or 0) + (r.grt_cancel_cnt or 0) + (r.grt_inprogress_cnt or 0)
            if 'transfer_in_lvl' in df.columns:   # переводы через границу узла: уровень не глубже узла
                g['tin'] += (r.transfer_in_amt or 0) * (1 <= (r.transfer_in_lvl or 0) <= d)
                g['tout'] += (r.transfer_out_amt or 0) * (1 <= (r.transfer_out_lvl or 0) <= d)
            else:
                g['tin'] += r.transfer_in_amt or 0
                g['tout'] += r.transfer_out_amt or 0
    allm = months()
    for n in U:                               # ССЧ из ряда активной узла — так считает датасет (поставка 25)
        for i, m in enumerate(allm):
            prev = G[(n, allm[i - 1])]['act'] if i else G[(n, m)]['act']
            G[(n, m)]['ssch_ds'] = (G[(n, m)]['act'] + prev) / 2
            T[(n, m)]['ssch_ds'] = T[(n, m)]['ssch']
    ms = allm[1:-1]                           # без первого (нет лага) и текущего неполного
    keys = ['hc', 'act', 'ssch', 'ssch_ds', 'hire', 'fire', 'tin', 'tout', 'perf', 'grt']
    names = {'hc': 'численность (hc_total_cnt)', 'act': 'активная (hc_active_cnt)', 'ssch': 'ССЧ из колонки таблицы',
             'ssch_ds': 'ССЧ из ряда узла',
             'hire': 'найм', 'fire': 'увольнения', 'tin': 'переводы в узел', 'tout': 'переводы из узла',
             'perf': 'перформанс, человеко-месяцы', 'grt': 'заявки T-роста'}
    if not quiet:
        print(f"\n{STEPS[fix] if fix else 'НОУТБУК КАК ЕСТЬ'}: таблица против правды по людям, {ms[0]:%m.%Y}–{ms[-1]:%m.%Y}")
        print(f"{'':30}{'компания':>18}{'блоки (ур. 3)':>18}{'макс. откл. узла':>18}")
    res = {}
    for k in keys:
        def dev(nodes):
            got = sum(G[(n, m)][k] for n in nodes for m in ms)
            exp = sum(T[(n, m)][k] for n in nodes for m in ms)
            return got, exp
        cg, ce = dev(['11'])
        bg, be = dev([n for n in U if depth[n] == 3])
        worst = max((abs(G[(n, m)][k] - T[(n, m)][k]) / max(T[(n, m)][k], 1), n, m) for n in U for m in ms)
        pct = lambda g, e: f'{(g / e - 1) * 100:+.1f}%' if e else ('0 = 0' if not g else f'{g:.0f} при 0')
        if not quiet:
            print(f'{names[k]:30}{pct(cg, ce):>18}{pct(bg, be):>18}{worst[0] * 100:>17.0f}%')
        res[k] = (pct(cg, ce), pct(bg, be))
    return res


CH_TYPE = {'date': 'Date', 'integer': 'Int64', 'bigint': 'Int64', 'smallint': 'Int64', 'numeric': 'Float64',
           'double precision': 'Float64', 'real': 'Float64', 'boolean': 'UInt8'}


def gp_to_click_mock(pg, out):
    """gp_to_click стенда: таблица PostgreSQL → chdb (<out>/db) под именем ClickHouse; все колонки
    Nullable — худший случай выгрузки"""
    def gp_to_click(gp_table, clickhouse_table):
        from chdb import session
        info = pg.run(f"select column_name, data_type from information_schema.columns "
                      f"where table_name = '{gp_table}' order by ordinal_position")
        cols = [(c, CH_TYPE.get(t, 'String')) for c, t in zip(info.column_name, info.data_type)]
        sel = ', '.join(f'{c}::text' if t == 'String' else c for c, t in cols)
        buf = io.StringIO()
        pg.c.cursor().copy_expert(f"COPY (SELECT {sel} FROM {gp_table}) TO STDOUT WITH (FORMAT csv, NULL '\\N')", buf)
        os.makedirs(out, exist_ok=True)
        csv = os.path.join(out, gp_table + '.csv')
        open(csv, 'w', encoding='utf-8').write(buf.getvalue())
        schema = ', '.join(f'{c} Nullable({t})' for c, t in cols)
        db, _, tb = clickhouse_table.rpartition('.')
        s = session.Session(os.path.join(out, 'db'))
        s.query(f'CREATE DATABASE IF NOT EXISTS {db}')
        s.query(f'DROP TABLE IF EXISTS {clickhouse_table}')
        s.query(f'CREATE TABLE {clickhouse_table} ({schema}) ENGINE = MergeTree ORDER BY tuple()')
        s.query(f"INSERT INTO {clickhouse_table} SELECT * FROM file('{csv}', CSV, '{schema}')")
        n = str(s.query(f'SELECT count() FROM {clickhouse_table}', 'TSV')).strip()
        s.close()
        print(f'  [click] {gp_table} → {clickhouse_table}: {n} строк')
    return gp_to_click


def run_yaml(pg, path, out, skip=('vacancy_daily',)):
    """ноутбук целиком, параграфы сверху вниз (md и skip — мимо); внешние сервисы — подмены"""
    d = yaml.safe_load(open(path, encoding='utf-8'))
    dal = types.SimpleNamespace(get_df=lambda datasource, query: pg.run(query))
    sys.modules['dal_client'] = types.SimpleNamespace(query=dal)
    sys.modules['tactuality'] = types.SimpleNamespace(tables_wait=lambda **kw: None)
    ch = types.SimpleNamespace(gp_to_click=gp_to_click_mock(pg, out), set_table_owners=lambda **kw: None,
                               get_table_owners=lambda **kw: [], delete_table_owners=lambda **kw: None)
    pp = types.ModuleType('proteus_py'); pp.database = types.ModuleType('proteus_py.database')
    pp.database.clickhouse = ch
    sys.modules.update({'proteus_py': pp, 'proteus_py.database': pp.database, 'proteus_py.database.clickhouse': ch})
    import time as _t
    ns = {'__name__': 'nb', 'time': types.SimpleNamespace(sleep=lambda s: None)}
    for p in d['paragraphs']:
        if not p.get('isEnabled', True) or p['shebang'] == 'md' or p['title'] in skip:
            continue
        code = p.get('code') or ''
        t0 = _t.time()
        if p['shebang'] == 'gp':
            pg.run(code)
        else:
            exec(code.replace('import time\n', ''), ns)
        print(f"  ✓ {p['title']} ({_t.time() - t0:.1f} с)")


def to_chdb(pg, out):
    """hr_structure_with_ssch → chdb, схема и порядок колонок разведки 16.10 (stand/load_hso.py)"""
    from chdb import session
    src = open(os.path.join(HERE, 'load_hso.py'), encoding='utf-8').read()
    schema = re.search(r'SCHEMA = f"""(.*?)"""', src, re.S).group(1)
    schema = schema.replace('{LVL}', ', '.join(f'lvl{i}_nm Nullable(String)' for i in range(1, 12)))
    cols = [c.strip().split(' ')[0] for c in schema.replace('\n', ' ').split(',') if c.strip()]
    have = set(pg.run('SELECT * FROM hr_structure_with_ssch LIMIT 0').columns)
    os.makedirs(out, exist_ok=True)
    csv = os.path.join(out, 'hso.csv')
    buf = io.StringIO()
    sel = ', '.join(c if c in have else f'NULL AS {c}' for c in cols)
    pg.c.cursor().copy_expert(f'COPY (SELECT {sel} FROM hr_structure_with_ssch) TO STDOUT WITH CSV', buf)
    open(csv, 'w', encoding='utf-8').write(buf.getvalue())
    s = session.Session(os.path.join(out, 'db'))
    s.query('CREATE DATABASE IF NOT EXISTS prod_proteus')
    s.query('DROP TABLE IF EXISTS prod_proteus.hr_structure_overall')
    s.query(f'CREATE TABLE prod_proteus.hr_structure_overall ({schema}) ENGINE = MergeTree ORDER BY tuple()')
    s.query(f"INSERT INTO prod_proteus.hr_structure_overall SELECT * FROM file('{csv}', CSV, '{schema}')")
    print('  → chdb', out, str(s.query('SELECT count() FROM prod_proteus.hr_structure_overall', 'TSV')).strip(), 'строк')
    s.close()


def tree_noise(pg):
    """07.11 (бой, ноябрь: узлы с двумя родителями в mapped-цепочках одного дня) — та же порча структуры на стенде,
    во все дни: перестановка (юнит 11131: 1113 над 111), пропуск уровня (11122: без 111), повтор уровня (11211: 112
    дважды). Флаги уровней «в / из» пересчитываются, как в источнике (значение уровня сменилось к прошлому / следующему
    дню; сверено: на нетронутом источнике совпадают во всех строках)."""
    T = 'usr_cross_data.hr_executive_proteus'
    k = lambda i: f'lvl{i}_mapped_management_unit_rk'
    n = lambda i: f'lvl{i}_mapped_management_unit_nm'
    aff = pg.run(f"SELECT DISTINCT mdm_employee_rk AS e FROM {T} WHERE {k(5)} IN ('11131', '11122', '11211')").e.tolist()
    pg.run(f"UPDATE {T} SET {k(3)} = {k(4)}, {k(4)} = {k(3)}, {n(3)} = {n(4)}, {n(4)} = {n(3)} WHERE {k(5)} = '11131'")
    pg.run(f"UPDATE {T} SET {k(3)} = {k(4)}, {n(3)} = {n(4)}, {k(4)} = {k(5)}, {n(4)} = {n(5)}, {k(5)} = NULL, {n(5)} = NULL "
           f"WHERE {k(5)} = '11122'")
    pg.run(f"UPDATE {T} SET {k(6)} = {k(5)}, {n(6)} = {n(5)}, {k(5)} = {k(4)}, {n(5)} = {n(4)}, {k(4)} = {k(3)}, {n(4)} = {n(3)} "
           f"WHERE {k(5)} = '11211'")
    L = range(1, NL + 1)
    fl = ', '.join([f'CASE WHEN lag(calendar_dt) OVER w = calendar_dt - 1 AND lag({k(i)}) OVER w IS DISTINCT FROM {k(i)} '
                    f'THEN 1 ELSE 0 END AS i{i}' for i in L]
                   + [f'CASE WHEN lead(calendar_dt) OVER w = calendar_dt + 1 AND lead({k(i)}) OVER w IS DISTINCT FROM {k(i)} '
                      f'THEN 1 ELSE 0 END AS o{i}' for i in L])
    st = ', '.join([f'lvl{i}_mngt_unit_in_trsf_flg = x.i{i}' for i in L] + [f'lvl{i}_mngt_unit_out_trsf_flg = x.o{i}' for i in L])
    pg.run(f"UPDATE {T} h SET {st} FROM (SELECT mdm_employee_rk, calendar_dt, {fl} FROM {T} "
           f"WHERE mdm_employee_rk IN ({', '.join(str(e) for e in aff)}) "
           f"WINDOW w AS (PARTITION BY mdm_employee_rk ORDER BY calendar_dt)) x "
           f"WHERE h.mdm_employee_rk = x.mdm_employee_rk AND h.calendar_dt = x.calendar_dt")
    print(f'  порча структуры: перестановка, пропуск и повтор уровня — людей {len(aff)}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pg', default='/tmp/pgt:55432')
    ap.add_argument('--user', default='pg')
    ap.add_argument('--fix', type=int, default=None, help='только прогон с правками 1…N (6 — все)')
    ap.add_argument('--steps', action='store_true', help='как есть и правки по шагам: сводная таблица')
    ap.add_argument('--hub', help='папка: ноутбук «1. Helicopter — ноут TeamPulse Hub.yaml» целиком, выгрузка — в chdb '
                                  '(<папка>/db): hr_structure_overall и teampulse_hub_*')
    ap.add_argument('--yaml', help='другой YAML ноутбука для --hub (по умолчанию — из папки поставки)')
    ap.add_argument('--tree-noise', action='store_true', help='с --hub: порча mapped-цепочек, как на бою 07.11 (tree_noise)')
    ap.add_argument('--ch', help='папка: итоговая таблица каждого прогона — в chdb (<папка>/asis, <папка>/fix) '
                                 'как prod_proteus.hr_structure_overall, для 0д и датасета')
    a = ap.parse_args()
    host, port = a.pg.rsplit(':', 1)
    pg = PG(dict(host=host, port=port, user=a.user, dbname='postgres'))
    U, people = simulate()
    perf, office, grt = load(pg, U, people)
    n = pg.run('SELECT count(*) AS n, count(DISTINCT mdm_employee_rk) AS p FROM usr_cross_data.hr_executive_proteus')
    print(f'источник: {n.n[0]} строк по дням, {n.p[0]} человек, юнитов {len(U)}, {D0} … {D1}')
    # сверка TP 2.0 по шагам — по всей численности, ССЧ и найм — у активной (так их считает таблица)
    T, Ta = truth(U, people, perf, grt, act=None), truth(U, people, perf, grt)
    for k in list(Ta):
        T[k]['ssch'], T[k]['hire'] = Ta[k]['ssch'], Ta[k]['hire']
    if a.hub:
        if a.tree_noise:
            tree_noise(pg)
        pg.run('drop table if exists teampulse_hub_chk')
        try:
            run_yaml(pg, a.yaml or os.path.join(HERE, '..', 'Поставка — TeamPulse Hub', '1. Helicopter — ноут TeamPulse Hub.yaml'),
                     a.hub)
        finally:
            # проверки целиком (одна строка SQL — одна транзакция: при FAIL стенд откатывает и таблицу проверок) — ещё раз
            # без последнего запроса, который падает, чтобы показать все значения
            if not len(pg.run("select 1 from information_schema.tables where table_name = 'teampulse_hub_chk'")):
                ys = yaml.safe_load(open(a.yaml or os.path.join(HERE, '..', 'Поставка — TeamPulse Hub',
                                                                '1. Helicopter — ноут TeamPulse Hub.yaml'), encoding='utf-8'))
                hc = [p['code'] for p in ys['paragraphs'] if p['title'] == 'hub checks']
                if hc and len(pg.run("select 1 from information_schema.tables where table_name = 'teampulse_hub_meta'")):
                    try:
                        pg.run(hc[0].replace('::int::text', '::text'))
                    except Exception as e:
                        print('  hub checks (повтор):', str(e).splitlines()[0])
            if len(pg.run("select 1 from information_schema.tables where table_name = 'teampulse_hub_chk'")):
                ck = pg.run("select n, val, case when must = 0 then 'INFO' when abs(coalesce(val, 0)) < 0.5 then 'OK' "
                            "else 'FAIL' end as r from teampulse_hub_chk order by n")
                print('  hub checks: ' + ', '.join(f'{r.n}={r.r}' + ('' if r.r == 'OK' else f'({r.val:g})')
                                                   for r in ck.itertuples()))
        # hr_structure_overall в бою выгружает ноутбук TP 2.0, наш её не трогает (21.10) — стенд выгружает сам:
        # её читает файл 2
        # поставка 66: group_and_sum_metrics / calc_ssch убраны из ноутбука отчёта (Адель) — таблицы может не быть
        if len(pg.run("select 1 from information_schema.tables where table_name = 'hr_structure_with_ssch'")):
            gp_to_click_mock(pg, a.hub)(gp_table='hr_structure_with_ssch', clickhouse_table='prod_proteus.hr_structure_overall')
        return
    if a.steps:
        rows = []
        for k in range(len(STEPS)):
            res = compare(U, T, run_notebook(pg, k), k, quiet=True)
            rows.append((STEPS[k], res))
        cols = [('hc', 'компания'), ('ssch', 'компания'), ('ssch_ds', 'компания'), ('hire', 'компания'),
                ('perf', 'компания'), ('grt', 'компания'), ('tin', 'блоки')]
        head = {'hc': 'числ.', 'ssch': 'ССЧ табл.', 'ssch_ds': 'ССЧ ряда', 'hire': 'найм', 'perf': 'перф.',
                'grt': 'T-рост', 'tin': 'перев. в, блоки'}
        print(f"\n{'шаг':40}" + ''.join(f'{head[k]:>16}' for k, _ in cols))
        for name, res in rows:
            print(f'{name:40}' + ''.join(f'{res[k][0 if w == "компания" else 1]:>16}' for k, w in cols))
        return
    for fix in ([0, 6] if a.fix is None else [a.fix]):
        df = run_notebook(pg, fix)
        print(f'hr_structure_with_ssch: {len(df)} строк, колонок {len(df.columns)}')
        compare(U, T, df, fix)
        if a.ch:
            to_chdb(pg, os.path.join(a.ch, 'fix' if fix else 'asis'))


if __name__ == '__main__':
    main()
