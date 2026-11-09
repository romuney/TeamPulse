-- =============================================================================
-- TeamPulse Hub · 4. Разрезы (поставка 58: SQL вместо build_hub)
-- teampulse_hub_mix — узел × срез × разрез × значение: численность последнего месяца по атрибутам
-- (g a t gr s c o w r sp tc rg ws mh), увольнения с начала года (xr причина, xq regret по причине, xi
-- инициатива, xp причина|инициатива, xt стаж, xg грейд, xs стрим, xsp специализация, xtc тип компании),
-- (разбивки найма — из переходов hub · 5, 09.11); «с начала года» — с января по
-- дату данных, с незакрытым месяцем (lm, поставка 106; было — по закрытый cm). Поставка 66: oc / ocp — посещений и людей
-- по городу офиса за последний закрытый месяц, dw / do — календарь с месяца перед закрытым по текущий:
-- людей с рабочим днём и из них в офисе, значение — дата. 26.10-б: xim — увольнения по инициатору
-- и месяцу всей сетки, значение «инициатор|ГГГГ-ММ» (текучесть по инициатору). 31.10: sp0 — численность
-- по специализации на конец прошлого года (на начало периода), sp1 — на конец периода (поставка 106: на
-- последний месяц данных); es / en — сумма возрастов и людей с возрастом
-- по «разрез|значение» (средний возраст категории). Пустое значение — ''.
-- =============================================================================

-- численность последнего месяца
drop table if exists teampulse_hub_mixr;
create table teampulse_hub_mixr as
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
       unnest(ARRAY['g', 'a', 'e', 't', 'gr', 's', 'c', 'o', 'w', 'r', 'sp', 'tc', 'rg', 'ws', 'mh']) as mx_key,
       unnest(ARRAY[coalesce(nullif(translate(e.gender::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.type_age::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.age::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.experience_group_nm::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.grade::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.seniority::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.employee_contract_type::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.legal_organization::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.employee_stream::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.employment_relation_type::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.specialization::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.type_company::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.region::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.employee_stream::text, E'\t\n|', '  /'), '-'), '') || '|' || coalesce(nullif(translate(e.specialization::text, E'\t\n|', '  /'), '-'), ''),
                    coalesce(nullif(translate(e.management_head_flg::text, E'\t\n|', '  /'), '-'), '')]) as mx_val,
       coalesce(e.hc_total_cnt, 0) as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.hc_total_cnt, s.gender, s.type_age, s.age, s.experience_group_nm, s.grade, s.seniority,
               s.employee_contract_type, s.legal_organization, s.employee_stream, s.employment_relation_type,
               s.specialization, s.type_company, s.region, s.management_head_flg,
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

-- увольнения с начала года (январь..последний закрытый месяц)
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

-- 31.10-б, п. 1: средний возраст внутри категории — сумма возрастов (es) и людей с возрастом (en) по каждому разрезу
-- последнего месяца, значение — «ключ разреза|значение» (датасет отдаёт выбранному юниту)
insert into teampulse_hub_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c, k.mx_key, unnest(ARRAY['g|' || coalesce(nullif(translate(e.gender::text, E'\t\n|', '  /'), '-'), ''),
                    'a|' || coalesce(nullif(translate(e.type_age::text, E'\t\n|', '  /'), '-'), ''),
                    't|' || coalesce(nullif(translate(e.experience_group_nm::text, E'\t\n|', '  /'), '-'), ''),
                    'gr|' || coalesce(nullif(translate(e.grade::text, E'\t\n|', '  /'), '-'), ''),
                    's|' || coalesce(nullif(translate(e.seniority::text, E'\t\n|', '  /'), '-'), ''),
                    'c|' || coalesce(nullif(translate(e.employee_contract_type::text, E'\t\n|', '  /'), '-'), ''),
                    'o|' || coalesce(nullif(translate(e.legal_organization::text, E'\t\n|', '  /'), '-'), ''),
                    'w|' || coalesce(nullif(translate(e.employee_stream::text, E'\t\n|', '  /'), '-'), ''),
                    'r|' || coalesce(nullif(translate(e.employment_relation_type::text, E'\t\n|', '  /'), '-'), ''),
                    'sp|' || coalesce(nullif(translate(e.specialization::text, E'\t\n|', '  /'), '-'), ''),
                    'tc|' || coalesce(nullif(translate(e.type_company::text, E'\t\n|', '  /'), '-'), ''),
                    'rg|' || coalesce(nullif(translate(e.region::text, E'\t\n|', '  /'), '-'), ''),
                    'ws|' || coalesce(nullif(translate(e.employee_stream::text, E'\t\n|', '  /'), '-'), '') || '|' || coalesce(nullif(translate(e.specialization::text, E'\t\n|', '  /'), '-'), '')]) as mx_val,
       case when k.mx_key = 'es' then (case when trim(e.age::text) ~ '^[0-9]+([.,][0-9]+)?$' then replace(trim(e.age::text), ',', '.')::numeric end) * coalesce(e.hc_total_cnt, 0) else coalesce(e.hc_total_cnt, 0) end as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.hc_total_cnt, s.gender, s.type_age, s.age, s.experience_group_nm, s.grade, s.seniority,
               s.employee_contract_type, s.legal_organization, s.employee_stream, s.employment_relation_type,
               s.specialization, s.type_company, s.region, s.management_head_flg,
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
cross join (select 'es'::text as mx_key union all select 'en') k
where coalesce(e.hc_total_cnt, 0) > 0 and (case when trim(e.age::text) ~ '^[0-9]+([.,][0-9]+)?$' then replace(trim(e.age::text), ',', '.')::numeric end) is not null;

