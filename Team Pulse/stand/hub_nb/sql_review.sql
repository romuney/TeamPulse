-- Годовое ревью: контракт владельца 18.11.2026.
-- Источник — Review - evaluation из TeamPulse Hub_2.0_check2.yaml.
-- Отдельная тестовая витрина. Общие HUB_SRC, teampulse_hub_mix и meta не меняются.
-- История БЕЗ нижней границы нужна для первого ревью; LAG не используется.
drop table if exists teampulse_hub_review_scores;
create table teampulse_hub_review_scores as
select mdm_employee_rk, extract(year from business_dt)::int as review_year,
       case when trim(summary_score::text) ~ '^[0-4]([.]0+)?$'
            then trim(summary_score::text)::numeric::int end as score
from prod_v_hrmart.summary_evaluation
where deleted_flg = 0 and valid_to_dttm = '5999-01-01'
  and mdm_employee_rk is not null and business_dt is not null
distributed by (mdm_employee_rk);

-- Нарушение согласованной уникальности останавливает сборку, а не выбирает случайную оценку.
do $$ begin
    if exists (select 1 from teampulse_hub_review_scores
               group by mdm_employee_rk, review_year having count(*) > 1) then
        raise exception 'Review: multiple current records per employee/review year';
    end if;
    if exists (select 1 from usr_cross_data.eligible
               group by mdm_employee_rk having count(*) > 1) then
        raise exception 'Review: multiple eligible records per employee';
    end if;
end $$;

drop table if exists teampulse_hub_review_people;
create table teampulse_hub_review_people as
select distinct s.mdm_employee_rk,
       (select pre from teampulse_hub_cal) || coalesce(u.cp,
         array_to_string((ARRAY[s.lvl1_rk::text,s.lvl2_rk::text,s.lvl3_rk::text,s.lvl4_rk::text,
           s.lvl5_rk::text,s.lvl6_rk::text,s.lvl7_rk::text,s.lvl8_rk::text,s.lvl9_rk::text,
           s.lvl10_rk::text,s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
       coalesce(nullif(s.paint_cd::text, ''), '-') as paint_cd,
       coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') as it_cd,
       case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_cd,
       coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_cd,
       coalesce(nullif(trim(translate(s.grade::text, E'\t\n|', '  /')), '-'), '') as grade,
       coalesce(nullif(trim(translate(s.experience_group_nm::text, E'\t\n|', '  /')), '-'), '') as tenure,
       coalesce(nullif(trim(translate(s.specialization::text, E'\t\n|', '  /')), '-'), '') as specialization,
       coalesce(e.eligible_flg = 1, false) as eligible,
       c.score as current_score,
       p.score as previous_score,
       -- NULL прошлого года не равен первому ревью: ищем любое более раннее финальное ревью.
       case when c.score is not null
                 and h.first_review_year = extract(year from current_date)::int
            then 1 else 0 end as first_review_flg
from all_metrics_with_performance_and_office_traffic_and_grt s
left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
left join usr_cross_data.eligible e on e.mdm_employee_rk = s.mdm_employee_rk
left join (select mdm_employee_rk, min(review_year) as first_review_year
           from teampulse_hub_review_scores group by mdm_employee_rk) h
    on h.mdm_employee_rk = s.mdm_employee_rk
left join teampulse_hub_review_scores c on c.mdm_employee_rk = s.mdm_employee_rk and e.eligible_flg = 1
    and c.review_year = extract(year from current_date)::int
left join teampulse_hub_review_scores p on p.mdm_employee_rk = s.mdm_employee_rk and e.eligible_flg = 1
    and p.review_year = extract(year from current_date)::int - 1
where s.report_month = (select lm from teampulse_hub_cal)
  and s.leaf_lvl > 0 and coalesce(s.hc_total_cnt, 0) > 0
distributed by (mdm_employee_rk);

do $$ begin
    if exists (select 1 from teampulse_hub_review_people
               group by mdm_employee_rk having count(*) > 1) then
        raise exception 'Review: conflicting HR snapshot records for employee';
    end if;
end $$;

drop table if exists teampulse_hub_review_nodes;
create table teampulse_hub_review_nodes as
select distinct p.*, unnest(string_to_array(cp, '|')) as node_rk
from teampulse_hub_review_people p
distributed by (node_rk);

drop table if exists teampulse_hub_review_test;
create table teampulse_hub_review_test as
select node_rk, paint_cd, it_cd, staff_cd, act_cd, mx_key, mx_val, sum(mx_n) as mx_n
from (
    select node_rk, paint_cd, it_cd, staff_cd, act_cd, 'rvc'::text as mx_key,
       unnest(ARRAY['all','eligible','rated','up','down','same','first','unpaired','missing']) as mx_val,
       unnest(ARRAY[1, eligible::int, (eligible and current_score is not null)::int,
         coalesce((eligible and current_score > previous_score)::int,0),
         coalesce((eligible and current_score < previous_score)::int,0),
         coalesce((eligible and current_score = previous_score)::int,0),
         case when eligible then first_review_flg else 0 end,
         (eligible and current_score is not null and previous_score is null and first_review_flg = 0)::int,
         (eligible and current_score is null)::int]) as mx_n
    from teampulse_hub_review_nodes
    union all
    select node_rk, paint_cd, it_cd, staff_cd, act_cd, 'rvyear',
           extract(year from current_date)::int::text, 1
    from teampulse_hub_review_nodes
    union all
    select node_rk, paint_cd, it_cd, staff_cd, act_cd, 'rvtr',
           previous_score::text || '|' || current_score::text, 1
    from teampulse_hub_review_nodes
    where eligible and current_score is not null and previous_score is not null and current_score <> previous_score
    union all
    select node_rk, paint_cd, it_cd, staff_cd, act_cd, 'rvfirst', current_score::text, 1
    from teampulse_hub_review_nodes where eligible and first_review_flg = 1
    union all
    select node_rk, paint_cd, it_cd, staff_cd, act_cd,
           unnest(ARRAY['rvgr','rvt','rvsp']),
           unnest(ARRAY[grade,tenure,specialization]) || '|b', 1
    from teampulse_hub_review_nodes where eligible
    union all
    select node_rk, paint_cd, it_cd, staff_cd, act_cd,
           unnest(ARRAY['rvgr','rvt','rvsp']),
           unnest(ARRAY[grade,tenure,specialization]) || '|' || coalesce(current_score::text,'na'), 1
    from teampulse_hub_review_nodes where eligible
) x
group by node_rk, paint_cd, it_cd, staff_cd, act_cd, mx_key, mx_val
having sum(mx_n) > 0
distributed by (node_rk);

-- Метаданные существуют даже при нулевой кадровой популяции. Общие meta/mix не меняются.
insert into teampulse_hub_review_test
values ('', '', '', '', '', 'rvmeta', 'hub-2-review-2|' || extract(year from current_date)::int::text, 1);

drop table if exists teampulse_hub_review_nodes;
drop table if exists teampulse_hub_review_people;
drop table if exists teampulse_hub_review_scores;
