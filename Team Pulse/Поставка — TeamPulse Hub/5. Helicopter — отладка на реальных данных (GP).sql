-- ============================================================================
-- 5. Отладка логики на реальных данных — Helicopter, параграф gp, после запуска ноутбука (файл 1).
-- Запросы независимые: выделить один (от «-- N.» до «;») и выполнить. Ничего не пишет, только читает
-- таблицы ноутбука teampulse_hub_* и его промежуточные таблицы.
--
-- Параметры — в начале КАЖДОГО запроса, блок p:
--   unit  ключ подразделения (unit_rk из teampulse_hub_unit; поиск по имени — запрос 0); null — корень отчёта
--   m     месяц, первое число; null — последний закрытый месяц (cm в teampulse_hub_cal)
-- Срез — как в отчёте по умолчанию: тип численности «Активная», все покраски, IT-коды и штат. Другой срез —
-- условие act_cd / paint_cd в строках, помеченных «← срез».
--
-- Что с чем сверять (мастер-источник — ваш дашборд HQ / HR-отчётность на ту же дату и те же фильтры):
--   1  водопад по месяцам из teampulse_hub_flow: начало, найм, отток, переводы, конец; «прочее» = 0, конец = численность
--   2  мониторинг: численность по покраске = люди с категорией (п. 1 файла 9)
--   3  месячная текучесть по месяцам: отток ÷ среднесписочная (п. 6)
--   4  срок закрытия вакансий: медиана по месяцам и за период (п. 4)
--   5  повторные строки источника за день — переводы не должны удваиваться (п. 8)
--   6  переводы по специализациям: по флагу уровня и «внутри юнита» (п. 9)
--   7  средний возраст на конец месяца и профили = численность (п. 11, пересечения разрезов)
--   8  источник найма на день найма против последнего значения месяца (п. 12)
--   9  откуда «прочее» водопада (запрос 1): кто сменил численность «Активная» не наймом и не увольнением — по категориям
--   10 посещаемость в базе мастер-отчёта: посещаемость, фиксы, брони без посещения, посещения без брони
--   11 как мастер-отчёт (Executive Report, «Активная», 12 мес.): помесячно численность, найм (из него БГ и стажёры), отток,
--      «Перевод+» / «Перевод-» и водопад за окно — числа отчёта в раскладке борда мастера, сверять глазами
--   12 разбор hub checks № 33 (какой разрез расходится с рядами, сколько ячеек, разница у корня) и № 27 (незамкнутые
--      строки витрины движения по виду и месяцу)
-- Проверено на стенде PostgreSQL (stand/nb_tp20.py --hub): все запросы выполняются на таблицах ноутбука.
-- ============================================================================

-- 0. Найти подразделение по части имени: ключ unit_rk — в параметр unit остальных запросов
select unit_rk, unit_lvl, unit_nm, kids_cnt, head_login
from teampulse_hub_unit
where unit_nm ilike '%' || 'впишите часть имени' || '%'
order by unit_lvl, unit_nm
limit 50;

-- 1. Водопад по месяцам — как в отчёте с поставки 105: замкнутая витрина teampulse_hub_flow (строки юнитов sp_cd = '-').
--    prochee = конец − начало − найм + отток − в + из — всегда 0 (проверка №27), fin_minus_hc = конец − численность
--    series — 0 (проверка №28). Перевод — вход в периметр или выход из него (периметр — узел + срез ниже): пришёл в узел
--    извне или ушёл из него (chg_unit) или другая сторона перехода вне среза (oth_act_cd — тип, откуда пришёл / куда ушёл)
with p as (select null::text as unit),
u as (select coalesce((select unit from p), (select root_rk from teampulse_hub_meta)) as rk),
f as (
    select report_month as m, sum(beg_cnt) as beg, sum(hire_cnt) as hire, sum(fire_cnt) as fire,
           sum(case when chg_unit = 1 or oth_act_cd <> 'Активная' then tin_cnt else 0 end) as tin,     -- ← срез
           sum(case when chg_unit = 1 or oth_act_cd <> 'Активная' then tout_cnt else 0 end) as tout,   -- ← срез
           sum(fin_cnt) as fin
    from teampulse_hub_flow
    where node_rk = (select rk from u) and sp_cd = '-'
      and act_cd = 'Активная'                                                   -- ← срез
    group by 1
),
s as (
    select report_month as m, sum(hc_cnt) as hc
    from teampulse_hub_series
    where node_rk = (select rk from u)
      and act_cd = 'Активная'                                                   -- ← срез
    group by 1
)
select f.m, f.beg, f.hire, f.fire, f.tin, f.tout, f.fin, s.hc,
       f.fin - f.beg - f.hire + f.fire - f.tin + f.tout as prochee,
       f.fin - coalesce(s.hc, 0) as fin_minus_hc
