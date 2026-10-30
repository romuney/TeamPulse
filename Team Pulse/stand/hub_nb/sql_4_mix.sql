-- =============================================================================
-- TeamPulse Hub · 4. Разрезы (поставка 58: SQL вместо build_hub)
-- teampulse_hub_mix — узел × срез × разрез × значение: численность последнего месяца по атрибутам
-- (g a t gr s c o w r sp tc rg ws mh), увольнения с начала его года (xr причина, xq regret по причине, xi
-- инициатива, xp причина|инициатива, xt стаж, xg грейд, xs стрим, xsp специализация, xtc тип компании),
-- найм с начала года (hk источник, hch канал, hg грейд, hsp специализация). Поставка 66 (посещения Адели):
-- oc / ocp — посещений и людей по городу офиса за последний месяц, dw / do — календарь двух последних
-- месяцев: людей с рабочим днём и из них в офисе, значение — дата. 26.10-б: xim — увольнения по инициатору
-- и месяцу всей сетки, значение «инициатор|ГГГГ-ММ» (текучесть по инициатору). 31.10: sp0 — численность
-- по специализации на конец прошлого года (на начало периода). Пустое значение — ''.
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

-- rq — за окно (с начала месяца 12 месяцев назад): «вид|поток|итог|желаемое|текущее», g — грейд, s — специализация
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
        where s.leaf_lvl > 0 and s.finish_month >= ((select lm from teampulse_hub_cal) - interval '12 month')::date and s.finish_month <= (select lm from teampulse_hub_cal)
    ) x
) e
where (case when coalesce(e.is_approved, 0) = 1 then 'ok' when coalesce(e.is_declined, 0) = 1 then 'no' end) is not null;

-- rs — статус роста человека на последний месяц (люди численности, одна строка человека), как эталон: заявки с итогом
-- в окне; в работе и завершена — again («прошёл рост и участвует снова»), только в работе — first («сейчас в росте»),
-- только завершена — done («рост состоялся»), только отклонена — denied, иначе none. Тип: у again и first — заявки в
-- работе (грейд, иначе специализация), у done — завершённых (оба типа — gs), у denied — отклонённых; у none — рост
-- доступен (av: у специализации есть дата запуска T-роста в справочнике) или нет (nd). Значение «статус|тип|грейд»
insert into teampulse_hub_mixr
with r as (
    select mdm_employee_rk,
           max(is_approved) as ok, max(is_inprogress) as act, max(is_declined) as dcl,
           max((is_approved = 1 and grade_change_application_flg = 1)::int) as okg,
           max((is_approved = 1 and specialization_change_application_flg = 1)::int) as oks,
           max((is_inprogress = 1 and grade_change_application_flg = 1)::int) as actg,
           max((is_declined = 1 and grade_change_application_flg = 1)::int) as dclg
    from rost_info
    where finish_month >= ((select lm from teampulse_hub_cal) - interval '12 month')::date and finish_month <= (select lm from teampulse_hub_cal)
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

-- поставка 66: посещения офисов последнего месяца по городам (office_city_visits_json — параграф with_office_traffic):
-- oc — посещений, ocp — людей, которые были в офисе этого города
insert into teampulse_hub_mixr
select c.node_rk, c.paint_c, c.it_c, c.staff_c, c.act_c,
       unnest(ARRAY['oc', 'ocp']) as mx_key,
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
        where s.leaf_lvl > 0 and s.report_month = (select lm from teampulse_hub_cal) and s.office_city_visits_json is not null
    ) x
) e
    ) j
) c
where c.vis > 0;

-- 27.10-в, п. 14: нарушения брони по городам последнего месяца: ov — нарушений (бронь без посещения + посещение без
-- брони), ob — база (дней с бронью + посещений без брони), как «Нарушения бронирования» за месяц
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
        where s.leaf_lvl > 0 and s.report_month = (select lm from teampulse_hub_cal) and s.office_city_visits_json is not null
    ) x
) e
    ) j
) c
where c.base > 0;

-- поставка 66: календарь посещений двух последних месяцев (office_traffic_calendar — параграф office_traffic):
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
        where s.leaf_lvl > 0 and s.report_month between ((select lm from teampulse_hub_cal) - interval '1 month')::date and (select lm from teampulse_hub_cal)
    ) x
) e;

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
