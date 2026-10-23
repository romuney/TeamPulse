# тут больше не считаем переводы, все разрезы вынесены в fields
fields = [
    # простая строка — coalesce(col::text, '-')
    'gender',
    'type_age',
    'experience_group_nm',
    'grade',
    'seniority',
    'fire_reason_group',
    'fire_initiative',
    'type_company',
    'source_type_nm',
    # dict без match — то же самое, но с явным alias
    {'name': 'active_type_nm',                  'alias': 'act_type_nm'},
    {'name': 'employment_relation_type_desc',   'alias': 'employment_relation_type'},
    {'name': 'employee_contract_type_desc',     'alias': 'employee_contract_type'},
    {'name': 'lvl1_legal_unit_nm',              'alias': 'legal_organization'},
    {'name': 'employee_stream_desc',            'alias': 'employee_stream'},
    {'name': 'type_of_work',                    'alias': 'work_format'},
    {'name': 'employee_specialization_desc',    'alias': 'specialization'},
    {'name': 'residential_state_nm',            'alias': 'region'},
    {'name': 'emp_specialization_oper_code',    'alias': 'paint_cd'},
    # dict с match — CASE WHEN ... IN (...) THEN ... ELSE ...
    # новый разрез добавляется сюда, код функции не трогаем
    #  'match': 'Офис', 'match_label': 'офис', 'other_label': 'не офис'},
]

# срез отчёта TeamPulse Hub — покраска (HQ, Line, Support). В hr_structure_overall не идёт:
# group_and_sum_metrics берёт ключами только fields. IT-код — в FIXED_DIMS, как в источнике
HUB_FIELDS = [
]

build_all_metrics(
    res_table_name='all_metrics',
    source_table='usr_cross_data.hr_executive_proteus',
    fields=fields + HUB_FIELDS,

    hire=True,
    outflow=True,
    transfers=False,
    # debug = True
)