-- 31.10, п. 7: численность по специализации на начало года — последний месяц прошлого года, до движений с начала
-- года («Движение по специализациям»: на начало и на конец; датасет отдаёт выбранному юниту)
insert into teampulse_hub_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c, 'sp0' as mx_key, coalesce(nullif(translate(e.specialization::text, E'\t\n|', '  /'), '-'), '') as mx_val,
       coalesce(e.hc_total_cnt, 0) as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.hc_total_cnt, s.specialization,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from all_metrics_with_performance_and_office_traffic_and_grt s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.report_month = (date_trunc('year', (select lm from teampulse_hub_cal)) - interval '1 month')::date
    ) x
) e
where coalesce(e.hc_total_cnt, 0) > 0;

-- поставка 106: численность по специализации на последний месяц данных (lm; было cm) — «на конец» периода «с начала
-- года» в «Движении по специализациям» (sp — на сейчас; датасет отдаёт выбранному юниту)
insert into teampulse_hub_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c, 'sp1' as mx_key, coalesce(nullif(translate(e.specialization::text, E'\t\n|', '  /'), '-'), '') as mx_val,
       coalesce(e.hc_total_cnt, 0) as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.hc_total_cnt, s.specialization,
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
where coalesce(e.hc_total_cnt, 0) > 0;

-- 09.11 (владелец: найм — событие дня найма): разбивки найма (источник, канал, грейд, специализация) — не здесь, а из
-- переходов hub · 5 (те же строки, что «Найм, чел»: вид h и переходы в найм, срез дня найма; датасет 2)

-- 26.10-б: увольнения по инициатору и месяцу за всю сетку — «Текучесть по инициатору» (датасет отдаёт выбранному юниту)
insert into teampulse_hub_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c, 'xim' as mx_key,
       coalesce(nullif(translate(e.fire_initiative::text, E'\t\n|', '  /'), '-'), '') || '|' || to_char(e.report_month, 'YYYY-MM') as mx_val,
       coalesce(e.fire_amt, 0) as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.report_month, s.fire_amt, s.fire_initiative,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from all_metrics_with_performance_and_office_traffic_and_grt s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.report_month >= (select grid_start from teampulse_hub_cal)
    ) x
) e
where coalesce(e.fire_amt, 0) > 0;

-- поставка 101 (файл 7, п. 2): увольнения по специализации и месяцу с начала года — помесячная детализация «Движения по
-- специализациям» (отток строки специализации по месяцам; в сумме — xsp)
insert into teampulse_hub_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c, 'xsm' as mx_key,
       coalesce(nullif(translate(e.specialization::text, E'\t\n|', '  /'), '-'), '') || '|' || to_char(e.report_month, 'YYYY-MM') as mx_val,
       coalesce(e.fire_amt, 0) as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.report_month, s.fire_amt, s.specialization,
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