from f left join s on s.m = f.m
order by f.m;

-- 2. Мониторинг за месяц по покраске: численность на конец месяца против людей с категорией
--    (правило поставки 103: категория — только у численности на конец месяца, без записи — «не размечено»;
--    hc и v_monitoringe должны совпасть в каждой строке)
with p as (select null::text as unit, null::date as m),
u as (select coalesce((select unit from p), (select root_rk from teampulse_hub_meta)) as rk,
             coalesce((select m from p), (select cm from teampulse_hub_cal)) as m)
select paint_cd as pokraska, sum(hc_cnt) as hc,
       sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) as v_monitoringe,
       sum(pnor_cnt) as norma, sum(plow_cnt) as nedorabotka, sum(phig_cnt) as pererabotka, sum(pgry_cnt) as ne_razmecheno
from teampulse_hub_series
where node_rk = (select rk from u) and report_month = (select m from u)
  and act_cd = 'Активная'                                                       -- ← срез
group by rollup(paint_cd)
order by paint_cd nulls first;

-- 3. Месячная текучесть: отток месяца ÷ среднесписочная месяца × 100 — то же число, что точка графика и
--    колонка «Тек. мес.» таблицы подразделений (у закрытого месяца)
with p as (select null::text as unit),
u as (select coalesce((select unit from p), (select root_rk from teampulse_hub_meta)) as rk)
select report_month as m, sum(fire_cnt) as fire, round(sum(avg_cnt), 1) as ssch,
       round(100.0 * sum(fire_cnt) / nullif(sum(avg_cnt), 0), 2) as turnover_m_pct
from teampulse_hub_series
where node_rk = (select rk from u)
  and act_cd = 'Активная'                                                       -- ← срез
group by 1
order by 1;

-- 4. Срок закрытия: медиана по вакансиям, закрытым в месяце, и по всем вакансиям периода (январь..m) —
--    не медиана месячных медиан. Срок вакансии — дней от согласования до закрытия без дней в Hold
--    (ttf_d, ноутбук 2_11); только каналы из списка. Вакансия — не человек: срезы численности не действуют
with p as (select null::text as unit, null::date as m),
u as (select coalesce((select unit from p), (select root_rk from teampulse_hub_meta)) as rk,
             coalesce((select m from p), (select cm from teampulse_hub_cal)) as m),
v as (
    select report_month, ttf_d
    from teampulse_hub_vacancy, generate_series(1, greatest(vac_ttf_cnt, 0)::int)
    where node_rk = (select rk from u) and ttf_d is not null
)
select report_month::text as period, count(*) as closed, percentile_cont(0.5) within group (order by ttf_d) as median_days,
       round(avg(ttf_d), 1) as mean_days
from v group by 1
union all
select 'период ' || to_char(date_trunc('year', (select m from u)), 'YYYY-MM') || '..' || to_char((select m from u), 'YYYY-MM'),
       count(*), percentile_cont(0.5) within group (order by ttf_d), round(avg(ttf_d), 1)
from v where report_month between date_trunc('year', (select m from u))::date and (select m from u)
order by 1;

-- 5. Повторные строки источника за день: сотрудник × день × юнит с несколькими строками и флагом перевода.
--    Ноутбук (hub · 5) схлопывает их в одну строку с флагами 0 / 1 — перевод не удваивается. Здесь видно,
--    сколько таких дней было бы посчитано дважды по старому правилу
select date_trunc('month', calendar_dt)::date as m,
       count(*) as days_with_repeats,
       sum(n - 1) as extra_rows
