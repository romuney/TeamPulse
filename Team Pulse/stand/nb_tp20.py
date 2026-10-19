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
YAML = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub', 'TP 2.0.yaml')
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
                    act=pick([('Активная', .84), ('Подрядчики', .05), ('Декрет', .04), ('Стажеры', .07)]),
                    it=pick([('IT', .4), ('Digital', .15), ('NonIT', .45)]), oper=pick([('HQ', .5), ('Line', .3), ('Support', .2)]),
                    hired=day - dt.timedelta(random.randint(0, 2500)) if day == D0 else day,
                    reason=None, init=None, regret=0)
    people = [new(D0) for _ in range(320)]
    for day in DAYS[1:]:
        alive = [p for p in people if p['end'] is None]
        if day.weekday() < 5:
            for p in alive:
                r = random.random()
                if r < .0011:                                   # ~2,3% в месяц
                    p['end'] = day
                    p['reason'] = pick([('Лучшее предложение', .4), ('Личные обстоятельства', .3), ('Нет роста', .3)])
                    p['init'] = pick([('Работник', .8), ('Работодатель', .2)])
                    p['regret'] = int(random.random() < .2)
                elif r < .0021:                                 # ~2% в месяц переходят в другой юнит
                    cur = p['unit'][-1][1]
                    p['unit'].append((day, random.choice([h for h in homes if h != cur])))
                elif r < .0026:
                    p['grade'].append((day, p['grade'][-1][1] + 1))
            for _ in range(sum(random.random() < .0011 for _ in alive) + (1 if random.random() < .15 else 0)):
                people.append(new(day))
    return U, people


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


# флаги смены типа (покраска, IT, тип активности…): в источнике есть, здесь всегда 0 — смену
# типа симуляция не делает
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
        + [f'transfer_{d}_{t}_flg' for d in ('to', 'out') for t in TYPES])


