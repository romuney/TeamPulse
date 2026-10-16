# Схема

```
hr_executive_proteus (по дням)
  └─ build_all_metrics ──────────────── all_metrics: человек × месяц × юнит
       ├─ with_performance / with_office_traffic / with_TRost  → …_and_grt (одна строка человека — last_row_flg)
       │    ├─ group_and_sum_metrics → calc_ssch → hr_structure_with_ssch ─┐
       │    └─ build_hub → teampulse_hub_meta / _unit / _series / _mix ───┤
       │                    hub checks                                     │
       └─ org_structure                                                    │
vacancy_daily → vacancy_by_unit                                            │
                                         to click (gp_to_click) ←──────────┘
                                           hr_structure_overall, teampulse_hub_*
```

Виртуальный датасет отчёта (файл 2а поставки) читает только `teampulse_hub_*`.
