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
--   1  численность, найм, отток, переводы по месяцам и «прочее» водопада (должно быть 0)
--   2  мониторинг: численность по покраске = люди с категорией (п. 1 файла 9)
--   3  месячная текучесть по месяцам: отток ÷ среднесписочная (п. 6)
--   4  срок закрытия вакансий: медиана по месяцам и за период (п. 4)
--   5  повторные строки источника за день — переводы не должны удваиваться (п. 8)
--   6  переводы по специализациям: по флагу уровня и «внутри юнита» (п. 9)
--   7  средний возраст на конец месяца и профили = численность (п. 11, пересечения разрезов)
--   8  источник найма на день найма против последнего значения месяца (п. 12)
-- Проверено на стенде PostgreSQL (stand/nb_tp20.py --hub): все запросы выполняются на таблицах ноутбука.
-- ============================================================================

-- 0. Найти подразделение по части имени: ключ unit_rk — в параметр unit остальных запросов
select unit_rk, unit_lvl, unit_nm, kids_cnt, head_login
from teampulse_hub_unit
where unit_nm ilike '%' || 'впишите часть имени' || '%'
order by unit_lvl, unit_nm
limit 50;

-- 1. Водопад по месяцам: численность на конец месяца, найм, отток, переводы в и из, «прочее»
--    (изменение численности, не объяснённое событиями; должно быть 0 — иначе событие без флага в источнике)
with p as (select null::text as unit),
u as (select coalesce((select unit from p), (select root_rk from teampulse_hub_meta)) as rk),
s as (
    select report_month as m, sum(hc_cnt) as hc, sum(hire_cnt) as hire, sum(fire_cnt) as fire
    from teampulse_hub_series
    where node_rk = (select rk from u)
      and act_cd = 'Активная'                                                   -- ← срез
    group by 1
),
t as (
    select report_month as m,
           sum(case when trf_kind = 'i' and (fu = 1 or fa = 1) and in_ok = 1 then trf_cnt else 0 end) as tin,
           sum(case when trf_kind = 'o' and (fu = 1 or fa = 1) then trf_cnt else 0 end) as tout
    from teampulse_hub_trf
    where node_rk = (select rk from u)
      and act_cd = 'Активная'                                                   -- ← срез
    group by 1
)
select s.m, s.hc, s.hc - lag(s.hc) over (order by s.m) as d_hc, s.hire, s.fire,
       coalesce(t.tin, 0) as tin, coalesce(t.tout, 0) as tout,
       s.hc - lag(s.hc) over (order by s.m) - (s.hire - s.fire + coalesce(t.tin, 0) - coalesce(t.tout, 0)) as prochee
from s left join t on t.m = s.m
order by s.m;

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
