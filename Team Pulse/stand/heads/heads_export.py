# =============================================================================
# Выгрузка руководителей · метрики и Excel
# Таблицы — те, что этот ноутбук только что собрал (сборка TeamPulse Hub выше, без изменений): teampulse_hub_unit,
# teampulse_hub_series, teampulse_hub_vacancy, teampulse_hub_meta. Метрики — по тем же формулам, что отчёт TeamPulse Hub
# (датасет — файл 2 поставки, чарт — data.js) при настройках по умолчанию: тип численности «Активная», без фильтров
# IT и штата. Каждая колонка — как в отчёте у выбранного юнита:
#   численность HQ / Support — «Численность» с покраской HQ / Support на дату данных (последний месяц, как карточка);
#   прирост численности HQ — «Прирост с начала года» с покраской HQ: численность на дату данных минус на 31 декабря;
#   % джунов HQ — «Доля джунов в закрытых вакансиях»: закрытые джунами / все закрытые с 1 января по дату данных;
#   активные вакансии новые / замены — «Открытые вакансии» на дату данных по причине поиска «Новый» / «Замена»
#     (разрез «Причина поиска» вкладки «Найм и вакансии HQ»);
#   желательная / нежелательная текучесть HQ — как в отчёте, накопительно с 1 января: сумма месячных (желательные или
#     нежелательные увольнения месяца / средняя численность месяца × 100, по активной численности HQ узла), месячная —
#     с округлением до сотых, как в отчёте.
# Вакансии фильтрами не режутся (как в отчёте). Узел юнита — со всем, что под ним (как строка юнита в отчёте).
# =============================================================================
import base64
import io

import pandas as pd
from dal_client import query as dal


def _hq(sql):
    return dal.get_df(datasource='gp', query=sql)


def _lit(v):
    return "'" + str(v).replace("'", "''") + "'"


_logins = list(dict.fromkeys(str(x).strip().lower() for x in HEADS_LOGINS if str(x).strip()))
if not _logins:
    raise ValueError('Список HEADS_LOGINS пуст — впишите логины в параграф «Выгрузка руководителей · логины»')

_meta = _hq('select last_month, data_dt from teampulse_hub_meta').iloc[0]
LM = pd.Timestamp(_meta['last_month']).date()
DT = pd.Timestamp(_meta['data_dt']).date()
Y0 = LM.replace(month=1, day=1)
DEC = (pd.Timestamp(Y0) - pd.DateOffset(months=1)).date()
YEAR = LM.year

_u = _hq("""select unit_rk, coalesce(parent_rk, '') as parent_rk, unit_lvl, unit_nm, coalesce(path_rk, '') as path_rk,
                   lower(trim(coalesce(head_login, ''))) as login, coalesce(head_nm, '') as head_nm
            from teampulse_hub_unit""")
U = {r.unit_rk: r for r in _u.itertuples(index=False)}
KIDS = {}
for r in _u.itertuples(index=False):
    KIDS.setdefault(r.parent_rk, []).append(r.unit_rk)

# юниты руководителей из списка (порядок — как в списке) и уровень ниже
SEL = []
for lg in _logins:
    SEL += sorted([r.unit_rk for r in _u.itertuples(index=False) if r.login == lg], key=lambda k: (U[k].unit_lvl, U[k].unit_nm))
SEL = list(dict.fromkeys(SEL))
SELS = set(SEL)
MISS = [lg for lg in _logins if not any(U[k].login == lg for k in SEL)]
NODES = set(SEL)
if HEADS_KIDS:
    for k in SEL:
        NODES.update(KIDS.get(k, []))
if not NODES:
    raise ValueError('Ни один логин не найден среди руководителей юнитов на дату данных: ' + ', '.join(MISS))