-- поставка 73: T-рост по эталону отчёта «Рост» дашборда HQ. Тип заявки: s — смена специализации, g — повышение
-- грейда; поток: 1 — T@T, 0 — «Рост»; итог: ok — завершена (рост состоялся), no — отклонена. Месяц — месяц итога
-- (последней смены статуса), юнит — человека в месяце начала заявки (structure_x_rost).
-- rm — заявки с итогом по месяцам сетки: «ГГГГ-ММ|тип|поток|итог»
insert into teampulse_hub_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c, 'rm' as mx_key,
       to_char(e.finish_month, 'YYYY-MM') || '|' || (case when coalesce(e.specialization_change_application_flg, 0) = 1 then 's' else 'g' end) || '|' || (case when coalesce(e.tat_flg, 0) > 0 then '1' else '0' end) || '|' || (case when coalesce(e.is_approved, 0) = 1 then 'ok' when coalesce(e.is_declined, 0) = 1 then 'no' end) as mx_val,
       1 as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.finish_month, s.is_approved, s.is_declined, s.grade_change_application_flg,
               s.specialization_change_application_flg, s.tat_flg, s.required_grade_num,
               s.required_specialization, s.current_grade_num, s.current_specialization,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from structure_x_rost s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.finish_month >= (select grid_start from teampulse_hub_cal) and s.finish_month <= (select lm from teampulse_hub_cal)
    ) x
) e
where (case when coalesce(e.is_approved, 0) = 1 then 'ok' when coalesce(e.is_declined, 0) = 1 then 'no' end) is not null;

-- rq — за окно (поставка 90: с января по последний закрытый месяц): «вид|поток|итог|желаемое|текущее», g — грейд,
-- s — специализация
-- (поставка 81: текущее — откуда переходят, в отчёте «текущий → желаемый»)
insert into teampulse_hub_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c, 'rq' as mx_key,
       (case when coalesce(e.specialization_change_application_flg, 0) = 1 then 's' else 'g' end) || '|' || (case when coalesce(e.tat_flg, 0) > 0 then '1' else '0' end) || '|' || (case when coalesce(e.is_approved, 0) = 1 then 'ok' when coalesce(e.is_declined, 0) = 1 then 'no' end) || '|' ||
           (case when (case when coalesce(e.specialization_change_application_flg, 0) = 1 then 's' else 'g' end) = 'g' then coalesce(e.required_grade_num::text, '')
                 else coalesce(nullif(translate(e.required_specialization::text, E'\t\n|', '  /'), '-'), '') end) || '|' ||
           (case when (case when coalesce(e.specialization_change_application_flg, 0) = 1 then 's' else 'g' end) = 'g' then coalesce(e.current_grade_num::text, '')
                 else coalesce(nullif(translate(e.current_specialization::text, E'\t\n|', '  /'), '-'), '') end) as mx_val, 1 as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.finish_month, s.is_approved, s.is_declined, s.grade_change_application_flg,
               s.specialization_change_application_flg, s.tat_flg, s.required_grade_num,
               s.required_specialization, s.current_grade_num, s.current_specialization,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from structure_x_rost s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.finish_month >= date_trunc('year', (select lm from teampulse_hub_cal))::date and s.finish_month <= (select lm from teampulse_hub_cal)
    ) x
) e
where (case when coalesce(e.is_approved, 0) = 1 then 'ok' when coalesce(e.is_declined, 0) = 1 then 'no' end) is not null;

