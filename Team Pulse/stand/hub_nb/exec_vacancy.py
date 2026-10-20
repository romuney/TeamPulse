# Снимок «структура × вакансии» до витрины отчёта (build_hub, шаг 11 — teampulse_hub_vacancy).
# Источника нет — таблица пустая, вакансии в отчёте остаются «в разработке». debug=True — только SQL
build_structure_x_vacancy(
    source='usr_cross_data.vacancy_daily',
    structure='org_structure',
    target='structure_x_vacancy',
    # debug=True,
)
