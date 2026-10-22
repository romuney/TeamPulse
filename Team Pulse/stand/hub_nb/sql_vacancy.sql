-- =============================================================================
-- TeamPulse Hub · снимок «структура × вакансии» (structure_x_vacancy, поставка 58 — SQL вместо Python)
-- Как в TP 2.0 (параграф vacancy_daily), но плоско: строка — юнит × месяц × разрезы вакансии, меры —
-- числами. Основа — вакансии (не структура): вакансии юнитов без людей не теряются, in_structure = 0.
--   закрыто   close_flg = 1 (за месяц)
--   открыто   в работе на конец месяца: end_of_month_flg = 1 и статус из группы «Согласованные»;
--             у незакрытого месяца — на последний загруженный день
--   новые     issue_day = approved_dt — согласованы в этом месяце
--   срок      у закрытых: дней от согласования до закрытия (сумма и число)
-- Узлы и путь — в «hub · 6» (teampulse_hub_vacancy).
-- =============================================================================
drop table if exists structure_x_vacancy;
create table structure_x_vacancy as
with mx as (select max(issue_day)::date as last_dt from usr_cross_data.vacancy_daily),
v as (
    select vd.issue_full_nm::text as vac, vd.issue_day::date as dd, date_trunc('month', vd.issue_day)::date as report_month,
           vd.approved_dt::date as adt, coalesce(vd.close_flg::int, 0) as cf,
           -- в работе на конец месяца; у незакрытого месяца — на последний загруженный день
           ((coalesce(vd.end_of_month_flg::int, 0) = 1 or vd.issue_day::date = (select last_dt from mx))
            and vd.status_name_chng_group = 'Согласованные')::int as of_,
           (vd.issue_day::date = vd.approved_dt::date)::int as nf,
           case when nullif(nullif(vd.resource_level_11_rk::text, '-'), '') is not null then 11
                when nullif(nullif(vd.resource_level_10_rk::text, '-'), '') is not null then 10
                when nullif(nullif(vd.resource_level_9_rk::text, '-'), '') is not null then 9
                when nullif(nullif(vd.resource_level_8_rk::text, '-'), '') is not null then 8
                when nullif(nullif(vd.resource_level_7_rk::text, '-'), '') is not null then 7
                when nullif(nullif(vd.resource_level_6_rk::text, '-'), '') is not null then 6
                when nullif(nullif(vd.resource_level_5_rk::text, '-'), '') is not null then 5
                when nullif(nullif(vd.resource_level_4_rk::text, '-'), '') is not null then 4
                when nullif(nullif(vd.resource_level_3_rk::text, '-'), '') is not null then 3
                when nullif(nullif(vd.resource_level_2_rk::text, '-'), '') is not null then 2
                when nullif(nullif(vd.resource_level_1_rk::text, '-'), '') is not null then 1 end as leaf_lvl,
           case when nullif(nullif(vd.resource_level_11_rk::text, '-'), '') is not null then nullif(nullif(vd.resource_level_11_rk::text, '-'), '')
                when nullif(nullif(vd.resource_level_10_rk::text, '-'), '') is not null then nullif(nullif(vd.resource_level_10_rk::text, '-'), '')
                when nullif(nullif(vd.resource_level_9_rk::text, '-'), '') is not null then nullif(nullif(vd.resource_level_9_rk::text, '-'), '')
                when nullif(nullif(vd.resource_level_8_rk::text, '-'), '') is not null then nullif(nullif(vd.resource_level_8_rk::text, '-'), '')
                when nullif(nullif(vd.resource_level_7_rk::text, '-'), '') is not null then nullif(nullif(vd.resource_level_7_rk::text, '-'), '')
                when nullif(nullif(vd.resource_level_6_rk::text, '-'), '') is not null then nullif(nullif(vd.resource_level_6_rk::text, '-'), '')
                when nullif(nullif(vd.resource_level_5_rk::text, '-'), '') is not null then nullif(nullif(vd.resource_level_5_rk::text, '-'), '')
                when nullif(nullif(vd.resource_level_4_rk::text, '-'), '') is not null then nullif(nullif(vd.resource_level_4_rk::text, '-'), '')
                when nullif(nullif(vd.resource_level_3_rk::text, '-'), '') is not null then nullif(nullif(vd.resource_level_3_rk::text, '-'), '')
                when nullif(nullif(vd.resource_level_2_rk::text, '-'), '') is not null then nullif(nullif(vd.resource_level_2_rk::text, '-'), '')
                when nullif(nullif(vd.resource_level_1_rk::text, '-'), '') is not null then nullif(nullif(vd.resource_level_1_rk::text, '-'), '') end as mng_unit_rk,
           array_to_string((ARRAY[coalesce(nullif(nullif(vd.resource_level_1_rk::text, '-'), ''), '-'),
                coalesce(nullif(nullif(vd.resource_level_2_rk::text, '-'), ''), '-'),
                coalesce(nullif(nullif(vd.resource_level_3_rk::text, '-'), ''), '-'),
                coalesce(nullif(nullif(vd.resource_level_4_rk::text, '-'), ''), '-'),
                coalesce(nullif(nullif(vd.resource_level_5_rk::text, '-'), ''), '-'),
                coalesce(nullif(nullif(vd.resource_level_6_rk::text, '-'), ''), '-'),
                coalesce(nullif(nullif(vd.resource_level_7_rk::text, '-'), ''), '-'),
                coalesce(nullif(nullif(vd.resource_level_8_rk::text, '-'), ''), '-'),
                coalesce(nullif(nullif(vd.resource_level_9_rk::text, '-'), ''), '-'),
                coalesce(nullif(nullif(vd.resource_level_10_rk::text, '-'), ''), '-'),
                coalesce(nullif(nullif(vd.resource_level_11_rk::text, '-'), ''), '-')])[1:case when nullif(nullif(vd.resource_level_11_rk::text, '-'), '') is not null then 11
                when nullif(nullif(vd.resource_level_10_rk::text, '-'), '') is not null then 10
                when nullif(nullif(vd.resource_level_9_rk::text, '-'), '') is not null then 9
                when nullif(nullif(vd.resource_level_8_rk::text, '-'), '') is not null then 8
                when nullif(nullif(vd.resource_level_7_rk::text, '-'), '') is not null then 7
                when nullif(nullif(vd.resource_level_6_rk::text, '-'), '') is not null then 6
                when nullif(nullif(vd.resource_level_5_rk::text, '-'), '') is not null then 5
                when nullif(nullif(vd.resource_level_4_rk::text, '-'), '') is not null then 4
                when nullif(nullif(vd.resource_level_3_rk::text, '-'), '') is not null then 3
                when nullif(nullif(vd.resource_level_2_rk::text, '-'), '') is not null then 2
                when nullif(nullif(vd.resource_level_1_rk::text, '-'), '') is not null then 1 end], '|') as unit_path,
           coalesce(nullif(vd.mapping_channel_name::text, ''), '-') as channel,
           case when vd.search_reason ilike '%замена%' then 'Замена'
                when vd.search_reason ilike '%нов%' then 'Новый' else 'Прочее' end as search_reason,
           case when vd.finalist_level_candy ilike '%jun%' then 'Junior'
                when vd.finalist_level_candy ilike '%middl%' then 'Middle'
                when vd.finalist_level_candy ilike '%senior%' then 'Senior'
                when vd.finalist_level_candy is null then 'Other'
                else vd.finalist_level_candy::text end as cand_lvl,
           coalesce(nullif(vd.lvl_position_adj::text, ''), '-') as position_lvl, coalesce(nullif(vd.specialization::text, ''), '-') as specialization,
           -- статус — снимок на последний день (last_dt_flg), только у вакансий в работе
           case when coalesce(vd.last_dt_flg::int, 0) = 1 and vd.status_name_chng_group = 'Согласованные'
                then coalesce(nullif(vd.status_name::text, ''), '-') else '' end as status
    from usr_cross_data.vacancy_daily vd
    where (coalesce(vd.close_flg::int, 0) = 1 or coalesce(vd.end_of_month_flg::int, 0) = 1 or vd.issue_day::date = vd.approved_dt::date
           or vd.issue_day::date = (select last_dt from mx))
),
d as (
    select report_month, mng_unit_rk, leaf_lvl, unit_path, channel, search_reason, cand_lvl, position_lvl,
           specialization, status,
           count(distinct case when cf = 1 then vac end) as close_cnt,
           count(distinct case when of_ = 1 then vac end) as open_cnt,
           count(distinct case when nf = 1 then vac end) as new_cnt,
           coalesce(sum(case when cf = 1 and adt is not null then dd - adt end), 0) as ttf_days,
           count(distinct case when cf = 1 and adt is not null then vac end) as ttf_cnt
    from v
    where leaf_lvl is not null
    group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    having count(distinct case when cf = 1 then vac end) + count(distinct case when of_ = 1 then vac end)
         + count(distinct case when nf = 1 then vac end) > 0
)
select d.report_month, d.mng_unit_rk, d.leaf_lvl, d.unit_path,
       case when s.mng_unit_rk is null then 0 else 1 end as in_structure,
       d.channel, d.search_reason, d.cand_lvl, d.position_lvl, d.specialization, d.status,
       d.close_cnt, d.open_cnt, d.new_cnt, d.ttf_days, d.ttf_cnt
from d
left join (select distinct report_month::date as report_month, mng_unit_rk::text as mng_unit_rk
           from org_structure) s
       on s.report_month = d.report_month and s.mng_unit_rk = d.mng_unit_rk
distributed by (mng_unit_rk);

-- итог: строк, открыто и закрыто (сумма по месяцам), из них в юнитах без людей
select count(*) as rows_cnt, coalesce(sum(open_cnt), 0) as open_sum, coalesce(sum(close_cnt), 0) as close_sum,
       coalesce(sum(case when in_structure = 0 then open_cnt + close_cnt end), 0) as in_units_without_people
from structure_x_vacancy;