-- rs — статус роста человека на последний месяц (люди численности, одна строка человека), как эталон: заявки с итогом
-- в окне (поставка 90: январь..последний закрытый месяц); в работе и завершена — again («прошёл рост и участвует
-- снова»), только в работе — first («сейчас в росте»), только завершена — done («рост состоялся»), только отклонена —
-- denied, иначе none. Тип: у again и first — заявки в работе (грейд, иначе специализация), у done — завершённых (оба
-- типа — gs), у denied — отклонённых; у none — рост доступен (av: у специализации есть дата запуска T-роста
-- в справочнике) или нет (nd). Значение «статус|тип|грейд»
insert into teampulse_hub_mixr
with r as (
    select mdm_employee_rk,
           max(is_approved) as ok, max(is_inprogress) as act, max(is_declined) as dcl,
           max((is_approved = 1 and grade_change_application_flg = 1)::int) as okg,
           max((is_approved = 1 and specialization_change_application_flg = 1)::int) as oks,
           max((is_inprogress = 1 and grade_change_application_flg = 1)::int) as actg,
           max((is_declined = 1 and grade_change_application_flg = 1)::int) as dclg
    from rost_info
    where finish_month >= date_trunc('year', (select lm from teampulse_hub_cal))::date and finish_month <= (select lm from teampulse_hub_cal)
    group by mdm_employee_rk
), av as (
    select distinct d.mdm_employee_rk
    from usr_cross_data.hr_executive_proteus d
    join prod_v_dds_dic.employee_specialization sd
      on sd.employee_specialization_dk::text = d.emp_specialization_dk::text and coalesce(sd.deleted_flg, 0) = 0
     and d.calendar_dt between sd.valid_from_dttm and sd.valid_to_dttm and sd.tgrowth_effective_dt is not null
    where d.calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date
      and d.calendar_dt = (select dt from teampulse_hub_cal)
), p as (
    select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c, coalesce(nullif(translate(e.grade::text, E'\t\n|', '  /'), '-'), '') as gr,
           case when r.act = 1 and r.ok = 1 then 'again' when r.act = 1 then 'first' when r.ok = 1 then 'done'
                when r.dcl = 1 then 'denied' else 'none' end as st,
           case when r.act = 1 then (case when r.actg = 1 then 'g' else 's' end)
                when r.ok = 1 then (case when r.okg = 1 and r.oks = 1 then 'gs' when r.okg = 1 then 'g' else 's' end)
                when r.dcl = 1 then (case when r.dclg = 1 then 'g' else 's' end)
                when a.mdm_employee_rk is not null then 'av' else 'nd' end as tp
    from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.report_month, s.grade, s.mdm_employee_rk, s.hc_total_cnt, s.last_row_flg,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from all_metrics_with_performance_and_office_traffic_and_grt s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.report_month = (select lm from teampulse_hub_cal) and coalesce(s.hc_total_cnt, 0) > 0 and s.last_row_flg = 1
    ) x
) e
    left join r on r.mdm_employee_rk = e.mdm_employee_rk
    left join av a on a.mdm_employee_rk = e.mdm_employee_rk
)
select node_rk, paint_c, it_c, staff_c, act_c, 'rs' as mx_key, st || '|' || tp || '|' || gr as mx_val, 1 as mx_n
from p;

-- поставка 66: посещения офисов по городам (office_city_visits_json — параграф with_office_traffic), поставка 90 — за
-- последний закрытый месяц:
-- oc — посещений, ocp — людей, которые были в офисе этого города; 06.11: ocd — рабочие дни города
-- (посещаемость города = oc / ocd, как в мастере)
insert into teampulse_hub_mixr
select c.node_rk, c.paint_c, c.it_c, c.staff_c, c.act_c,
       unnest(ARRAY['oc', 'ocp', 'ocd']) as mx_key,
       unnest(ARRAY[c.city, c.city, c.city]) as mx_val,
       unnest(ARRAY[c.vis, case when c.vis > 0 then 1 else 0 end, c.wd]) as mx_n
from (
    select j.node_rk, j.paint_c, j.it_c, j.staff_c, j.act_c, coalesce(nullif(translate((j.v ->> 'office_city_nm')::text, E'\t\n|', '  /'), '-'), '') as city,
           coalesce((j.v ->> 'visit_count')::numeric, 0) as vis,
           coalesce((j.v ->> 'work_day_count')::numeric, 0) as wd
    from (
        select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c, json_array_elements(e.office_city_visits_json::json) as v
        from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.office_city_visits_json,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from all_metrics_with_performance_and_office_traffic_and_grt s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.report_month = (select cm from teampulse_hub_cal) and s.office_city_visits_json is not null
    ) x
) e
    ) j
) c
where c.vis > 0 or c.wd > 0;   -- 06.11: ocd нужны и дни не-посетителей (ocp у них 0)

-- 31.10-б, п. 9: то же у руководителей (признак руководителя) — кросс-фильтр «руководители / сотрудники × город»:
-- ocl — посещений, ocpl — руководителей; у сотрудников — всё минус руководители
insert into teampulse_hub_mixr
select c.node_rk, c.paint_c, c.it_c, c.staff_c, c.act_c,
       unnest(ARRAY['ocl', 'ocpl']) as mx_key,
       unnest(ARRAY[c.city, c.city]) as mx_val,
       unnest(ARRAY[c.vis, 1]) as mx_n
