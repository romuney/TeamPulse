# Таблицы TeamPulse Hub из таблицы человек × месяц × юнит (после перформанса, посещаемости
# и T-роста). debug=True — только напечатать SQL
build_hub(
    source='all_metrics_with_performance_and_office_traffic_and_grt',
    prefix='teampulse_hub',
    # debug=True,
)
