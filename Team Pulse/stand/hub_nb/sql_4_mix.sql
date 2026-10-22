-- =============================================================================
-- TeamPulse Hub · 4. Разрезы (поставка 58: SQL вместо build_hub)
-- teampulse_hub_mix — узел × срез × разрез × значение: численность последнего месяца по атрибутам
-- (g a t gr s c o w r sp tc), увольнения с начала его года (xr причина, xq regret по причине, xi
-- инициатива, xp причина|инициатива, xt стаж, xg грейд, xs стрим, xsp специализация, xtc тип компании),
-- найм с начала года (hk источник, hch канал, hg грейд, hsp специализация). Пустое значение — ''.
-- =============================================================================

-- численность последнего месяца
drop table if exists teampulse_hub_mixr;
create table teampulse_hub_mixr as
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
       unnest(ARRAY['g', 'a', 't', 'gr', 's', 'c', 'o', 'w', 'r', 'sp', 'tc']) as mx_key,
       unnest(ARRAY[coalesce(nullif(translate(e.gender::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.type_age::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.experience_group_nm::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.grade::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.seniority::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.employee_contract_type::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.legal_organization::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.employee_stream::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.employment_relation_type::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.specialization::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.type_company::text, E'\t\n|', '  /'), '-'), '')]) as mx_val,
       coalesce(e.hc_total_cnt, 0) as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.hc_total_cnt, s.gender, s.type_age, s.experience_group_nm, s.grade, s.seniority,
               s.employee_contract_type, s.legal_organization, s.employee_stream, s.employment_relation_type,
               s.specialization, s.type_company,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from all_metrics_with_performance_and_office_traffic_and_grt s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.report_month = (select lm from teampulse_hub_cal)
    ) x
) e
where coalesce(e.hc_total_cnt, 0) > 0
distributed by (node_rk);

-- увольнения с начала года
insert into teampulse_hub_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
       unnest(ARRAY['xr', 'xq', 'xi', 'xp', 'xt', 'xg', 'xs', 'xsp', 'xtc']) as mx_key,
       unnest(ARRAY[coalesce(nullif(translate(e.fire_reason_group::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.fire_reason_group::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.fire_initiative::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.fire_reason_group::text, E'\t\n|', '  /'), '-'), '')
                    || '|' || coalesce(nullif(translate(e.fire_initiative::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.experience_group_nm::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.grade::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.employee_stream::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.specialization::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.type_company::text, E'\t\n|', '  /'), '-'), '')]) as mx_val,
       unnest(ARRAY[coalesce(e.fire_amt, 0), coalesce(e.regret_fire_amt, 0), coalesce(e.fire_amt, 0),
                    coalesce(e.fire_amt, 0), coalesce(e.fire_amt, 0), coalesce(e.fire_amt, 0),
                    coalesce(e.fire_amt, 0), coalesce(e.fire_amt, 0), coalesce(e.fire_amt, 0)]) as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.fire_amt, s.regret_fire_amt, s.fire_reason_group, s.fire_initiative, s.experience_group_nm,
               s.grade, s.employee_stream, s.specialization, s.type_company,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from all_metrics_with_performance_and_office_traffic_and_grt s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal)
    ) x
) e
where coalesce(e.fire_amt, 0) > 0;

-- найм с начала года: источник, канал (найм в компанию / из учебной группы в боевую / стажёр в штат),
-- грейд, специализация
insert into teampulse_hub_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
       unnest(ARRAY['hk', 'hch', 'hg', 'hsp']) as mx_key,
       unnest(ARRAY[coalesce(nullif(translate(e.source_type_nm::text, E'\t\n|', '  /'), '-'), ''),
                    case when coalesce(e.hire_cnt, 0) > 0 then 'Найм в компанию'
                              when coalesce(e.transfer_candidate_amt, 0) > 0 then 'Из учебной группы в боевую' else 'Стажёр в штат' end,
                    coalesce(nullif(translate(e.grade::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.specialization::text, E'\t\n|', '  /'), '-'), '')]) as mx_val,
       greatest(coalesce(e.hire_cnt, 0), coalesce(e.transfer_candidate_amt, 0), coalesce(e.transfer_internal_amt, 0)) as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.hire_cnt, s.transfer_candidate_amt, s.transfer_internal_amt, s.source_type_nm, s.grade,
               s.specialization,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from all_metrics_with_performance_and_office_traffic_and_grt s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal)
    ) x
) e
where greatest(coalesce(e.hire_cnt, 0), coalesce(e.transfer_candidate_amt, 0), coalesce(e.transfer_internal_amt, 0)) > 0;

drop table if exists teampulse_hub_mix;
create table teampulse_hub_mix as
select node_rk, paint_c as paint_cd, it_c as it_cd, staff_c as staff_cd, act_c as act_cd,
       mx_key, mx_val, sum(mx_n) as mx_n
from teampulse_hub_mixr
group by 1, 2, 3, 4, 5, 6, 7
having sum(mx_n) > 0
distributed by (node_rk);
drop table if exists teampulse_hub_mixr;

select count(*) as mix_rows from teampulse_hub_mix;