from (
    select mdm_employee_rk, calendar_dt::date as calendar_dt, count(*) as n
    from usr_cross_data.hr_executive_proteus
    where calendar_dt >= (select grid_start from teampulse_hub_cal)
      and (coalesce(lvl1_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(lvl1_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(transfer_to_specialization_flg::text, '0') = '1' or coalesce(transfer_out_specialization_flg::text, '0') = '1'
           or coalesce(transfer_to_active_type_flg::text, '0') = '1' or coalesce(transfer_out_active_type_flg::text, '0') = '1')
    group by 1, 2
    having count(*) > 1
) d
group by 1
order by 1;

-- 6. Переводы по специализациям с января по m: «в» и «из» — только флаг юнита уровня подразделения (fu);
--    смена специализации или среза без перевода юнита — «внутри» (ci / co). На начало + найм + в − отток − из
--    + (ci − co) = на конец по каждой специализации
with p as (select null::text as unit, null::date as m),
u as (select coalesce((select unit from p), (select root_rk from teampulse_hub_meta)) as rk,
             coalesce((select m from p), (select cm from teampulse_hub_cal)) as m)
select sp_cd as specialization,
       sum(case when trf_kind = 'i' and fu = 1 and in_ok = 1 then trf_cnt else 0 end) as v_po_urovnyu,
       sum(case when trf_kind = 'o' and fu = 1 then trf_cnt else 0 end) as iz_po_urovnyu,
       sum(case when trf_kind = 'i' and not (fu = 1 and in_ok = 1) and ((fa = 1 and in_ok = 1) or fsp = 1) then trf_cnt else 0 end) as vnutri_v,
       sum(case when trf_kind = 'o' and fu = 0 and (fa = 1 or fsp = 1) then trf_cnt else 0 end) as vnutri_iz
from teampulse_hub_trf
where node_rk = (select rk from u)
  and report_month between date_trunc('year', (select m from u))::date and (select m from u)
  and act_cd = 'Активная'                                                       -- ← срез
group by 1
order by 2 desc, 3 desc;

-- 7. Профили численности последнего месяца (пересечения разрезов) и средний возраст: сумма профилей = численность,
--    средний возраст — по людям на последний день данных. Профили лежат в нижнем юните человека — подразделение
--    берёт всё своё поддерево
with p as (select null::text as unit),
u as (select coalesce((select unit from p), (select root_rk from teampulse_hub_meta)) as rk),
sub as (select unit_rk from teampulse_hub_unit
        where '|' || path_rk || '|' like '%|' || (select rk from u) || '|%'),
pr as (
    select cnt, nullif(split_part(pf, ':', 2), '')::numeric as age
    from teampulse_hub_prof
    where node_rk in (select unit_rk from sub)
      and act_cd = 'Активная'                                                   -- ← срез
)
select (select sum(cnt) from pr) as lyudey_v_profilyah,
       (select sum(hc_cnt) from teampulse_hub_series
         where node_rk = (select rk from u) and report_month = (select last_month from teampulse_hub_meta)
           and act_cd = 'Активная') as chislennost,                             -- ← срез
       round((select sum(age * cnt) / nullif(sum(cnt) filter (where age is not null), 0) from pr), 2) as sredniy_vozrast,
       (select sum(cnt) from pr where age is null) as bez_vozrasta;

-- 8. Источник найма: значение на день найма (так берёт ноутбук с поставки 103) против последнего значения месяца
--    (как было). differ — наймы, где они расходятся; no_value_on_hire_day — в день найма поле пустое
with h as (
    select mdm_employee_rk, date_trunc('month', calendar_dt)::date as m, calendar_dt::date as d,
           coalesce(source_type_nm::text, '-') as src,
           row_number() over (partition by mdm_employee_rk, date_trunc('month', calendar_dt) order by calendar_dt desc) as rn_last
    from usr_cross_data.hr_executive_proteus
    where calendar_dt >= (select grid_start from teampulse_hub_cal)
),
ev as (
    select distinct on (mdm_employee_rk, date_trunc('month', calendar_dt))
           mdm_employee_rk, date_trunc('month', calendar_dt)::date as m, coalesce(source_type_nm::text, '-') as src_hire
    from usr_cross_data.hr_executive_proteus
    where calendar_dt >= (select grid_start from teampulse_hub_cal)
      and (coalesce(hire_flg::text, '0') = '1' or coalesce(transfer_candidate_flg::text, '0') = '1'
           or coalesce(transfer_internal_flg::text, '0') = '1')
    order by mdm_employee_rk, date_trunc('month', calendar_dt), calendar_dt desc
)
select ev.m, count(*) as hires,
       sum((ev.src_hire <> h.src)::int) as differ,
       sum((ev.src_hire = '-')::int) as no_value_on_hire_day
from ev join h on h.mdm_employee_rk = ev.mdm_employee_rk and h.m = ev.m and h.rn_last = 1
group by 1
order by 1;

-- 9. Откуда «прочее» водопада (запрос 1): люди, у которых численность «Активная» на конец месяца изменилась
--    не наймом и не увольнением. Только счётчики по категориям: тип на конец прошлого месяца → тип на конец месяца
--    («нет» — человека нет в численности), флаги источника внутри месяца. Сколько из них отчёт засчитал переводом —
--    сравнить с tin / tout запроса 1 того же месяца
with p as (select date '2025-10-01' as m),                                     -- ← месяц (первое число)
a as (
    select mdm_employee_rk as e, report_month as m,
           max(case when act_type_nm = 'Активная' then hc_total_cnt else 0 end) as act_hc,
           max(case when hc_total_cnt = 1 then act_type_nm end) as typ,
           max(case when act_type_nm = 'Активная' then hire_cnt else 0 end) as hire,
           max(case when act_type_nm = 'Активная' then fire_amt else 0 end) as fire
    from all_metrics_with_performance_and_office_traffic_and_grt
    where report_month in (((select m from p) - interval '1 month')::date, (select m from p))
    group by 1, 2
),
x as (
    select coalesce(c.e, b.e) as e, coalesce(b.act_hc, 0) as h0, coalesce(c.act_hc, 0) as h1,
           coalesce(c.hire, 0) as hire, coalesce(c.fire, 0) as fire,
           coalesce(b.typ, 'нет') as t0, coalesce(c.typ, 'нет') as t1
    from (select * from a where m = ((select m from p) - interval '1 month')::date) b
    full join (select * from a where m = (select m from p)) c on c.e = b.e
),
r as (select * from x where h1 - h0 <> hire - fire),
f as (
    select mdm_employee_rk as e,
           max((coalesce(transfer_to_active_type_flg::text, '0') = '1')::int) as ia,
           max((coalesce(transfer_out_active_type_flg::text, '0') = '1')::int) as oa,
           max((coalesce(fire_flg::text, '0') = '1')::int) as fx,
           max((coalesce(hire_flg::text, '0') = '1')::int) as hf,
           max((coalesce(transfer_candidate_flg::text, '0') = '1' or coalesce(transfer_internal_flg::text, '0') = '1')::int) as cv
    from usr_cross_data.hr_executive_proteus
    where calendar_dt >= (select m from p) and calendar_dt < ((select m from p) + interval '1 month')::date
      and mdm_employee_rk in (select e from r)
    group by 1
)
select case when r.h1 > r.h0 then 'пришёл в Активную' else 'ушёл из Активной' end as direction,
       r.t0 as type_prev_month_end, r.t1 as type_month_end,
       coalesce(f.ia, 0) as flag_to_active, coalesce(f.oa, 0) as flag_out_active,
       coalesce(f.fx, 0) as fire_flag, coalesce(f.hf, 0) as hire_flag, coalesce(f.cv, 0) as cand_or_intern,
       count(*) as people, sum(r.h1 - r.h0 - (r.hire - r.fire)) as prochee_part
from r left join f on f.e = r.e
group by 1, 2, 3, 4, 5, 6, 7, 8
order by abs(sum(r.h1 - r.h0 - (r.hire - r.fire))) desc
limit 40;

-- 10. Посещаемость — как в мастер-отчёте (борд «Посещаемость и бронирование офисов»). База с 06.11:
--    активные сотрудники с закреплённым офисом, визит — главный офис дня; фиксы — fix_flex_cat = 'фикс'.
--    Чарт: посещаемость = ovis ÷ wday, «Брони без посещения» = bkv ÷ bk, «Посещения без брони» = vsv ÷ ovis.
--    Задайте unit (ключ из запроса 0) и срез покраски — и сравните с мастером за тот же месяц; ожидаемые
--    числа сверки — в чате, не в репозитории. Допуск ±1 п.п. (±3% у абсолютов): остаток — дедуп строк
--    pc-таблицы мастера.
with p as (select null::text as unit, null::date as m),
u as (select coalesce((select unit from p), (select root_rk from teampulse_hub_meta)) as rk),
s as (
    select paint_cd,                                                                    -- ← срез
           sum(wday_amt) as wday, sum(ovis_amt) as ovis,
           sum(fwday_amt) as fwday, sum(fovis_amt) as fovis,
           sum(bk_amt) as bk, sum(bkv_amt) as bkv,
           sum(vsv_amt) as vsv, sum(vbk_amt) as vbk
    from teampulse_hub_series
    where node_rk = (select rk from u)
      and report_month = coalesce((select m from p), (select cm from teampulse_hub_cal))
      and act_cd = 'Активная'                                                            -- ← срез
    group by 1
)
select paint_cd,
       round(100.0 * ovis / nullif(wday, 0), 2) as attendance_pct,
       round(100.0 * fovis / nullif(fwday, 0), 2) as fix_attendance_pct,
       bkv as bookings_no_visit, bk - bkv as bookings_with_visit,
       vsv as visits_no_booking, vbk as visits_with_booking,
       round(100.0 * bkv / nullif(bk, 0), 2) as no_visit_share_pct,
       round(100.0 * vsv / nullif(ovis, 0), 2) as no_booking_share_pct
from s
order by paint_cd;

-- 11. Как мастер-отчёт (HR Executive Report, дефолт борда: «Активная», 12 месяцев) — числа отчёта в той же раскладке,
--     что борд мастера, для сверки по месяцам. Правила мастера (снято с боя 09.11): численность — на последний день месяца;
--     найм = найм в компанию + «Перевод в БГ» + «Перевод стажера в штат» (месяц события); отток — месяц события;
--     «Перевод+» — вход в периметр (тип численности, при выбранном подразделении — и его флаг), месяц события;
--     «Перевод-» — выход, месяц «день события + 1». Водопад: численность на конец первого месяца окна + найм + Перевод+ -
--     отток - Перевод- за следующие месяцы = численность на конец последнего. Отчёт берёт найм и переводы из строк дня
--     события (hub · 5), отток и численность — из рядов (hub · 3).
--     *_unit_only — переводы только по флагу юнита (без смены типа): у корня мастер их не считает (на «всей компании»
--     юнит-флагов в периметре нет) — у корня должны быть 0; ostatok — замыкание водопада (0)
with p as (select null::text as unit),                                                  -- ← подразделение (null — корень)
u as (select coalesce((select unit from p), (select root_rk from teampulse_hub_meta)) as rk),
w as (select (date_trunc('month', lm) - interval '11 month')::date as m0, lm::date as m1 from teampulse_hub_cal),
s as (
    select report_month as m, sum(hc_cnt) as hc, sum(fire_cnt) as fire
    from teampulse_hub_series
    where node_rk = (select rk from u) and act_cd = 'Активная'                          -- ← тип численности
    group by 1
),
t as (
    select report_month as m,
           sum(case when trf_kind = 'h' or (trf_kind = 'i' and in_ok = 0) then trf_cnt else 0 end) as hire,
           sum(case when trf_kind = 'i' and in_ok = 0 and cv_k = 'c' then trf_cnt else 0 end) as hire_bg,
           sum(case when trf_kind = 'i' and in_ok = 0 and cv_k = 's' then trf_cnt else 0 end) as hire_intern,
           sum(case when trf_kind = 'i' and in_ok = 1 and (fu = 1 or fa = 1) then trf_cnt else 0 end) as tin,
           sum(case when trf_kind = 'o' and (fu = 1 or fa = 1) then trf_cnt else 0 end) as tout,
           sum(case when trf_kind = 'i' and in_ok = 1 and fu = 1 and fa = 0 then trf_cnt else 0 end) as tin_unit_only,
           sum(case when trf_kind = 'o' and fu = 1 and fa = 0 then trf_cnt else 0 end) as tout_unit_only
    from teampulse_hub_trf
    where node_rk = (select rk from u) and act_cd = 'Активная'                          -- ← тип численности
    group by 1
),
r as (
    select s.m, s.hc, coalesce(t.hire, 0) as hire, coalesce(t.hire_bg, 0) as hire_bg,
           coalesce(t.hire_intern, 0) as hire_intern, s.fire, coalesce(t.tin, 0) as tin, coalesce(t.tout, 0) as tout,
           coalesce(t.tin_unit_only, 0) as tin_unit_only, coalesce(t.tout_unit_only, 0) as tout_unit_only
    from s left join t on t.m = s.m
    where s.m between (select m0 from w) and (select m1 from w)
)
select to_char(m, 'YYYY-MM') as period, hc, hire, hire_bg, hire_intern, fire, tin, tout, tin_unit_only, tout_unit_only,
       null::numeric as ostatok
from r
union all
select 'водопад ' || to_char((select m0 from w), 'YYYY-MM') || '..' || to_char((select m1 from w), 'YYYY-MM'),
       sum(case when m = (select m1 from w) then hc end),
       sum(case when m > (select m0 from w) then hire end), sum(case when m > (select m0 from w) then hire_bg end),
       sum(case when m > (select m0 from w) then hire_intern end), sum(case when m > (select m0 from w) then fire end),
       sum(case when m > (select m0 from w) then tin end), sum(case when m > (select m0 from w) then tout end),
       sum(case when m > (select m0 from w) then tin_unit_only end), sum(case when m > (select m0 from w) then tout_unit_only end),
       sum(case when m = (select m1 from w) then hc end) - sum(case when m = (select m0 from w) then hc end)
       - sum(case when m > (select m0 from w) then hire - fire + tin - tout end)
from r
order by 1;

-- 12. Разбор проверок hub checks № 33 и № 27 одним выводом (09.11, после прогона ноутбука).
--     part = 33: по каждому разрезу — ячеек узел x срез (x месяц), где разрез расходится со своей метрикой рядов, сумма
--     разницы (разрез - ряды) и разница у корня; part = 27: незамкнутые строки водопада (конец - начало - найм + отток -
--     в + из <> 0) по виду строки (подразделение / специализация) и месяцу — строк, сумма остатка и суммы найма, оттока,
--     переводов этих строк. Отчёт водопадом не пользуется для найма и переводов (они — из переходов hub · 5): № 27 —
--     про внутреннюю витрину движения
with d33 as (

            select 'g'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('g') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'a'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('a') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'e'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('e') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 't'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('t') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'gr'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('gr') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 's'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('s') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'c'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('c') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'o'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('o') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'w'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('w') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'r'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('r') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'sp'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('sp') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'tc'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('tc') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'rg'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('rg') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'ws'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('ws') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'mh'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('mh') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'sp1'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('sp1') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xr'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xr') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xi'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xi') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xp'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xp') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xt'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xt') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xg'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xg') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xs'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xs') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xsp'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xsp') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xtc'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xtc') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'oc'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('oc') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(ovis_amt) as n from teampulse_hub_series where report_month = (select cm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'dw'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('dw') and true group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(wday_amt) as n from teampulse_hub_series where report_month between ((select cm from teampulse_hub_cal) - interval '1 month')::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'do'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('do') and true group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(ovis_amt) as n from teampulse_hub_series where report_month between ((select cm from teampulse_hub_cal) - interval '1 month')::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'rm_ok'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key = 'rm' and split_part(mx_val, '|', 4) = 'ok' group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(gapr_cnt) as n from teampulse_hub_series
                       where gapr_cnt > 0 group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'rm_no'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key = 'rm' and split_part(mx_val, '|', 4) = 'no' group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(gdec_cnt) as n from teampulse_hub_series
                       where gdec_cnt > 0 group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
        ),
