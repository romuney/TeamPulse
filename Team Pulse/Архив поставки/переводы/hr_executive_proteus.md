# Витрина `usr_cross_data.hr_executive_proteus`

## Общая информация

| Параметр | Значение |
|---|---|
| **FQN** (для SQL) | `usr_cross_data.hr_executive_proteus` |
| **Система** | Greenplum (GP) |
| **Тип** | TABLE |
| **Гранулярность** | человек (`mdm_employee_rk`) × день (`calendar_dt`) |
| **Distribution key** | `calendar_dt, mdm_employee_rk` |
| **~Оценка строк** | ~15 152 000 |
| **Тип (пайплайн)** | производная витрина HR (ежедневные снимки) |

Источник данных для TeamPulse Hub (`build_all_metrics`, `structure_x_vacancy`, `teampulse_hub_trf`).

> ⚠️ В Data Detective на момент выгрузки **по-полю описаний нет** (все `description`/`comment` пустые).
> Описания ниже приведены по смыслу названий колонок и по их использованию в ноутбуке TeamPulse Hub.
> При наличии общей документации карточки её стоит сверить.

## Группы полей

| Группа | Что содержит |
|---|---|
| Идентификаторы | `mdm_employee_rk`, `fr_employee_rk` |
| Даты и события | `calendar_dt`, `hire_dt`, `fire_dt`, `hire_flg`, `fire_flg`, `active_hire_dt`, `last_day_of_month_flg` |
| Демография | `gender`, `age`, `mdm_employee_age`, `type_age`, `residential_state_nm`, `city_nm`, `city_doc` |
| Юридическая структура | `lvl1..lvl7_legal_unit_*`, `legal_unit_id`, флаги переводов по юр. юниту |
| Управленческая структура | `management_unit_*`, `lvl1..lvl12_mngt_unit_*`, `lvl1..lvl12_mapped_management_unit_*` |
| Флаги переводов | `transfer_to_*` / `transfer_out_*`, `lvlN_mngt_unit_in/out_trsf_flg` |
| Должность / компетенции | `legal_position_nm`, `management_position_nm`, `employee_stream_*`, `employee_specialization_*`, `emp_specialization_*`, `emp_stream_dk` |
| Тип занятости | `employment_relation_type_desc`, `employee_contract_type_desc`, `staff_flg`, `internal_flg`, `fin_source_code`, `job_group_nm`, `type_of_work` |
| Активность | `active_type_nm`, `active_count_flg`, `prev_active_count_flg`, `legal_employee_flg`, `maternity_flg`, `absent_flg` |
| Отток | `fire_reason`, `fire_reason_group`, `fire_initiative`, `lose_talent`, `regrettable_*`, `non_regrettable_*`, `potential_*`, комментарии увольнения |
| Найм / стаж | `hire_dt`, `experience_year_amt`, `experience_group_nm`, `experience_detail_group_nm`, `seniority`, `grade`, `rayisa_hire_flg`, источники найма |
| Прочее | `type_company`, `type_create_company`, `source_type_nm`, `respond_source_nm`, `rb_flg`, `rb_migration_flg`, `t_education_desc`, `summary_score`, `office_desc` |

## Полный список полей (имя · тип · описание)

### Идентификаторы
| Поле | Тип | Описание |
|---|---|---|
| `mdm_employee_rk` | integer | Уникальный ключ сотрудника (MDM). Основной идентификатор человека |
| `fr_employee_rk` | integer | Ключ сотрудника в кадровой системе-источнике (FR) |

### Даты и события
| Поле | Тип | Описание |
|---|---|---|
| `calendar_dt` | date | Дата снимка (грань витрины, по дням) |
| `hire_dt` | date | Дата приёма на работу |
| `fire_dt` | date | Дата увольнения |
| `hire_flg` | smallint | Флаг: сотрудник принят в этот день (1/0) |
| `fire_flg` | smallint | Флаг: сотрудник уволен в этот день (1/0) |
| `active_hire_dt` | date | Дата приёма на «активную» работу |
| `last_day_of_month_flg` | integer | Флаг: снимок соответствует последнему дню месяца |