from (
    select j.node_rk, j.paint_c, j.it_c, j.staff_c, j.act_c, coalesce(nullif(translate((j.v ->> 'office_city_nm')::text, E'\t\n|', '  /'), '-'), '') as city,
           coalesce((j.v ->> 'visit_count')::numeric, 0) as vis
    from (
        select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c, json_array_elements(e.office_city_visits_json::json) as v
        from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.office_city_visits_json, s.management_head_flg,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from all_metrics_with_performance_and_office_traffic_and_grt s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.report_month = (select cm from teampulse_hub_cal) and s.office_city_visits_json is not null and coalesce(s.management_head_flg::text, '0') = '1'
    ) x
) e
    ) j
) c
where c.vis > 0;

-- 27.10-в, п. 14: нарушения брони по городам последнего закрытого месяца (поставка 90): ov — нарушений (бронь без
-- посещения + посещение без брони), ob — база (дней с бронью + посещений без брони), как «Нарушения бронирования»
-- за месяц
insert into teampulse_hub_mixr
select c.node_rk, c.paint_c, c.it_c, c.staff_c, c.act_c,
       unnest(ARRAY['ov', 'ob']) as mx_key,
       unnest(ARRAY[c.city, c.city]) as mx_val,
       unnest(ARRAY[c.viol, c.base]) as mx_n
from (
    select j.node_rk, j.paint_c, j.it_c, j.staff_c, j.act_c, coalesce(nullif(translate((j.v ->> 'office_city_nm')::text, E'\t\n|', '  /'), '-'), '') as city,
           coalesce((j.v ->> 'booking_viol_count')::numeric, 0) + coalesce((j.v ->> 'visit_viol_count')::numeric, 0) as viol,
           coalesce((j.v ->> 'booking_count')::numeric, 0) + coalesce((j.v ->> 'visit_viol_count')::numeric, 0) as base
    from (
        select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c, json_array_elements(e.office_city_visits_json::json) as v
        from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.office_city_visits_json,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from all_metrics_with_performance_and_office_traffic_and_grt s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.report_month = (select cm from teampulse_hub_cal) and s.office_city_visits_json is not null
    ) x
) e
    ) j
) c
where c.base > 0;

-- поставка 66: календарь посещений (office_traffic_calendar — параграф office_traffic), поставка 90 — с месяца перед
-- последним закрытым по текущий:
-- dw — людей с рабочим днём, do — из них в офисе; значение — дата
insert into teampulse_hub_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
       unnest(ARRAY['dw', 'do']) as mx_key,
       unnest(ARRAY[to_char(e.calendar_dt, 'YYYY-MM-DD'), to_char(e.calendar_dt, 'YYYY-MM-DD')]) as mx_val,
       unnest(ARRAY[coalesce(e.cnt_work_day, 0), coalesce(e.cnt_office_visit, 0)]) as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.calendar_dt, s.cnt_work_day, s.cnt_office_visit,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from office_traffic_calendar s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.report_month between ((select cm from teampulse_hub_cal) - interval '1 month')::date and (select lm from teampulse_hub_cal)
    ) x
) e;

-- поставка 108 (владелец, 06.11): KPI мониторинга за весь период — 16 последних полных недель (понедельник–воскресенье).
-- Конец периода — последнее воскресенье не позже последнего дня дневного источника (и не позже даты данных), начало — на
-- 16 недель раньше: границы — по данным. По каждому человеку за период целиком (не сумма месячных долей):
--   прогулы — дней с working_balance = -1, работа в выходные — дней с working_balance = 1: 2–5 и больше 5 дней;
--   звонки — 100 × часы звонков ÷ рабочие часы по плановым дням периода (округление до 0,1, как сегмент месяца):
--   20–30, 30–50, больше 50%; без рабочих часов — нет данных (в звонки не идёт).
-- База — численность месяца конца периода (hc_total_cnt = 1, последняя строка человека в месяце: юнит и срезы — его),
-- как категории мониторинга. mp — люди: hc (база), ab25 ab5 we25 we5 t23 t35 t5; mpd — период «начало|конец», n — люди
drop table if exists teampulse_hub_mpp;
create table teampulse_hub_mpp as
select (date_trunc('week', b.mx + 1)::date - 1) - 16 * 7 + 1 as ws, date_trunc('week', b.mx + 1)::date - 1 as we
from (
    select max(d.calendar_dt)::date as mx
    from prod_v_sse_crossdata.performance_metric_d d
    where d.calendar_dt >= date_trunc('year', current_date - interval '1 year')
      and d.calendar_dt <= (select dt from teampulse_hub_cal)
) b
where b.mx is not null
distributed by (ws);