r27 as (
    select case when sp_cd = '-' then 'подразделение' else 'специализация' end as kind, report_month,
           sum(fin_cnt) - sum(beg_cnt) - sum(hire_cnt) + sum(fire_cnt) - sum(tin_cnt) + sum(tout_cnt) as ost,
           sum(hire_cnt) as hire, sum(fire_cnt) as fire, sum(tin_cnt) as tin, sum(tout_cnt) as tout
    from teampulse_hub_flow
    group by node_rk, report_month, sp_cd, paint_cd, it_cd, staff_cd, act_cd, case when sp_cd = '-' then 'подразделение' else 'специализация' end
    having abs(sum(fin_cnt) - sum(beg_cnt) - sum(hire_cnt) + sum(fire_cnt) - sum(tin_cnt) + sum(tout_cnt)) > 0.5
)
select '33' as part, mx_key as item, count(*) as cells, round(sum(d)::numeric, 1) as sum_diff,
       round(sum(abs(d))::numeric, 1) as sum_abs_diff,
       round(sum(case when node_rk = (select root_rk from teampulse_hub_meta) then d else 0 end)::numeric, 1) as root_diff,
       null::numeric as hire, null::numeric as fire, null::numeric as tin, null::numeric as tout
from d33
group by mx_key
union all
select '27', kind || ' ' || to_char(report_month, 'YYYY-MM'), count(*), round(sum(ost)::numeric, 1), round(sum(abs(ost))::numeric, 1),
       null, sum(hire), sum(fire), sum(tin), sum(tout)
from r27
group by kind, report_month
order by 1, 2;