_nl = ', '.join(_lit(k) for k in sorted(NODES))
_m = _hq(f"""
with s as (
    select node_rk, report_month::date as mo, lower(coalesce(paint_cd, '-')) as p,
           coalesce(hc_cnt, 0) as hc, coalesce(avg_cnt, 0) as av, coalesce(reg_cnt, 0) as rg, coalesce(nreg_cnt, 0) as nr
    from teampulse_hub_series
    where node_rk in ({_nl}) and lower(coalesce(act_cd, '-')) = 'активная'
      and report_month between {_lit(DEC)}::date and {_lit(LM)}::date
),
hc as (
    select node_rk,
           sum(case when mo = {_lit(LM)}::date and p = 'hq' then hc else 0 end) as hc_hq,
           sum(case when mo = {_lit(LM)}::date and p = 'support' then hc else 0 end) as hc_sup,
           sum(case when mo = {_lit(DEC)}::date and p = 'hq' then hc else 0 end) as hc_hq_dec
    from s group by node_rk
),
h as (
    select node_rk, mo, sum(rg) as rh, sum(nr) as nrh, sum(av) as avh
    from s where p = 'hq' and mo between {_lit(Y0)}::date and {_lit(LM)}::date
    group by node_rk, mo
),
t as (
    select node_rk,
           round(sum(coalesce(round((rh * 100.0 / nullif(avh, 0))::numeric, 2), 0)), 2) as regret,
           round(sum(coalesce(round((nrh * 100.0 / nullif(avh, 0))::numeric, 2), 0)), 2) as nonregret
    from h group by node_rk
),
v as (
    select node_rk,
           sum(case when report_month = {_lit(LM)}::date and search_reason = 'Новый' then coalesce(vac_open_cnt, 0) else 0 end) as vac_new,
           sum(case when report_month = {_lit(LM)}::date and search_reason = 'Замена' then coalesce(vac_open_cnt, 0) else 0 end) as vac_rep,
           sum(case when report_month between {_lit(Y0)}::date and {_lit(LM)}::date and cand_lvl = 'Junior'
                    then coalesce(vac_close_cnt, 0) else 0 end) as vjn,
           sum(case when report_month between {_lit(Y0)}::date and {_lit(LM)}::date then coalesce(vac_close_cnt, 0) else 0 end) as vcl
    from teampulse_hub_vacancy
    where node_rk in ({_nl})
    group by node_rk
)
select n.rk as node_rk,
       coalesce(hc.hc_hq, 0) as hc_hq, coalesce(hc.hc_sup, 0) as hc_sup,
       coalesce(hc.hc_hq, 0) - coalesce(hc.hc_hq_dec, 0) as grow_hq,
       case when coalesce(v.vcl, 0) > 0 then round((v.vjn * 100.0 / v.vcl)::numeric, 2) end as jun,
       coalesce(v.vac_new, 0) as vac_new, coalesce(v.vac_rep, 0) as vac_rep,
       coalesce(t.nonregret, 0) as nonregret, coalesce(t.regret, 0) as regret
from (select unnest(array[{_nl}]::text[]) as rk) n
left join hc on hc.node_rk = n.rk
left join t on t.node_rk = n.rk
left join v on v.node_rk = n.rk
""")
MV = {r.node_rk: r for r in _m.itertuples(index=False)}

COLS = [('hc_hq', 'численность HQ', '#,##0'),
        ('hc_sup', 'численность Support', '#,##0'),
        ('grow_hq', f'прирост численности HQ за {YEAR}', '+#,##0;-#,##0;0'),
        ('jun', '% джунов HQ', '0.0'),
        ('vac_new', 'активные вакансии новые', '#,##0'),
        ('vac_rep', 'активные вакансии замены', '#,##0'),
        ('nonregret', f'желательная текучесть {YEAR} HQ', '0.0'),
        ('regret', f'нежелательная текучесть {YEAR} HQ', '0.0')]

# дерево строк: юнит из списка встаёт под ближайшего предка из списка; под юнитом из списка — его прямые подразделения
PARENT = {}
for k in SEL:
    anc = [a for a in U[k].path_rk.split('|')[:-1] if a in SELS]
    PARENT[k] = anc[-1] if anc else None
ROWS = []


def _walk(k, depth, main):
    ROWS.append((k, depth, main))
    if not main:
        return
    sub = [c for c in SEL if PARENT[c] == k]
    kids = [c for c in KIDS.get(k, []) if c not in SELS] if HEADS_KIDS else []
    for c in sorted(sub + kids, key=lambda x: U[x].unit_nm):
        _walk(c, depth + 1, c in SELS)


for k in SEL:
    if PARENT[k] is None:
        _walk(k, 0, True)

out = []
for k, depth, main in ROWS:
    u, m = U[k], MV.get(k)
    row = {'уровень': depth, 'из списка': 'да' if main else 'уровень ниже', 'руководитель': u.login or '—',
           'ФИО': u.head_nm, 'юнит': u.unit_nm, 'unit_rk': k}
    for c, nm, _ in COLS:
        v = getattr(m, c) if m is not None else None
        row[nm] = None if v is None or (isinstance(v, float) and pd.isna(v)) else float(v)
    out.append(row)
HEADS_DF = pd.DataFrame(out)

# ---- Excel: группировка строк (схлопывается и расхлопывается), руководитель жирным, юнит под ним серым ----
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
try:
    from openpyxl.cell.rich_text import CellRichText, TextBlock
    from openpyxl.cell.text import InlineFont
except Exception:
    CellRichText = None

wb = Workbook()
ws = wb.active
ws.title = 'Руководители'
ws.sheet_properties.outlinePr.summaryBelow = False
ws['A1'] = 'TeamPulse Hub — руководители'
ws['A1'].font = Font(bold=True, size=14)
ws['A2'] = (f'Данные на {DT:%d.%m.%Y}. Численность и вакансии — на эту дату; % джунов и текучесть — с 1 января по неё. '
            'Тип численности «Активная», как в отчёте по умолчанию.')