drop table if exists teampulse_hub_mpd;
create table teampulse_hub_mpd as
select d.mdm_employee_rk as rk,
       sum(case when d.working_balance = -1 then 1 else 0 end) as ab,
       sum(case when d.working_balance = 1 then 1 else 0 end) as wo,
       sum(case when d.plan_working_day_flg = 1 then d.duration_hour end) as dur,
       sum(case when d.plan_working_day_flg = 1 then d.talk_call_duration_h end) as tlk
from prod_v_sse_crossdata.performance_metric_d d
join teampulse_hub_mpp p on d.calendar_dt between p.ws and p.we
where d.calendar_dt >= date_trunc('year', current_date - interval '1 year')
group by 1
distributed by (rk);

insert into teampulse_hub_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
       unnest(ARRAY['mp', 'mp', 'mp', 'mp', 'mp', 'mp', 'mp', 'mp', 'mpd']) as mx_key,
       unnest(ARRAY['hc', 'ab25', 'ab5', 'we25', 'we5', 't23', 't35', 't5',
                    to_char(p.ws, 'YYYY-MM-DD') || '|' || to_char(p.we, 'YYYY-MM-DD')]) as mx_val,
       unnest(ARRAY[1,
                    (coalesce(m.ab, 0) between 2 and 5)::int, (coalesce(m.ab, 0) > 5)::int,
                    (coalesce(m.wo, 0) between 2 and 5)::int, (coalesce(m.wo, 0) > 5)::int,
                    (m.sh >= 20 and m.sh <= 30)::int, (m.sh > 30 and m.sh <= 50)::int, (m.sh > 50)::int,
                    1]) as mx_n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.mdm_employee_rk, s.hc_total_cnt, s.last_row_flg,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from all_metrics_with_performance_and_office_traffic_and_grt s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 and s.report_month = (select date_trunc('month', we)::date from teampulse_hub_mpp) and coalesce(s.hc_total_cnt, 0) > 0 and s.last_row_flg = 1
    ) x
) e
cross join teampulse_hub_mpp p
left join (
    select rk, ab, wo, case when coalesce(dur, 0) > 0 then round(100.0 * coalesce(tlk, 0) / dur, 1) end as sh
    from teampulse_hub_mpd
) m on m.rk = e.mdm_employee_rk;
drop table if exists teampulse_hub_mpd;
drop table if exists teampulse_hub_mpp;

