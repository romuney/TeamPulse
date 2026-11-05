-- ============================================================================
-- 0н. Виды найма: почему весь найм может попадать в одну категорию (правки 26.10-б, п. 7).
-- Helicopter, параграф gp, после ноутбука. Три запроса по одному; ответ — в чат, не в репозиторий: в нём числа.
--
-- Как отчёт делит найм (поставка 65). Найм при типе «Активная» = найм в компанию + переходы в «Активную»:
--   из учебной группы в боевую (строка дня с transfer_candidate_flg = 1) и стажёр в штат (transfer_internal_flg = 1).
--   Переход — строка дня с флагом смены типа численности (transfer_to_active_type_flg) или юнита; вид — колонка
--   cv_k в teampulse_hub_trf: c — из учебной группы, s — стажёр в штат.
-- Весь найм окажется «в компанию», если:
--   а) у переходов нет cv_k — ноутбук до поставки 65 (запрос 1: строк с in_ok = 0 нет или cv_k пустой);
--   б) в источнике флаги перехода стоят не в тот день, что смена типа (запрос 3: without_flag больше нуля);
--   в) флагов перехода в источнике нет вовсе (запрос 2: cand_days и intern_days — нули).
-- ============================================================================

-- 1. Как ноутбук разнёс найм с начала года (корень отчёта): h — найм в компанию; i с in_ok = 0 — переход кандидата
--    или стажёра. В найм отчёта при типе «Активная» идёт переход с типом дня «Активная» и флагом (flagged_cnt)
select t.report_month::date as month, t.trf_kind, t.in_ok, coalesce(t.cv_k, '') as cv_k, t.act_cd,
       sum(t.trf_cnt) as cnt,
       sum(case when coalesce(t.fu, 0) + coalesce(t.fa, 0) > 0 then t.trf_cnt else 0 end) as flagged_cnt
from teampulse_hub_trf t
where t.node_rk = (select root_rk from teampulse_hub_meta)
  and t.report_month >= date_trunc('year', (select last_month from teampulse_hub_meta))::date
  and (t.trf_kind = 'h' or t.in_ok = 0)
group by 1, 2, 3, 4, 5
order by 1, 2, 3, 4, 5;

-- 2. Источник: сколько дней с флагами найма и переходов с начала года (по месяцам)
select date_trunc('month', x.calendar_dt)::date as month,
       sum((coalesce(x.hire_flg::text, '0') = '1')::int) as hire_days,
       sum((coalesce(x.transfer_candidate_flg::text, '0') = '1')::int) as cand_days,
       sum((coalesce(x.transfer_internal_flg::text, '0') = '1')::int) as intern_days,
       sum((coalesce(x.transfer_to_active_type_flg::text, '0') = '1' and x.active_type_nm = 'Активная')::int) as to_active_days
from usr_cross_data.hr_executive_proteus x
where x.calendar_dt >= date_trunc('year', current_date - 1)
group by 1
order by 1;

-- 3. Переходы в «Активную» из кандидатов и стажёров: вчера — кандидат или стажёр, сегодня — «Активная». with_flag — у
--    строки сегодня есть флаг перехода (его ждёт отчёт), without_flag — нет
select date_trunc('month', x.calendar_dt)::date as month, y.active_type_nm as from_type,
       sum((coalesce(x.transfer_candidate_flg::text, '0') = '1' or coalesce(x.transfer_internal_flg::text, '0') = '1')::int) as with_flag,
       sum((coalesce(x.transfer_candidate_flg::text, '0') <> '1' and coalesce(x.transfer_internal_flg::text, '0') <> '1')::int) as without_flag,
       sum((coalesce(x.transfer_to_active_type_flg::text, '0') = '1')::int) as with_type_flag
from usr_cross_data.hr_executive_proteus x
join usr_cross_data.hr_executive_proteus y
  on y.mdm_employee_rk = x.mdm_employee_rk and y.calendar_dt = x.calendar_dt - 1
where x.calendar_dt >= date_trunc('year', current_date - 1)
  and y.calendar_dt >= date_trunc('year', current_date - 1)::date - 1
  and x.active_type_nm = 'Активная'
  and y.active_type_nm in ('Кандидаты в учебных юнитах', 'Стажеры')
group by 1, 2
order by 1, 2;