### Демография
| Поле | Тип | Описание |
|---|---|---|
| `gender` | varchar | Пол |
| `age` | numeric(23,0) | Возраст |
| `mdm_employee_age` | smallint | Возраст по MDM |
| `type_age` | varchar(512) | Группа возраста (используется как разрез отчёта) |
| `residential_state_nm` | text | Регион проживания |
| `city_nm` | text | Город (фактический) |
| `city_doc` | text | Город (по документу) |

### Юридическая структура (юр. юнит)
| Поле | Тип | Описание |
|---|---|---|
| `lvl1_legal_unit_rk` / `_nm` | varchar | Юр. юнит 1 уровня (ключ / имя) |
| `lvl2_legal_unit_rk` / `_nm` | varchar | Юр. юнит 2 уровня |
| `lvl3_legal_unit_rk` / `_nm` | varchar | Юр. юнит 3 уровня |
| `lvl4_legal_unit_rk` / `_nm` | varchar | Юр. юнит 4 уровня |
| `lvl5_legal_unit_rk` / `_nm` | varchar | Юр. юнит 5 уровня |
| `lvl6_legal_unit_rk` / `_nm` | varchar | Юр. юнит 6 уровня |
| `lvl7_legal_unit_rk` / `_nm` | varchar | Юр. юнит 7 уровня |
| `legal_unit_id` | varchar(2) | Идентификатор юр. юнита |
| `lvl1_legal_unit_out_trsf_flg` / `_in_trsf_flg` | integer | Флаг перевода по юр. юниту 1 уровня (выход/вход) |
| `transfer_to_lvl1_legal_flg` / `transfer_to_lvl3_legal_flg` | integer | Перевод в юр. юнит уровня 1/3 |
| `transfer_out_lvl1_legal_flg` / `transfer_out_lvl3_legal_flg` | integer | Перевод из юр. юнита уровня 1/3 |

### Управленческая структура (управленческий юнит)
| Поле | Тип | Описание |
|---|---|---|
| `management_unit_nm` | varchar | Имя управленческого юнита |
| `management_unit_rk` | varchar(32) | Ключ управленческого юнита |
| `management_unit_id` | varchar(2) | Идентификатор управленческого юнита |
| `lvl1_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 1 уровня (ключ / имя) |
| `lvl2_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 2 уровня (ключ / имя) |
| `lvl3_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 3 уровня (ключ / имя) |
| `lvl4_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 4 уровня (ключ / имя) |
| `lvl5_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 5 уровня (ключ / имя) |
| `lvl6_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 6 уровня (ключ / имя) |
| `lvl7_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 7 уровня (ключ / имя) |
| `lvl8_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 8 уровня (ключ / имя) |
| `lvl9_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 9 уровня (ключ / имя) |
| `lvl10_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 10 уровня (ключ / имя) |
| `lvl11_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 11 уровня (ключ / имя) |
| `lvl12_mngt_unit_rk` / `_nm` | varchar | Управленческий юнит 12 уровня (ключ / имя) |
| `lvl1_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 1 уровня (ключ / имя) — используется в TeamPulse Hub для построения дерева и путей |
| `lvl2_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 2 уровня (ключ / имя) |
| `lvl3_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 3 уровня (ключ / имя) |
| `lvl4_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 4 уровня (ключ / имя) |
| `lvl5_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 5 уровня (ключ / имя) |
| `lvl6_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 6 уровня (ключ / имя) |
| `lvl7_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 7 уровня (ключ / имя) |
| `lvl8_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 8 уровня (ключ / имя) |
| `lvl9_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 9 уровня (ключ / имя) |
| `lvl10_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 10 уровня (ключ / имя) |
| `lvl11_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 11 уровня (ключ / имя) |
| `lvl12_mapped_management_unit_rk` / `_nm` | varchar | **Маппированный** управленческий юнит 12 уровня (ключ / имя) |
| `management_head_flg` | integer | Флаг: руководитель управленческого юнита |

