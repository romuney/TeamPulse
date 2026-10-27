-- =============================================================================
-- TeamPulse Hub
-- заявки T-роста (Адель, 27.10): по заявке — месяц подачи, грейд и специализация сейчас и желаемые, статус,
-- признаки смены грейда и специализации и потока T@T (у заявки есть желаемый уровень T@T). Из неё — with_TRost
-- (заявки к людям) и structure_x_rost (заявки к структуре)
-- =============================================================================
drop table if exists rost_info ;
create table rost_info as

SELECT
        ap.mdm_employee_application_rk as mdm_employee_rk,
        date_trunc('month', ap.create_dttm) as month,
        ap.create_dttm,
        ap.current_grade_num,
        ap.required_grade_num,
        es.employee_specialization_desc current_specialization,
        res.employee_specialization_desc required_specialization,
        ap.head_approve_flg,
        mdm_employee_appl_status_desc,
        case when ap.mdm_employee_appl_status_cd in ('FNS') then 1 else 0 end as is_approved, --  прошел ТРост
        case when ap.mdm_employee_appl_status_cd in ('DCL') then 1 else 0 end as is_declined, -- отклонено руководителем, не прошел ТРост
        case when ap.mdm_employee_appl_status_cd in ('CNL') then 1 else 0 end as is_cancelled, -- отмена заявки на ТРост
        case when ap.mdm_employee_appl_status_cd not in ('DCL', 'FNS', 'CNL') then 1 else 0 end as is_inprogress, -- ожидает решения руководителем
        case when current_grade_num <> required_grade_num then 1 else 0 end as grade_change_application_flg, --  изменил грейд
        case when current_specialization_dk <> required_specialization_dk then 1 else 0 end as specialization_change_application_flg,   -- изменил специализацию 
         -- из всех заявок, из тех, что прошли ТРост, из тех, что прошли ТаТ
        case when required_tat_level_num is not null then 1 else 0 end as tat_flg
    from prod_v_dds.mdm_employee_application_grt ap
    join prod_v_dds_dic.mdm_employee_appl_status s
        on ap.mdm_employee_appl_status_cd= s.mdm_employee_appl_status_cd
    LEFT JOIN prod_v_dds_dic.employee_specialization es on ap.current_specialization_dk = es.employee_specialization_dk and es.valid_to_dttm = '5999-01-01'
    LEFT JOIN prod_v_dds_dic.employee_specialization res on ap.required_specialization_dk = res.employee_specialization_dk and res.valid_to_dttm = '5999-01-01'
    where ap.valid_to_dttm = '5999-01-01'
        --and mdm_employee_appl_status_cd in ('FNS', 'CNL', 'DCL')
        and ap.mdm_employee_appl_status_cd not in ('DRT') -- draft
        and ap.deleted_flg = 0

distributed by (mdm_employee_rk, month);
