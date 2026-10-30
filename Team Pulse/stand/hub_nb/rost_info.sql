-- =============================================================================
-- TeamPulse Hub
-- заявки T-роста (поставка 73 — по эталону отчёта «Рост» дашборда HQ и ноутбуку Адели 28.10): по заявке — сотрудник
-- месяц начала (дата старта согласования, иначе
-- создания — по нему юнит заявки), месяц итога (valid_from_dttm — последняя смена статуса: для одобренной и
-- отклонённой — месяц решения), грейд и специализация сейчас и желаемые, статус, тип (смена специализации — по
-- specialization_change_flg, иначе повышение грейда), поток T@T (у заявки есть уровень T@T). Как в эталоне: только
-- HQ-специализации, без стажёров, без черновиков, актуальная версия заявки
-- =============================================================================
drop table if exists rost_info ;
create table rost_info as

select
        ap.mdm_employee_application_id as application_id,
        ap.creator_mdm_employee_rk as mdm_employee_rk,
        ap.company_hire_dt::date as company_hire_dt,
        date_trunc('month', coalesce(ap.hd1_init_dt::date, ap.create_dt::date))::date as month,
        date_trunc('month', ap.valid_from_dttm)::date as finish_month,
        ap.create_dt,
        ap.current_grade_num,
        ap.required_grade_num,
        ap.current_specialization_desc as current_specialization,
        ap.required_specialization_desc as required_specialization,
        ap.mdm_employee_appl_status_cd,
        s.mdm_employee_appl_status_desc,
        case when ap.mdm_employee_appl_status_cd = 'FNS' then 1 else 0 end as is_approved,     -- завершена: рост состоялся
        case when ap.mdm_employee_appl_status_cd = 'DCL' then 1 else 0 end as is_declined,     -- отклонена
        case when ap.mdm_employee_appl_status_cd = 'CNL' then 1 else 0 end as is_cancelled,    -- отменена
        case when ap.mdm_employee_appl_status_cd not in ('DRT', 'FNS', 'DCL', 'CNL') then 1 else 0 end as is_inprogress,
        case when coalesce(ap.specialization_change_flg, 0) = 1 then 0 else 1 end as grade_change_application_flg,
        case when coalesce(ap.specialization_change_flg, 0) = 1 then 1 else 0 end as specialization_change_application_flg,
        case when ap.current_tat_num is not null or ap.required_tat_num is not null then 1 else 0 end as tat_flg
from usr_cross_data.mdm_employee_application_grt ap
left join prod_v_dds_dic.mdm_employee_appl_status s
    on ap.mdm_employee_appl_status_cd = s.mdm_employee_appl_status_cd
where ap.valid_to_dttm = '5999-01-01 00:00:00'
    and ap.mdm_employee_appl_status_cd <> 'DRT'
    --and ap.current_specialization_oper_code = 'Hq'
    and coalesce(ap.current_specialization_desc, '') not in ('Стажеры IT', 'Стажеры Digital', 'Стажеры non-IT')

distributed by (mdm_employee_rk, month);