### Флаги переводов (по управленческому юниту и срезам)
| Поле | Тип | Описание |
|---|---|---|
| `lvl1_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | varchar(2) | Флаг перевода по управленческому юниту 1 уровня (выход/вход) |
| `lvl2_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | varchar(2) | Флаг перевода по управленческому юниту 2 уровня (выход/вход) |
| `lvl3_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | integer | Флаг перевода по управленческому юниту 3 уровня (выход/вход) |
| `lvl4_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | integer | Флаг перевода по управленческому юниту 4 уровня (выход/вход) |
| `lvl5_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | integer | Флаг перевода по управленческому юниту 5 уровня (выход/вход) |
| `lvl6_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | integer | Флаг перевода по управленческому юниту 6 уровня (выход/вход) |
| `lvl7_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | integer | Флаг перевода по управленческому юниту 7 уровня (выход/вход) |
| `lvl8_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | integer | Флаг перевода по управленческому юниту 8 уровня (выход/вход) |
| `lvl9_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | integer | Флаг перевода по управленческому юниту 9 уровня (выход/вход) |
| `lvl10_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | integer | Флаг перевода по управленческому юниту 10 уровня (выход/вход) |
| `lvl11_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | integer | Флаг перевода по управленческому юниту 11 уровня (выход/вход) |
| `lvl12_mngt_unit_out_trsf_flg` / `_in_trsf_flg` | integer | Флаг перевода по управленческому юниту 12 уровня (выход/вход) |
| `transfer_to_hq_flg` | integer | Перевод в HQ (покраска) |
| `transfer_out_hq_flg` | integer | Перевод из HQ |
| `transfer_to_it_flg` | integer | Перевод в IT-код |
| `transfer_out_it_flg` | integer | Перевод из IT-кода |
| `transfer_to_specialization_flg` | integer | Перевод в специализацию |
| `transfer_out_specialization_flg` | integer | Перевод из специализации |
| `transfer_to_stream_flg` | integer | Перевод в стрим |
| `transfer_out_stream_flg` | integer | Перевод из стрима |
| `transfer_to_active_type_flg` | integer | **Перевод в «Активную»** (вход в тип численности «Активная») |
| `transfer_out_active_type_flg` | integer | **Перевод из «Активной»** (выход из типа численности) |
| `transfer_to_employment_relation_type_flg` | integer | Перевод в тип занятости |
| `transfer_out_employment_relation_type_flg` | integer | Перевод из типа занятости |
| `transfer_to_legal_position_flg` | integer | Перевод в должность |
| `transfer_out_legal_position_flg` | integer | Перевод из должности |
| `transfer_candidate_flg` | smallint | Флаг перевода кандидата (не найм) |
| `transfer_internal_flg` | smallint | Флаг внутреннего перевода |
| `emp_specialization_change_to_it` | integer | Смена специализации в IT |
| `emp_specialization_change_to_non_it` | integer | Смена специализации в non-IT |
| `next_emp_specialization_it_code` | varchar | Следующий IT-код специализации |
| `prev_emp_specialization_it_code` | varchar | Предыдущий IT-код специализации |

### Должность / компетенции
| Поле | Тип | Описание |
|---|---|---|
| `legal_position_nm` | varchar | Юридическая должность |
| `management_position_nm` | varchar(512) | Управленческая должность |
| `employee_stream_desc` | varchar | Стрим сотрудника |
| `employee_specialization_desc` | text | Специализация сотрудника |
| `emp_specialization_oper_code` | varchar | Код операционной специализации (покраска: HQ/Line/Support) |
| `emp_specialization_it_code` | varchar | IT-код специализации (IT/Digital/NonIT) |
| `emp_specialization_dk` | integer | Ключ специализации |
| `emp_stream_dk` | integer | Ключ стрима |
| `type_company` | text | Тип компании |
| `type_create_company` | text | Тип создания компании |

### Тип занятости / штат
| Поле | Тип | Описание |
|---|---|---|
| `employment_relation_type_desc` | varchar | Тип трудовых отношений (напр. «Штатный сотрудник») |
| `employee_contract_type_desc` | varchar | Тип договора |
| `staff_flg` | text | Флаг штата |
| `internal_flg` | smallint | Флаг внутреннего сотрудника |
| `fin_source_code` | varchar(2) | Код источника финансирования |
| `job_group_nm` | varchar(2) | Группа должности |
| `type_of_work` | varchar | Тип работы |

### Активность
| Поле | Тип | Описание |
|---|---|---|
| `active_type_nm` | varchar | Тип активности («Активная» / иное) |
| `active_count_flg` | smallint | Флаг: числится в «Активной» (считается в численность) |
| `prev_active_count_flg` | smallint | Предыдущее значение флага активности |
| `legal_employee_flg` | smallint | Флаг юридического сотрудника |
| `maternity_flg` | smallint | Флаг: в декрете |
| `absent_flg` | smallint | Флаг: отсутствует |
| `probation_flg` | integer | Флаг: на испытательном сроке |

### Отток
| Поле | Тип | Описание |
|---|---|---|
| `fire_reason` | varchar | Причина увольнения |
| `fire_reason_group` | varchar | Группа причины увольнения |
| `fire_initiative` | varchar | Инициатива увольнения |
| `lose_talent` | varchar | Потеря таланта |
| `regrettable_fire_flg` | smallint | Флаг: нежелательное (регрэт) увольнение |
| `non_regrettable_fire_flg` | smallint | Флаг: нерегреттное увольнение |
| `potential_regrettable_flg` | smallint | Флаг: потенциально нежелательное увольнение |
| `potential_non_regrettable_flg` | smallint | Флаг: потенциально нерегреттное увольнение |
| `fire_dismissal_comment_txt` | text | Комментарий к увольнению |
| `employee_dismissal_reason_desc` | text | Описание причины увольнения |
| `head_exit_company_info` | text | Информация об уходе руководителя из компании |

### Найм / стаж / грейд
| Поле | Тип | Описание |
|---|---|---|
| `experience_year_amt` | numeric(23,3) | Стаж, лет |
| `experience_group_nm` | text | Группа стажа |
| `experience_detail_group_nm` | text | Детальная группа стажа |
| `seniority` | text | Стаж (категория) |
| `grade` | text | Грейд |
| `rayisa_hire_flg` | smallint | Флаг найма через Rayisa |
| `source_type_nm` | varchar | Тип источника найма |
| `respond_source_nm` | varchar | Источник отклика |

### Прочее
| Поле | Тип | Описание |
|---|---|---|
| `last_nm` | varchar(50) | Фамилия |
| `first_nm` | varchar(50) | Имя |
| `rus_tcr_flg` | smallint | Флаг: российский ТК РФ |
| `foreign_tcr_flg` | smallint | Флаг: иностранный ТК РФ |
| `tcr_flg` | smallint | Флаг ТК РФ |
| `rb_flg` | smallint | Флаг RB |
| `rb_migration_flg` | smallint | Флаг миграции RB |
| `t_education_desc` | varchar | Образование |
| `summary_score` | varchar | Сводная оценка (перформанс) |
| `office_desc` | varchar | Офис |

## Примечания по использованию в TeamPulse Hub
- **Юниты дерева** — из `lvl1..lvl12_mapped_management_unit_rk` (маппированная управленческая структура), путь строится по цепочке уровней.
- **Покраска** — `emp_specialization_oper_code` (HQ/Line/Support).
- **IT-код** — `emp_specialization_it_code` (IT/Digital/NonIT).
- **«Активная»** — по флагу `active_count_flg` (FIXED_DIMS берёт первый найденный из `active_count_flg`/`active_type_flg`/`active_flg`), иначе по `active_type_nm = 'Активная'`.
- **Переводы** — по `transfer_to_*`/`transfer_out_*` и `lvlN_mngt_unit_in/out_trsf_flg`. Перевод в/из «Активной» — флаги `transfer_to_active_type_flg` / `transfer_out_active_type_flg`.
- **Найм** — `hire_flg`, `transfer_candidate_flg`, `transfer_internal_flg`.
- **Отток** — `fire_flg`, `regrettable_fire_flg`, `non_regrettable_fire_flg`.