def source_rows(U, people):
    for p in people:
        last = p['end'] or D1
        d = max(p['start'], D0)
        while d <= last:
            pu = path(U, at(p['unit'], d))
            prev = path(U, at(p['unit'], d - dt.timedelta(1))) if d > p['start'] else None
            nxt = path(U, at(p['unit'], d + dt.timedelta(1))) if d < last else None
            inf = [int(prev is not None and (i >= len(pu) or i >= len(prev) or pu[i] != prev[i]) and i < len(pu)) for i in range(NL)]
            outf = [int(nxt is not None and (i >= len(pu) or i >= len(nxt) or pu[i] != nxt[i]) and i < len(pu)) for i in range(NL)]
            g = at(p['grade'], d)
            fired = int(p['end'] == d)
            yield ([d, p['rk']] + [pu[i] if i < len(pu) else None for i in range(NL)]
                   + [U[pu[i]][0] if i < len(pu) else None for i in range(NL)]
                   + inf + outf
                   + [p['act'], int(p['act'] == 'Активная'), p['it'], p['oper'], p['rel'], p['gender'], p['age'], tenure(p, d), str(g), seniority(g),
                      p['reason'] if fired else None, p['init'] if fired else None,
                      p['con'], p['legal'], p['stream'],
                      int(d == p['start'] and p['start'] > D0), 0, 0, fired, p['regret'] if fired else 0]
                   + [0] * (2 * len(TYPES)))
            d += dt.timedelta(1)


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
            perf.append((p['rk'], m, random.choices(['normal', 'low', 'super_low', 'high', 'super_high', None],
                                                    [.6, .05, .02, .12, .03, .18])[0]))
            r = random.random()
            for k in range(2 if r < .015 else 1 if r < .06 else 0):
                st = random.choices(['FNS', 'DCL', 'CNL', 'INP'], [.55, .25, .1, .1])[0]
                grt.append((p['rk'], dt.datetime(m.year, m.month, 5 + k * 7, 10), st, 0, '5999-01-01'))
            m = dt.date(m.year + m.month // 12, m.month % 12 + 1, 1)
        d = max(p['start'], D0)
        while d <= last:
            if d.weekday() < 5:
                office.append((d, p['rk'], 1, int(random.random() < .4)))
            d += dt.timedelta(1)
    return perf, office, grt


def load(pg, U, people):
    pg.run("""DROP SCHEMA IF EXISTS usr_cross_data, prod_v_sse_crossdata, prod_v_dds, prod_v_dds_dic, prod_v_emart CASCADE;
              DROP SCHEMA public CASCADE; CREATE SCHEMA public;
              CREATE SCHEMA usr_cross_data; CREATE SCHEMA prod_v_sse_crossdata; CREATE SCHEMA prod_v_dds; CREATE SCHEMA prod_v_dds_dic;
              CREATE SCHEMA prod_v_emart;""")
    typ = lambda c: ('date' if c == 'calendar_dt' else 'bigint' if c == 'mdm_employee_rk'
                     else 'int' if c.endswith('_flg') else 'text')
    pg.run(f"CREATE TABLE usr_cross_data.hr_executive_proteus ({', '.join(f'{c} {typ(c)}' for c in COLS)})")
    pg.copy('usr_cross_data.hr_executive_proteus', COLS, source_rows(U, people))
    perf, office, grt = side(people)
    pg.run("CREATE TABLE prod_v_sse_crossdata.performance_metric_m (mdm_employee_rk bigint, calendar_dt date, performance_category text)")
    pg.copy('prod_v_sse_crossdata.performance_metric_m', ['mdm_employee_rk', 'calendar_dt', 'performance_category'], perf)
    pg.run("CREATE TABLE usr_cross_data.office_traffic_attendance (calendar_dt date, mdm_employee_rk bigint, work_day_flg int, office_visit_flg int)")
    pg.copy('usr_cross_data.office_traffic_attendance', ['calendar_dt', 'mdm_employee_rk', 'work_day_flg', 'office_visit_flg'], office)
    pg.run("""CREATE TABLE prod_v_dds.mdm_employee_application_grt (mdm_employee_application_rk bigint, create_dttm timestamp,
              current_grade_num int, required_grade_num int, head_approve_flg int, mdm_employee_appl_status_cd text,
              deleted_flg int, valid_to_dttm date)""")
    pg.copy('prod_v_dds.mdm_employee_application_grt', ['mdm_employee_application_rk', 'create_dttm', 'mdm_employee_appl_status_cd',
                                                       'deleted_flg', 'valid_to_dttm'], grt)
    pg.run("""CREATE TABLE prod_v_dds_dic.mdm_employee_appl_status (mdm_employee_appl_status_cd text, mdm_employee_appl_status_desc text);
              INSERT INTO prod_v_dds_dic.mdm_employee_appl_status VALUES ('FNS','Одобрена'),('DCL','Отклонена'),('CNL','Отменена'),('INP','В работе')""")
    # 19.10: структура сотрудников с логинами — источник логина руководителя юнита (build_hub, как
    # в HRBP HUB). На конец каждого месяца: руководитель юнита — живой человек юнита с меньшим rk,
    # его логин h<юнит>, его руководитель — h<родитель>; у остальных руководитель — h<юнит>
    pg.run("""CREATE TABLE prod_v_emart.mdm_employee_structure_d (business_dt date, mdm_employee_rk bigint,
              management_head_flg int, ad_login text, management_head_ad_login text)""")
    pg.copy('prod_v_emart.mdm_employee_structure_d', ['business_dt', 'mdm_employee_rk', 'management_head_flg', 'ad_login',
                                                     'management_head_ad_login'], structure_rows(U, people))
    return perf, office, grt


def structure_rows(U, people):
    alive = lambda p, d: p['start'] <= d and (p['end'] is None or d < p['end'])
    for m in months():
        e = eom(m)
        here = defaultdict(list)
        for p in people:
            if alive(p, e):
                here[at(p['unit'], e)].append(p['rk'])
        for u, rks in here.items():
            hd = min(rks)
            for rk in rks:
                if rk == hd:
                    yield (e, rk, 1, 'h' + u, 'h' + U[u][1] if U[u][1] else None)
                else:
                    yield (e, rk, 0, 'u' + str(rk), 'h' + u)


# ---- правда по людям --------------------------------------------------------
def months():
    m, out = D0, []
    while m <= D1:
        out.append(m); m = dt.date(m.year + m.month // 12, m.month % 12 + 1, 1)
    return out


def eom(m):
    return min(dt.date(m.year, m.month, calendar.monthrange(m.year, m.month)[1]), D1)


def truth(U, people, perf, grt, pred=lambda p: True):
    """узел (rk) × месяц → меры. Численность — на последний календарный день месяца (у текущего
    неполного — на последний загруженный); ССЧ активной — полусумма численности узла с прошлым месяцем"""
    T = defaultdict(lambda: defaultdict(float))
    alive = lambda p, d: p['start'] <= d and (p['end'] is None or d < p['end'])   # в день увольнения уже не в численности
    ms = months()
    people = [p for p in people if pred(p)]
    for p in people:
        for m in ms:
            e = eom(m)
            if alive(p, e):
                for n in path(U, at(p['unit'], e)):
                    T[(n, m)]['hc'] += 1
                    T[(n, m)]['act'] += p['act'] == 'Активная'
        if p['end']:
            m = dt.date(p['end'].year, p['end'].month, 1)
            for n in path(U, at(p['unit'], p['end'])):
                T[(n, m)]['fire'] += 1
        if p['start'] > D0:
            m = dt.date(p['start'].year, p['start'].month, 1)
            for n in path(U, at(p['unit'], p['start'])):
                T[(n, m)]['hire'] += p['act'] == 'Активная'
        for (d, new), (_, old) in zip(p['unit'][1:], p['unit'][:-1]):
            # «в» — месяц первого дня в новом юните, «из» — месяц последнего дня в старом
            m, mo = dt.date(d.year, d.month, 1), dt.date((d - dt.timedelta(1)).year, (d - dt.timedelta(1)).month, 1)
            pn, po = path(U, new), path(U, old)
            for n in pn:
                if n not in po: T[(n, m)]['tin'] += 1
            for n in po:
                if n not in pn: T[(n, mo)]['tout'] += 1
    for m_i, m in enumerate(ms):
        for n in U:
            prev = T[(n, ms[m_i - 1])]['act'] if m_i else T[(n, m)]['act']
            T[(n, m)]['ssch'] = (T[(n, m)]['act'] + prev) / 2
    byrk = {p['rk']: p for p in people}
    last_unit = lambda p, m: at(p['unit'], min(eom(m), p['end'] or D1))
    for rk_, m, cat in perf:
        if rk_ not in byrk:
            continue
        for n in path(U, last_unit(byrk[rk_], m)):
            T[(n, m)]['perf'] += 1
    for rk_, ts, st, _, _ in grt:
        if rk_ not in byrk:
            continue
        m = dt.date(ts.year, ts.month, 1)
        for n in path(U, last_unit(byrk[rk_], m)):
            T[(n, m)]['grt'] += 1
            T[(n, m)]['grt2'] += st in ('FNS', 'DCL')
    return T


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
    # 6. «Активная» — по флагу источника (первый найденный), подрядчики в неё не входят; флага нет —
    #    только тип «Активная». IT-код — как в источнике: IT, Digital, NonIT (три покраски, не сводятся)
    (6, '_PARAMS_', """    {'alias': 'active_type_gr_nm',
     'cols': ['active_type_nm'],
     'expr': "CASE WHEN active_type_nm IN ('Активная','Подрядчики') "
             "THEN 'Активная' ELSE 'Прочие' END"},
    {'alias': 'emp_specialization_it_code',
     'cols': ['emp_specialization_it_code'],
     'expr': "CASE WHEN emp_specialization_it_code = 'IT' "
             "THEN 'IT' ELSE 'nonIT' END"},""",
     """    # «Активная» — по флагу источника: берётся первый найденный вариант. Подрядчики в
    # активную не входят. Флага нет — по типу активности, только «Активная»
    *[{'alias': 'active_type_gr_nm',
       'cols': [flg],
       'expr': f"CASE WHEN coalesce({flg}::text, '0') = '1' THEN 'Активная' ELSE 'Прочие' END"}
      for flg in ('active_count_flg', 'active_type_flg', 'active_flg')],
    {'alias': 'active_type_gr_nm',
     'cols': ['active_type_nm'],
     'expr': "CASE WHEN active_type_nm = 'Активная' THEN 'Активная' ELSE 'Прочие' END"},
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
         '4 уровень перевода в ключе', '5 ключи пути', '6 активная по флагу, IT — три значения']


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pg', default='/tmp/pgt:55432')
    ap.add_argument('--user', default='pg')
    ap.add_argument('--fix', type=int, default=None, help='только прогон с правками 1…N (6 — все)')
    ap.add_argument('--steps', action='store_true', help='как есть и правки по шагам: сводная таблица')
    ap.add_argument('--hub', help='папка: ноутбук «1. Helicopter — ноут TeamPulse Hub.yaml» целиком, выгрузка — в chdb '
                                  '(<папка>/db): hr_structure_overall и teampulse_hub_*')
    ap.add_argument('--ch', help='папка: итоговая таблица каждого прогона — в chdb (<папка>/asis, <папка>/fix) '
                                 'как prod_proteus.hr_structure_overall, для 0д и датасета')
    a = ap.parse_args()
    host, port = a.pg.rsplit(':', 1)
    pg = PG(dict(host=host, port=port, user=a.user, dbname='postgres'))
    U, people = simulate()
    perf, office, grt = load(pg, U, people)
    n = pg.run('SELECT count(*) AS n, count(DISTINCT mdm_employee_rk) AS p FROM usr_cross_data.hr_executive_proteus')
    print(f'источник: {n.n[0]} строк по дням, {n.p[0]} человек, юнитов {len(U)}, {D0} … {D1}')
    T = truth(U, people, perf, grt)
    if a.hub:
        run_yaml(pg, os.path.join(HERE, '..', 'Поставка — TeamPulse Hub', '1. Helicopter — ноут TeamPulse Hub.yaml'), a.hub)
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
