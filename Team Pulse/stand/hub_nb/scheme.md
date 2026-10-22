# Схема

```
hr_executive_proteus (по дням)
  └─ build_all_metrics ──────────────── all_metrics: человек × месяц × юнит
       ├─ with_performance / with_office_traffic / with_TRost  → …_and_grt (одна строка человека — last_row_flg)
       │    ├─ group_and_sum_metrics → calc_ssch → hr_structure_with_ssch
       │    └─ hub · 0 … hub · 6 (gp) → teampulse_hub_meta / _unit / _series / _mix / _trf / _vacancy / _ai ─┐
       │                                hub checks (gp)                                                      │
       └─ org_structure                                                                                      │
vacancy_daily → structure_x_vacancy (gp) → hub · 6                                                           │
                                         to click (gp_to_click) ←────────────────────────────────────────────┘
                                           teampulse_hub_*
```

Виртуальный датасет отчёта (файл 2а поставки) читает только `teampulse_hub_*`.
