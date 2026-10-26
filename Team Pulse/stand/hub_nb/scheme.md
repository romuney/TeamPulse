# Схема

```
hr_executive_proteus (по дням)
  └─ build_all_metrics ──────────────── all_metrics: человек × месяц × юнит
       ├─ with_performance / with_office_traffic / with_TRost  → …_and_grt (одна строка человека — last_row_flg)
       │    └─ hub · 0 … hub · 6 (gp) → teampulse_hub_meta / _unit / _series / _mix / _trf / _vacancy / _ai ─┐
       │                                hub checks (gp)                                                      │
       ├─ office_traffic → office_traffic_calendar (посещения по дням) → hub · 4                             │
       └─ org_structure ← unit_head_structure (руководитель юнита) → hub · 2 (имя руководителя)              │
office_traffic_attendance → with_office_traffic (бронирования, города), office_traffic                       │
vacancy_daily → structure_x_vacancy (gp) → hub · 6                                                           │
                                         to click (gp_to_click) ←────────────────────────────────────────────┘
                                           teampulse_hub_*
```

Виртуальный датасет отчёта (файл 2а поставки) читает только `teampulse_hub_*`. `hr_structure_overall` выгружает
ноутбук TP 2.0 (`group_and_sum_metrics` и `calc_ssch` — там).
