-- ============================================================================
-- 6. GOLDEN — снимок логики, сверенной с мастер-отчётами (Helicopter, параграф gp, после «hub checks»).
-- Зачем: любая правка ноутбука (оптимизация, перенос) не должна менять числа, которые уже сошлись с эталонами.
-- Порядок: 1) на сверенном ноутбуке выполнить запрос, результат сохранить у себя (НЕ в репозиторий) — это снимок;
--          2) после любой правки ноутбука выполнить снова: все колонки, включая отпечатки md5, — один в один.
--          Не совпало — правку не принимаем.
-- Параметры — блоки p (контрольные подразделения: unit_rk из teampulse_hub_unit, ярлык A/B/C — ярлык и ключ
-- связаны только в вашей записи) и m (диапазон месяцев).
--
-- Что в снимке, по подразделению × месяцу (срез по умолчанию отчёта: тип численности «Активная»):
--   hc, hire, fire           численность на конец месяца, найм, отток — teampulse_hub_series
--   tin, tout                переводы в и из — та же формула, что в датасете при настройках по умолчанию:
--                            «в» = вид i, флаг юнита своего уровня или смены типа численности, не кандидат/стажёр;
--                            «из» = вид o, флаг юнита или смены типа — teampulse_hub_trf
--   mon_cnt, hrs, pday, tlk  мониторинг месяца: люди с категорией, суммы часов, плановых дней, звонков
--   trf_md5                  отпечаток строк teampulse_hub_trf узла за месяц, которые отчёт считает при настройках по
--                            умолчанию: найм (h) и переводы «в» / «из» типа «Активная» с флагом юнита или типа (вид,
--                            срез, флаги, число) — ловит изменение правила переводов, даже если итоги месяца совпали.
--                            Строки, которые видны только под другими фильтрами (смена покраски / IT / штата без
--                            перевода юнита, другая сторона смены типа, найм переходом с in_ok = 0), в отпечаток не
--                            входят: снимок на ноутбуке агента и на ноутбуке 104 совпадает (проверено на стенде)
--   week_md5                 отпечаток строк teampulse_hub_mon_week узла с понедельником в этом месяце
-- Логинов и ключей сотрудников в выводе нет: таблицы ноутбука уже агрегированы.
-- ============================================================================
with p (unit_rk, tag) as (
    values ('ВПИШИТЕ_unit_rk_1', 'A'),
           ('ВПИШИТЕ_unit_rk_2', 'B'),
           ('ВПИШИТЕ_unit_rk_3', 'C')
),
m as (
    select generate_series(date '2026-01-01', date '2026-10-01', interval '1 month')::date as report_month   -- ← месяцы
),
s as (
    select p.tag, s.report_month,
           sum(s.hc_cnt) as hc, sum(s.hire_cnt) as hire, sum(s.fire_cnt) as fire,
           sum(s.pnor_cnt + s.plow_cnt + s.phig_cnt + s.pgry_cnt) as mon_cnt,
           round(sum(s.hrs_sum_amt)::numeric, 2) as hrs, sum(s.plan_day_cnt) as pday, round(sum(s.tlk_sum_amt)::numeric, 2) as tlk
    from p
    join teampulse_hub_series s on s.node_rk = p.unit_rk
    where s.report_month in (select report_month from m)
      and s.act_cd = 'Активная'
    group by 1, 2
),
t as (
    select p.tag, t.report_month,
           sum(case when t.trf_kind = 'i' and (t.fu = 1 or t.fa = 1) and t.in_ok = 1 and t.act_cd = 'Активная'
                    then t.trf_cnt else 0 end) as tin,
           sum(case when t.trf_kind = 'o' and (t.fu = 1 or t.fa = 1) and t.act_cd = 'Активная'
                    then t.trf_cnt else 0 end) as tout,
           md5(string_agg(t.trf_kind || '|' || t.paint_cd || '|' || t.it_cd || '|' || t.staff_cd || '|' || t.act_cd
                          || '|' || t.fu || t.fa || t.fp || t.fi || t.fs || t.fsp || '|' || t.in_ok || '|' || coalesce(t.cv_k, '')
                          || '|' || coalesce(t.sp_cd, '') || '|' || t.trf_cnt, ','
                          order by t.trf_kind, t.paint_cd, t.it_cd, t.staff_cd, t.act_cd, t.fu, t.fa, t.fp, t.fi, t.fs,
                                   t.fsp, t.in_ok, t.cv_k, t.sp_cd, t.trf_cnt)) as trf_md5
    from p
    join teampulse_hub_trf t on t.node_rk = p.unit_rk
    where t.report_month in (select report_month from m)
      and (t.trf_kind = 'h' or (t.act_cd = 'Активная' and (t.fu = 1 or t.fa = 1) and (t.trf_kind = 'o' or t.in_ok = 1)))
    group by 1, 2
),
w as (
    select p.tag, date_trunc('month', w.wk)::date as report_month,
           md5(string_agg(w.wk || '|' || w.paint_cd || '|' || w.it_cd || '|' || w.staff_cd || '|' || w.act_cd || '|'
                          || w.hc_cnt || '|' || w.pnor_cnt || '|' || w.plow_cnt || '|' || w.phig_cnt || '|' || w.pgry_cnt
                          || '|' || w.lo_fresh_cnt || '|' || w.lo_long_cnt || '|' || w.hi_fresh_cnt || '|' || w.hi_long_cnt
                          || '|' || w.t23_cnt || '|' || w.t35_cnt || '|' || w.t5_cnt || '|' || round(w.hrs_sum_amt::numeric, 2)
                          || '|' || w.plan_day_cnt || '|' || round(w.tlk_sum_amt::numeric, 2), ','
                          order by w.wk, w.paint_cd, w.it_cd, w.staff_cd, w.act_cd)) as week_md5
    from p
    join teampulse_hub_mon_week w on w.node_rk = p.unit_rk
    where date_trunc('month', w.wk)::date in (select report_month from m)
    group by 1, 2
)
select s.tag, s.report_month, s.hc, s.hire, s.fire, coalesce(t.tin, 0) as tin, coalesce(t.tout, 0) as tout,
       s.mon_cnt, s.hrs, s.pday, s.tlk, t.trf_md5, w.week_md5
from s
left join t on t.tag = s.tag and t.report_month = s.report_month
left join w on w.tag = s.tag and w.report_month = s.report_month
order by s.tag, s.report_month;