-- 03.11, поставка 103: профили численности последнего месяца — пересечения разрезов без оценки (конструктор, срез по
-- нескольким разрезам, портрет, средний возраст в срезе). Человек — один раз, в нижнем юните; узел ответа (выбранный
-- юнит, подразделения на три уровня вниз, «напрямую») датасет находит по пути юнита. Строка — сочетание разрезов
-- g a t gr s c tc o w r sp rg номерами словаря teampulse_hub_pfd и возраст: pf = «номер.номер….номер:возраст», cnt — людей
drop table if exists teampulse_hub_pfx;
create table teampulse_hub_pfx as
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
       coalesce(nullif(translate(e.gender::text, E'\t\n|', '  /'), '-'), '') as k_g,
       coalesce(nullif(translate(e.type_age::text, E'\t\n|', '  /'), '-'), '') as k_a,
       coalesce(nullif(translate(e.experience_group_nm::text, E'\t\n|', '  /'), '-'), '') as k_t,
       coalesce(nullif(translate(e.grade::text, E'\t\n|', '  /'), '-'), '') as k_gr,
       coalesce(nullif(translate(e.seniority::text, E'\t\n|', '  /'), '-'), '') as k_s,
       coalesce(nullif(translate(e.employee_contract_type::text, E'\t\n|', '  /'), '-'), '') as k_c,
       coalesce(nullif(translate(e.type_company::text, E'\t\n|', '  /'), '-'), '') as k_tc,
       coalesce(nullif(translate(e.legal_organization::text, E'\t\n|', '  /'), '-'), '') as k_o,
       coalesce(nullif(translate(e.employee_stream::text, E'\t\n|', '  /'), '-'), '') as k_w,
       coalesce(nullif(translate(e.employment_relation_type::text, E'\t\n|', '  /'), '-'), '') as k_r,
       coalesce(nullif(translate(e.specialization::text, E'\t\n|', '  /'), '-'), '') as k_sp,
       coalesce(nullif(translate(e.region::text, E'\t\n|', '  /'), '-'), '') as k_rg,
       (case when trim(e.age::text) ~ '^[0-9]+([.,][0-9]+)?$' then replace(trim(e.age::text), ',', '.')::numeric end) as age, coalesce(e.hc_total_cnt, 0) as n
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.hc_total_cnt, s.gender, s.type_age, s.age, s.experience_group_nm, s.grade, s.seniority,
               s.employee_contract_type, s.legal_organization, s.employee_stream, s.employment_relation_type,
               s.specialization, s.type_company, s.region, s.management_head_flg,
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
  and e.node_rk = (string_to_array(e.cp, '|'))[array_upper(string_to_array(e.cp, '|'), 1)]
distributed by (node_rk);

-- словарь: разрез × значение → номер (0 — самое частое по компании)
drop table if exists teampulse_hub_pfd;
create table teampulse_hub_pfd as
select k, v, (row_number() over (partition by k order by n desc, v) - 1)::int as i
from (
    select k, v, sum(n) as n
    from (select unnest(ARRAY['g', 'a', 't', 'gr', 's', 'c', 'tc', 'o', 'w', 'r', 'sp', 'rg']) as k,
                 unnest(ARRAY[k_g, k_a, k_t, k_gr, k_s, k_c, k_tc, k_o, k_w, k_r, k_sp, k_rg]) as v, n
          from teampulse_hub_pfx) t
    group by 1, 2
) t
distributed randomly;

drop table if exists teampulse_hub_prof;
create table teampulse_hub_prof as
select x.node_rk, x.paint_c as paint_cd, x.it_c as it_cd, x.staff_c as staff_cd, x.act_c as act_cd,
       d_g.i::text || '.' || d_a.i::text || '.' || d_t.i::text || '.' || d_gr.i::text || '.' || d_s.i::text || '.' || d_c.i::text || '.' || d_tc.i::text || '.' || d_o.i::text || '.' || d_w.i::text || '.' || d_r.i::text || '.' || d_sp.i::text || '.' || d_rg.i::text || ':' || coalesce(case when x.age = round(x.age) then round(x.age)::int::text else round(x.age, 1)::text end, '') as pf,
       sum(x.n) as cnt
from teampulse_hub_pfx x
join teampulse_hub_pfd d_g on d_g.k = 'g' and d_g.v = x.k_g
join teampulse_hub_pfd d_a on d_a.k = 'a' and d_a.v = x.k_a
join teampulse_hub_pfd d_t on d_t.k = 't' and d_t.v = x.k_t
join teampulse_hub_pfd d_gr on d_gr.k = 'gr' and d_gr.v = x.k_gr
join teampulse_hub_pfd d_s on d_s.k = 's' and d_s.v = x.k_s
join teampulse_hub_pfd d_c on d_c.k = 'c' and d_c.v = x.k_c
join teampulse_hub_pfd d_tc on d_tc.k = 'tc' and d_tc.v = x.k_tc
join teampulse_hub_pfd d_o on d_o.k = 'o' and d_o.v = x.k_o
join teampulse_hub_pfd d_w on d_w.k = 'w' and d_w.v = x.k_w
join teampulse_hub_pfd d_r on d_r.k = 'r' and d_r.v = x.k_r
join teampulse_hub_pfd d_sp on d_sp.k = 'sp' and d_sp.v = x.k_sp
join teampulse_hub_pfd d_rg on d_rg.k = 'rg' and d_rg.v = x.k_rg
group by 1, 2, 3, 4, 5, 6
distributed by (node_rk);
drop table if exists teampulse_hub_pfx;

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
