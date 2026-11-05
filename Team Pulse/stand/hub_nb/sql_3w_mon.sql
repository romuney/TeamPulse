-- =============================================================================
-- TeamPulse Hub · 3н. Мониторинг по неделям (поставка 104, сверка с боевым отчётом 05.11)
-- teampulse_hub_mon_week — узел × неделя (понедельник) × срез. Правила боевого:
--   недели Пн–Вс; численность недели — люди на ПОНЕДЕЛЬНИК (не уволенные в этот день),
--   срезы (покраска / IT / штат / тип) — на понедельник, как численность;
--   категории недели — последняя дневная категория человека в неделе (performance_metric_d),
--     без записи — «не размечено» (pgry): сумма категорий = численность недели;
--   свежесть категории (lo_fresh/lo_long, hi_fresh/hi_long) — 1–2 недели подряд в категории /
--     больше 2 (стрик по неделям с непустой категорией);
--   недельные бакеты звонков t23/t35/t5 — доля недели = 100 * tlk_sum_amt / hrs_sum_amt
--     (20–30 / 30–50 / больше 50 %), недели с частичными данными считаются по дням с данными;
--   активность и доля звонков — взвешенные, суммы хранятся, деление на фронте:
--     активность ч/день = hrs_sum_amt / plan_day_cnt, доля звонков = 100 * tlk_sum_amt / hrs_sum_amt;
--   прогулы/выходные — накопительно с начала сетки до конца недели (pab25/pab5, pwe25/pwe5:
--     2–5 дней / больше 5 за период). Карточка «за период» у боевого — его окно 16 недель;
--     здесь период = вся сетка (grid_start) — фронт показывает накопитель последней недели
-- prev_* (прошлая неделя) не хранится — это предыдущая строка недели.
-- Датасету читать таблицу целиком: узел × неделя × срез (act_cd — как в series).
-- =============================================================================
drop table if exists teampulse_hub_mon_week;
create table teampulse_hub_mon_week as
with cal as (select grid_start, pre from teampulse_hub_cal),
-- 1) недельная база перформанса: человек × неделя (категория — последняя непустая дневная в неделе)
pdw as (
    select mdm_employee_rk
        , date_trunc('week', calendar_dt)::date as wk
        , sum(case when plan_working_day_flg = 1 then duration_hour end) as h_sum
        , sum(plan_working_day_flg) as pday
        , sum(case when plan_working_day_flg = 1 then talk_call_duration_h end) as t_sum
        , sum(case when working_balance = -1 then 1 else 0 end) as absence
        , sum(case when working_balance = 1 then 1 else 0 end) as dayoff
        , (array_agg(performance_category order by (performance_category is null), calendar_dt desc))[1] as wk_cat
    from prod_v_sse_crossdata.performance_metric_d
    where calendar_dt >= (select grid_start from cal)
    group by 1, 2
),
-- 2) накопительные прогулы/выходные с начала сетки до конца недели
cum as (
    select mdm_employee_rk, wk, h_sum, pday, t_sum, wk_cat
        , sum(absence) over (partition by mdm_employee_rk order by wk) as abs_cum
        , sum(dayoff) over (partition by mdm_employee_rk order by wk) as dof_cum
    from pdw
),
-- 3) свежесть категории: сколько недель подряд (включая текущую) человек в этой категории
chg as (
    select mdm_employee_rk, wk, wk_cat,
           case when lag(wk_cat) over w = wk_cat then 0 else 1 end as ch
    from (select distinct mdm_employee_rk, wk, wk_cat from pdw where wk_cat is not null) q
    window w as (partition by mdm_employee_rk order by wk)
),
strk as (
    select mdm_employee_rk, wk, wk_cat,
           row_number() over (partition by mdm_employee_rk, g order by wk) as streak
    from (select mdm_employee_rk, wk, wk_cat,
                 sum(ch) over (partition by mdm_employee_rk order by wk) as g
          from chg) x
),
-- 4) люди на понедельник: дневные строки источника (не all_metrics — та месячная);
--    срезы и leaf-юнит — из строки понедельника, лестница уровней — как в build_all_metrics.
--    Повторные строки дня (запрос 5 файла 5) схлопываем: одна строка человека на понедельник
mon0 as (
    select mdm_employee_rk, calendar_dt::date as wk
        , coalesce(nullif(emp_specialization_oper_code::text, ''), '-') as paint_c
        , coalesce(nullif(emp_specialization_it_code::text, ''), '-') as it_c
        , case when employment_relation_type_desc = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c
        , coalesce(nullif(trim(active_type_nm::text), ''), '-') as act_c
        , coalesce(lvl1_mapped_management_unit_rk::text, '-') as lvl1_rk
        , coalesce(lvl2_mapped_management_unit_rk::text, '-') as lvl2_rk
        , coalesce(lvl3_mapped_management_unit_rk::text, '-') as lvl3_rk
        , coalesce(lvl4_mapped_management_unit_rk::text, '-') as lvl4_rk
        , coalesce(lvl5_mapped_management_unit_rk::text, '-') as lvl5_rk
        , coalesce(lvl6_mapped_management_unit_rk::text, '-') as lvl6_rk
        , coalesce(lvl7_mapped_management_unit_rk::text, '-') as lvl7_rk
        , coalesce(lvl8_mapped_management_unit_rk::text, '-') as lvl8_rk
        , coalesce(lvl9_mapped_management_unit_rk::text, '-') as lvl9_rk
        , coalesce(lvl10_mapped_management_unit_rk::text, '-') as lvl10_rk
        , coalesce(lvl11_mapped_management_unit_rk::text, '-') as lvl11_rk
    from (select *, row_number() over (partition by mdm_employee_rk, calendar_dt
                                        order by calendar_dt desc) as rn_day
          from usr_cross_data.hr_executive_proteus
          where calendar_dt >= (select grid_start from cal)
            and extract(dow from calendar_dt) = 1) d
    where d.rn_day = 1                                                -- одна строка человека за понедельник
      and coalesce(d.fire_flg::text, '0') <> '1'                      -- численность: не уволен в этот день
      and (coalesce(d.lvl1_mapped_management_unit_rk::text, '-') <> '-'          -- есть юнит (leaf_lvl > 0)
           or coalesce(d.lvl2_mapped_management_unit_rk::text, '-') <> '-'
           or coalesce(d.lvl3_mapped_management_unit_rk::text, '-') <> '-'
           or coalesce(d.lvl4_mapped_management_unit_rk::text, '-') <> '-'
           or coalesce(d.lvl5_mapped_management_unit_rk::text, '-') <> '-'
           or coalesce(d.lvl6_mapped_management_unit_rk::text, '-') <> '-'
           or coalesce(d.lvl7_mapped_management_unit_rk::text, '-') <> '-'
           or coalesce(d.lvl8_mapped_management_unit_rk::text, '-') <> '-'
           or coalesce(d.lvl9_mapped_management_unit_rk::text, '-') <> '-'
           or coalesce(d.lvl10_mapped_management_unit_rk::text, '-') <> '-'
           or coalesce(d.lvl11_mapped_management_unit_rk::text, '-') <> '-')
),
mon as (
    select m.*
        , case when lvl11_rk <> '-' then 11 when lvl10_rk <> '-' then 10 when lvl9_rk <> '-' then 9
               when lvl8_rk <> '-' then 8 when lvl7_rk <> '-' then 7 when lvl6_rk <> '-' then 6
               when lvl5_rk <> '-' then 5 when lvl4_rk <> '-' then 4 when lvl3_rk <> '-' then 3
               when lvl2_rk <> '-' then 2 else 1 end as leaf_lvl
        , case when lvl11_rk <> '-' then lvl11_rk when lvl10_rk <> '-' then lvl10_rk
               when lvl9_rk <> '-' then lvl9_rk when lvl8_rk <> '-' then lvl8_rk
               when lvl7_rk <> '-' then lvl7_rk when lvl6_rk <> '-' then lvl6_rk
               when lvl5_rk <> '-' then lvl5_rk when lvl4_rk <> '-' then lvl4_rk
               when lvl3_rk <> '-' then lvl3_rk when lvl2_rk <> '-' then lvl2_rk
               else lvl1_rk end as mng_unit_rk
    from mon0 m
),
-- 5) путь юнита в нынешней структуре (как hub · 3) + перформанс недели
pw as (
    select m.mdm_employee_rk, m.wk, m.paint_c, m.it_c, m.staff_c, m.act_c
        , (select pre from cal) || coalesce(u.cp,
            array_to_string((ARRAY[m.lvl1_rk, m.lvl2_rk, m.lvl3_rk, m.lvl4_rk, m.lvl5_rk, m.lvl6_rk,
                               m.lvl7_rk, m.lvl8_rk, m.lvl9_rk, m.lvl10_rk, m.lvl11_rk])[1:m.leaf_lvl], '|')) as cp
    from mon m
    left join teampulse_hub_upath u on u.unit_rk = m.mng_unit_rk
),
e0 as (
    select p.mdm_employee_rk, p.wk, p.paint_c, p.it_c, p.staff_c, p.act_c, p.cp
        , c.wk_cat, c.h_sum, c.pday, c.t_sum, c.abs_cum, c.dof_cum, k.streak
        , case when coalesce(c.h_sum, 0) > 0
               then round((100.0 * coalesce(c.t_sum, 0) / c.h_sum)::numeric, 1) end as talk_shr   -- GP: round(numeric, int)
    from pw p
    left join cum c on c.mdm_employee_rk = p.mdm_employee_rk and c.wk = p.wk
    left join strk k on k.mdm_employee_rk = p.mdm_employee_rk and k.wk = p.wk
),
e as (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk
    from e0 x
)
-- GP-перенос 104: счётчики — case when … then 1 else 0: сравнение с пустой категорией/долей даёт NULL, и sum без
-- единицы терял людей (сумма категорий ≠ численность)
select node_rk, wk, paint_c as paint_cd, it_c as it_cd, staff_c as staff_cd, act_c as act_cd   -- имена срезов — как в series
    , count(*) as hc_cnt
    , sum(case when e.wk_cat = 'normal' then 1 else 0 end) as pnor_cnt
    , sum(case when e.wk_cat in ('low', 'super_low') then 1 else 0 end) as plow_cnt
    , sum(case when e.wk_cat in ('high', 'super_high') then 1 else 0 end) as phig_cnt
    , sum(case when e.wk_cat is null or e.wk_cat not in ('normal', 'low', 'super_low', 'high', 'super_high') then 1 else 0 end) as pgry_cnt
    , sum(case when e.wk_cat in ('low', 'super_low') and coalesce(e.streak, 0) <= 2 then 1 else 0 end) as lo_fresh_cnt
    , sum(case when e.wk_cat in ('low', 'super_low') and coalesce(e.streak, 0) > 2 then 1 else 0 end) as lo_long_cnt
    , sum(case when e.wk_cat in ('high', 'super_high') and coalesce(e.streak, 0) <= 2 then 1 else 0 end) as hi_fresh_cnt
    , sum(case when e.wk_cat in ('high', 'super_high') and coalesce(e.streak, 0) > 2 then 1 else 0 end) as hi_long_cnt
    -- GP-перенос 104: границы — как в правилах и месячных сегментах (with_performance): 30 и 50 — в нижний бакет
    , sum(case when e.talk_shr >= 20 and e.talk_shr <= 30 then 1 else 0 end) as t23_cnt
    , sum(case when e.talk_shr > 30 and e.talk_shr <= 50 then 1 else 0 end) as t35_cnt
    , sum(case when e.talk_shr > 50 then 1 else 0 end) as t5_cnt
    , sum(coalesce(e.h_sum, 0)) as hrs_sum_amt
    , sum(coalesce(e.pday, 0)) as plan_day_cnt
    , sum(coalesce(e.t_sum, 0)) as tlk_sum_amt
    , sum(case when coalesce(e.abs_cum, 0) > 1 and coalesce(e.abs_cum, 0) <= 5 then 1 else 0 end) as pab25_cnt
    , sum(case when coalesce(e.abs_cum, 0) > 5 then 1 else 0 end) as pab5_cnt
    , sum(case when coalesce(e.dof_cum, 0) > 1 and coalesce(e.dof_cum, 0) <= 5 then 1 else 0 end) as pwe25_cnt
    , sum(case when coalesce(e.dof_cum, 0) > 5 then 1 else 0 end) as pwe5_cnt
from e
group by 1, 2, 3, 4, 5, 6
distributed by (node_rk);

select count(*) as mon_week_rows from teampulse_hub_mon_week;