ws['A2'].font = Font(color='808080', size=10)
HR = 4
thin = Side(style='thin', color='D9D9D9')
ws.cell(HR, 1, 'Руководитель / юнит')
for j, (_, nm, _) in enumerate(COLS, 2):
    ws.cell(HR, j, nm)
for j in range(1, len(COLS) + 2):
    c = ws.cell(HR, j)
    c.font = Font(bold=True)
    c.fill = PatternFill('solid', fgColor='F2F2F2')
    c.alignment = Alignment(wrap_text=True, vertical='center', horizontal='left' if j == 1 else 'center')
    c.border = Border(bottom=thin)
ws.row_dimensions[HR].height = 48

r = HR + 1
for (k, depth, main), rec in zip(ROWS, out):
    u = U[k]
    lg = u.login or 'без руководителя'
    pad = '    ' * depth
    if CellRichText is not None:
        txt = CellRichText(TextBlock(InlineFont(b=main, sz=11, color='000000' if main else '404040'), pad + lg),
                           TextBlock(InlineFont(sz=9, color='8C8C8C'), '\n' + pad + u.unit_nm))
    else:
        txt = pad + lg + '\n' + pad + u.unit_nm
    a = ws.cell(r, 1, txt)
    a.alignment = Alignment(wrap_text=True, vertical='center')
    if CellRichText is None:
        a.font = Font(bold=main)
    for j, (_, nm, fmt) in enumerate(COLS, 2):
        c = ws.cell(r, j, rec[nm])
        c.number_format = fmt
        c.alignment = Alignment(horizontal='center', vertical='center')
        c.font = Font(bold=main, color='000000' if main else '404040')
    for j in range(1, len(COLS) + 2):
        ws.cell(r, j).border = Border(bottom=thin)
    if depth:
        ws.row_dimensions[r].outlineLevel = min(depth, 7)
    ws.row_dimensions[r].height = 32
    r += 1
if MISS:
    r += 1
    ws.cell(r, 1, 'Не найдены среди руководителей юнитов на дату данных: ' + ', '.join(MISS)).font = Font(color='C00000')
ws.column_dimensions['A'].width = 52
for j in range(2, len(COLS) + 2):
    ws.column_dimensions[get_column_letter(j)].width = 16
ws.freeze_panes = ws.cell(HR + 1, 2)

wd = wb.create_sheet('Данные')
wd.append(list(HEADS_DF.columns))
for rec in HEADS_DF.itertuples(index=False):
    wd.append([None if (isinstance(x, float) and pd.isna(x)) else x for x in rec])

wh = wb.create_sheet('Как считается')
for line in [
    ('Колонка', 'Как в отчёте TeamPulse Hub'),
    ('численность HQ / Support', 'Численность с покраской HQ / Support, тип «Активная», на дату данных (последний месяц)'),
    (f'прирост численности HQ за {YEAR}', 'Прирост с начала года, покраска HQ: численность на дату данных минус на 31 декабря'),
    ('% джунов HQ', 'Доля джунов в закрытых вакансиях: закрытые джунами / все закрытые с 1 января по дату данных'),
    ('активные вакансии новые / замены', 'Открытые вакансии на дату данных, причина поиска «Новый» / «Замена»'),
    (f'желательная / нежелательная текучесть {YEAR} HQ',
     'Накопительно с 1 января: сумма месячной (увольнения месяца / средняя численность месяца × 100), активная численность HQ'),
    ('Строки', 'Руководители из списка — жирным; под каждым — его прямые подразделения обычным шрифтом. '
               'Юнит из списка под другим юнитом из списка — вложенной группой. Значения узла — со всем, что под ним'),
]:
    wh.append(line)
wh.column_dimensions['A'].width = 40
wh.column_dimensions['B'].width = 110

buf = io.BytesIO()
wb.save(buf)
HEADS_XLSX = buf.getvalue()
try:
    open(HEADS_FILE, 'wb').write(HEADS_XLSX)
except Exception:
    pass
_sum = (f'Строк: {len(ROWS)} (руководителей из списка — {sum(1 for x in ROWS if x[2])}); данные на {DT:%d.%m.%Y}'
        + (f'; не найдены: {", ".join(MISS)}' if MISS else ''))
# %html — первым в выводе параграфа: Helicopter показывает ссылку на файл (Excel внутри ссылки, без сервера)
print('%html <p>' + _sum + '</p><p><a download="' + HEADS_FILE + '" href="data:application/vnd.openxmlformats-officedocument'
      '.spreadsheetml.sheet;base64,' + base64.b64encode(HEADS_XLSX).decode() + '">Скачать Excel: ' + HEADS_FILE + '</a></p>')
