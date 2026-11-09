-- =============================================================================
-- TeamPulse Hub · 5. Переводы — события входа/выхода из периметра отчёта (поставка 104, 05.11:
-- сверка с мастер-отчётами Импульс 168/168 помесячных счётов на трёх контрольных выгрузках
-- юр/активная и узел уровня 4 юр×штат; детектор юнит-перехода — выходной флаг
-- lvlN на старой строке, событие датировано следующей строкой; конверсии типа — по флагам
-- active_count_flg / prev_active_count_flg; уход «в оформление» — на следующий день после
-- разрыва строк). Полные правила — в комментарии блока teampulse_hub_trf ниже.
-- teampulse_hub_trf — узел × месяц × вид × срез × флаги: датасет считает из них переводы в выбор и из
-- выбора под фильтры. Логика — мастер-отчёта (старый TeamPulse: transfer_in / transfer_out), сверена на
-- выборках боя: событие — строка дня с флагом источника, «в» и «из» считаются отдельно, каждое — по
-- состоянию своей строки.
--   i  перевод в: строка — первый день в новом состоянии. Узел — юнит строки на каждом уровне (структура
--      того дня), флаг юнита — этого уровня (lvlN_mngt_unit_in_trsf_flg). Найм — не перевод (вид h)
--   o  перевод из: строка — последний день в старом состоянии (lvlN_mngt_unit_out_trsf_flg, transfer_out_*),
--      увольнение — не перевод. Последний день месяца (last_day_of_month_flg) — следующий месяц
--   h  найм в компанию: узлы и срез дня найма
-- fu — флаг юнита этого уровня; fa / fp / fi / fs — смена типа численности, покраски, IT-кода, типа
-- оформления: датасет засчитывает их, только когда выбран этот фильтр (тип численности — любой набор
-- типов active_type_nm, по умолчанию «Активная»). Флаг смены — как есть и при фильтре из нескольких
-- значений (поставка 63, как мастер-отчёт: Подрядчики → Активная при «Активная + Подрядчики» — и «из», и
-- «в»). in_ok = 0 — кандидат учебного юнита или стажёр: из «в» исключается всегда, при выборе типов — найм.
-- cv_k (поставка 65) — вид такого перехода: c — из учебной группы в боевую, s — стажёр в штат (динамика
-- найма по видам в отчёте); у остальных строк пусто.
-- sp_cd (28.10) — специализация строки: «Движение по специализациям» с начала года (найм, переводы в и
-- из по специализациям — датасет 2а у выбранного подразделения). fsp (31.10, п. 10) — флаг источника
-- transfer_to_specialization_flg («в») / transfer_out_specialization_flg («из»): переводы по специализациям
-- считаются по нему; строка только со сменой специализации в переводы юнита и фильтров не идёт (fu, fa…fs — 0).
-- Узел <ключ юнита>:d (поставка 64) — «напрямую в юните»: люди в самом юните, без его подразделений (в
-- мастер-отчёте — строка юнита с уровнем ниже «-»); строка — в нём, если её самый глубокий юнит — этот, флаг —
-- любой флаг юнита строки.
-- teampulse_hub_trfe (поставка 63) — события × узел за 13 месяцев для детализации переводов в отчёте.
-- =============================================================================
-- шаги — таблицами, не CTE: у таблицы есть статистика (analyze), и план не ошибается в числе строк
-- (CTE оценивается в единицы строк — на объёме боя план выбирал вложенный цикл)
drop table if exists teampulse_hub_trfr;
create table teampulse_hub_trfr as
-- строки дня с событием. 03.11, поставка 103 (файл 9, п. 8): одна строка на сотрудника × день × путь юнита — флаги
-- дня 0 / 1 (max по повторным записям источника), а не сумма: повтор одного признака перевод не удваивает. «В» и «из»,
-- уровни структуры — разными флагами, не сливаются; срез дня при расхождении записей — меньшее значение
select e, dt, k1, k2, k3, k4, k5, k6, k7, k8, k9, k10, k11,
       max(ui1) as ui1, max(ui2) as ui2, max(ui3) as ui3, max(ui4) as ui4, max(ui5) as ui5, max(ui6) as ui6, max(ui7) as ui7, max(ui8) as ui8, max(ui9) as ui9, max(ui10) as ui10, max(ui11) as ui11,
       max(uo1) as uo1, max(uo2) as uo2, max(uo3) as uo3, max(uo4) as uo4, max(uo5) as uo5, max(uo6) as uo6, max(uo7) as uo7, max(uo8) as uo8, max(uo9) as uo9, max(uo10) as uo10, max(uo11) as uo11,
       min(pa) as pa, min(it) as it, min(st) as st, min(ac) as ac,
       max(hf) as hf, max(cv) as cv, max(cc) as cc, max(fx) as fx, max(ld) as ld, min(sp) as sp,
       max(ia) as ia, max(oa) as oa, max(ip) as ip, max(oq) as oq, max(ii) as ii, max(oi) as oi, max(ist) as ist, max(ost) as ost, max(isp) as isp, max(osp) as osp,
       max(actf) as actf, max(pactf) as pactf, max(tif) as tif,
       min(gr) as gr, min(hs) as hs
from (
select x.mdm_employee_rk as e, x.calendar_dt::date as dt,
       coalesce(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') as k1,
       coalesce(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') as k2,
       coalesce(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') as k3,
       coalesce(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') as k4,
       coalesce(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') as k5,
       coalesce(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') as k6,
       coalesce(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') as k7,
       coalesce(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') as k8,
       coalesce(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') as k9,
       coalesce(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') as k10,
       coalesce(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-') as k11,
       (coalesce(x.lvl1_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui1,
       (coalesce(x.lvl2_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui2,
       (coalesce(x.lvl3_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui3,
       (coalesce(x.lvl4_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui4,
       (coalesce(x.lvl5_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui5,
       (coalesce(x.lvl6_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui6,
       (coalesce(x.lvl7_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui7,
       (coalesce(x.lvl8_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui8,
       (coalesce(x.lvl9_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui9,
       (coalesce(x.lvl10_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui10,
       (coalesce(x.lvl11_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui11,
       (coalesce(x.lvl1_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo1,
       (coalesce(x.lvl2_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo2,
       (coalesce(x.lvl3_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo3,
       (coalesce(x.lvl4_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo4,
       (coalesce(x.lvl5_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo5,
       (coalesce(x.lvl6_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo6,
       (coalesce(x.lvl7_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo7,
       (coalesce(x.lvl8_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo8,
       (coalesce(x.lvl9_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo9,
       (coalesce(x.lvl10_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo10,
       (coalesce(x.lvl11_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo11,
       coalesce(nullif(coalesce(x.emp_specialization_oper_code::text, '-'), ''), '-') as pa, coalesce(nullif(coalesce(x.emp_specialization_it_code::text, '-'), ''), '-') as it,
       case when x.employment_relation_type_desc = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as st,
       coalesce(nullif(trim(x.active_type_nm::text), ''), '-') as ac,
       (coalesce(x.hire_flg::text, '0') = '1')::int as hf, least((coalesce(x.transfer_candidate_flg::text, '0') = '1')::int + (coalesce(x.transfer_internal_flg::text, '0') = '1')::int, 1) as cv,
       (coalesce(x.transfer_candidate_flg::text, '0') = '1')::int as cc,
       (coalesce(x.fire_flg::text, '0') = '1')::int as fx, (coalesce(x.last_day_of_month_flg::text, '0') = '1')::int as ld,
       -- 28.10, п. 1: специализация строки — «Движение по специализациям» (найм, переводы в и из)
       translate(coalesce(nullif(trim(x.employee_specialization_desc::text), ''), '-'), E'\t\n|', '  /') as sp,
       -- 09.11 (владелец: найм — событие дня найма со срезом этого дня): грейд и источник найма строки — разбивки найма
       -- датасета по тем же строкам, что «Найм, чел» (вид h и переходы в найм); пусто и «-» — пустая строка
       coalesce(nullif(translate(trim(x.grade::text), E'\t\n|', '  /'), '-'), '') as gr,
       coalesce(nullif(translate(trim(x.source_type_nm::text), E'\t\n|', '  /'), '-'), '') as hs,
       (coalesce(x.transfer_to_active_type_flg::text, '0') = '1')::int as ia, (coalesce(x.transfer_out_active_type_flg::text, '0') = '1')::int as oa,
       (coalesce(x.active_count_flg::text, '0') = '1')::int as actf, (coalesce(x.prev_active_count_flg::text, '0') = '1')::int as pactf,
       -- GP-перенос 104: tif — стажёр в штат (transfer_internal_flg); в правилах исключается из «в», в trfr его не было
       (coalesce(x.transfer_internal_flg::text, '0') = '1')::int as tif,
       (coalesce(x.transfer_to_hq_flg::text, '0') = '1')::int as ip, (coalesce(x.transfer_out_hq_flg::text, '0') = '1')::int as oq,
       (coalesce(x.transfer_to_it_flg::text, '0') = '1')::int as ii, (coalesce(x.transfer_out_it_flg::text, '0') = '1')::int as oi,
       (coalesce(x.transfer_to_employment_relation_type_flg::text, '0') = '1')::int as ist, (coalesce(x.transfer_out_employment_relation_type_flg::text, '0') = '1')::int as ost,
       (coalesce(x.transfer_to_specialization_flg::text, '0') = '1')::int as isp, (coalesce(x.transfer_out_specialization_flg::text, '0') = '1')::int as osp
from usr_cross_data.hr_executive_proteus x
-- сетка отчёта и последний день перед ней (перевод «из» в этот день — уже первый месяц сетки);
-- первое условие — отсечение партиций
where x.calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date
  and x.calendar_dt >= (select grid_start from teampulse_hub_cal) - 1
  and x.calendar_dt < ((select lm from teampulse_hub_cal) + interval '1 month')::date
  and (coalesce(x.hire_flg::text, '0') = '1' or coalesce(x.lvl1_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl1_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl2_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl2_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl3_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl3_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl4_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl4_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl5_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl5_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl6_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl6_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl7_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl7_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl8_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl8_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl9_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl9_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl10_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl10_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl11_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl11_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.transfer_to_active_type_flg::text, '0') = '1' or
       coalesce(x.transfer_out_active_type_flg::text, '0') = '1' or coalesce(x.transfer_to_hq_flg::text, '0') = '1' or
       coalesce(x.transfer_out_hq_flg::text, '0') = '1' or coalesce(x.transfer_to_it_flg::text, '0') = '1' or
       coalesce(x.transfer_out_it_flg::text, '0') = '1' or
       coalesce(x.transfer_to_employment_relation_type_flg::text, '0') = '1' or
       coalesce(x.transfer_out_employment_relation_type_flg::text, '0') = '1' or
       coalesce(x.transfer_to_specialization_flg::text, '0') = '1' or
       coalesce(x.transfer_out_specialization_flg::text, '0') = '1' or
       -- 09.11 (мастер-отчёт: «Перевод в БГ» и «Перевод стажера в штат» — события сами по себе): переход в найм и без
       -- флага смены типа или юнита
       coalesce(x.transfer_candidate_flg::text, '0') = '1' or coalesce(x.transfer_internal_flg::text, '0') = '1')
) z
group by e, dt, k1, k2, k3, k4, k5, k6, k7, k8, k9, k10, k11
distributed by (e);
analyze teampulse_hub_trfr;

drop table if exists teampulse_hub_trfv;
create table teampulse_hub_trfv as
-- соседний день события: вчера — для «в», завтра — для «из». Поставка 63: только для детализации переводов
-- («было → стало» и подразделение по другую сторону, lu — самый глубокий юнит); на счёт переводов не влияет —
-- флаг смены считается как есть. Детализация — за 13 последних месяцев. Строк в этот день несколько — меньшее
select n.e, n.d, min(coalesce(nullif(coalesce(x.emp_specialization_oper_code::text, '-'), ''), '-')) as pa, min(coalesce(nullif(coalesce(x.emp_specialization_it_code::text, '-'), ''), '-')) as it,
       min(case when x.employment_relation_type_desc = 'Штатный сотрудник' then 'Штат' else 'Не штат' end) as st, min(coalesce(nullif(trim(x.active_type_nm::text), ''), '-')) as ac, min(coalesce(nullif(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-'), nullif(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-'), nullif(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-'), nullif(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-'), nullif(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-'), nullif(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-'), nullif(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-'), nullif(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-'), nullif(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-'), nullif(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-'), nullif(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-'), '-')) as lu
from (
    select distinct r.e, r.dt - 1 as d from teampulse_hub_trfr r where r.hf = 0 and r.dt >= ((select lm from teampulse_hub_cal) - interval '12 month')::date
    union
    select distinct r.e, r.dt + 1 from teampulse_hub_trfr r where r.fx = 0 and r.dt >= ((select lm from teampulse_hub_cal) - interval '12 month')::date - 1
) n
join usr_cross_data.hr_executive_proteus x on x.mdm_employee_rk = n.e and x.calendar_dt = n.d
where x.calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date
  and x.calendar_dt >= (select grid_start from teampulse_hub_cal) - 2
  and x.calendar_dt <= ((select lm from teampulse_hub_cal) + interval '1 month')::date
group by 1, 2
distributed by (e);
analyze teampulse_hub_trfv;

drop table if exists teampulse_hub_trf;
create table teampulse_hub_trf as
select * from (
-- поставка 104 (05.11, сверка с мастер-отчётами Импульс — 168/168 помесячных счётов на трёх выгрузках:
-- узел уровня 3 (юр/активная) и узел уровня 4 (юр×штат)): событие перевода = вход/выход из
-- периметра отчёта (юнит × тип численности × штат × IT…), смена нескольких измерений в один день — одно
-- событие. Правила (только флаги витрины):
--   U  юнит-переход: детектор — lvlN_mngt_unit_out_trsf_flg на ПОСЛЕДНЕЙ строке старого юнита при
--      fire_flg = 0 и (hire_flg = 1 — перевод между юрлицами — или следующая строка на следующий день);
--      событие датировано СЛЕДУЮЩЕЙ строкой; «в» — узлы новой строки (срезы её же), «из» — узлы старой
--      (срезы старой). Одновременная смена типа численности/штатности событию не мешает: одна строка
--      несёт и флаг юнита (fu), и флаги фильтров (fa/fp/fi/fs) — периметр строит датасет;
--   TI вход в активную (строка): transfer_to_active_type_flg + active_count_flg = 1 +
--      prev_active_count_flg = 0, без найма/кандидата/стажёра (увольнение в тот же день не мешает);
--   TO выход из активной: (a) строка перехода (active_count_flg = 0, prev = 1) с юнитом и срезами
--      «до перевода» (предыдущая строка), дата = строка перехода; (b) уход «в оформление» — последняя
--      строка с transfer_out_active_type_flg перед разрывом строк (следующей нет или ≥ 2 дней),
--      событие — на следующий день. Смена штатности одновременно с юнитом классифицируется мастером
--      как «Тип трудоустройства» (штатность важнее юнита) — для trf это одна строка с fu и fs;
--   строки TI/TO не дублируют пары U (хоть один lvlN_mngt_unit_out_trsf_flg на предыдущей строке);
--   найм (h) и смена специализации (fsp) — как раньше.
with nx as (
    select e, dt, lead(dt) over (partition by e order by dt) as ndt
    from teampulse_hub_trfr
),
p as (
    -- пары соседних строк: prev — детектор и срезы «из», cur — дата события и срезы «в»
    select r0.e, r0.dt as pdt, r0.hf, r0.fx,
           r0.k1, r0.k2, r0.k3, r0.k4, r0.k5, r0.k6, r0.k7, r0.k8, r0.k9, r0.k10, r0.k11,
           r0.uo1, r0.uo2, r0.uo3, r0.uo4, r0.uo5, r0.uo6, r0.uo7, r0.uo8, r0.uo9, r0.uo10, r0.uo11,
           r0.pa, r0.it, r0.st, r0.ac, r0.sp, r0.oa, r0.oq, r0.oi, r0.ost, r0.osp,
           n.dt as cdt, n.ia as cia, n.ip as cip, n.ii as cii, n.ist as cist, n.isp as cisp,
           n.cc as ccc, n.tif as ctif, n.actf as cactf, n.pactf as cpactf, n.fx as cfx, n.hf as chf,
           n.k1 as c1, n.k2 as c2, n.k3 as c3, n.k4 as c4, n.k5 as c5, n.k6 as c6, n.k7 as c7,
           n.k8 as c8, n.k9 as c9, n.k10 as c10, n.k11 as c11,
           n.pa as cpa, n.it as cit, n.st as cst, n.ac as cac, n.sp as csp,
           n.gr as cgr, n.hs as chs
    from teampulse_hub_trfr r0
    join nx on nx.e = r0.e and nx.dt = r0.dt
    join teampulse_hub_trfr n on n.e = nx.e and n.dt = nx.ndt
),
ev as (
    select p.*,
           (uo1 = 1 or uo2 = 1 or uo3 = 1 or uo4 = 1 or uo5 = 1 or uo6 = 1
            or uo7 = 1 or uo8 = 1 or uo9 = 1 or uo10 = 1 or uo11 = 1) as u_evt
    from p
    where fx = 0                                   -- увольнение — не перевод
      and (hf = 1 or cdt = pdt + 1)                -- соседний день или перевод «через найм»
),
ui as (
    -- «в»: узлы НОВОЙ строки, флаг юнита уровня — выходной флаг старой строки того же уровня
    select z.* from (
        select ev.*, unnest(ARRAY[c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11]) as node_rk,
               unnest(ARRAY[uo1, uo2, uo3, uo4, uo5, uo6, uo7, uo8, uo9, uo10, uo11]) as fu
        from ev where u_evt
    ) z where z.node_rk <> '-'
    union all
    select d.* from (
        select ev.*, coalesce(nullif(c11, '-'), nullif(c10, '-'), nullif(c9, '-'), nullif(c8, '-'),
                nullif(c7, '-'), nullif(c6, '-'), nullif(c5, '-'), nullif(c4, '-'), nullif(c3, '-'),
                nullif(c2, '-'), nullif(c1, '-')) || ':d' as node_rk,
               greatest(uo1, uo2, uo3, uo4, uo5, uo6, uo7, uo8, uo9, uo10, uo11) as fu
        from ev where u_evt
    ) d where d.node_rk is not null
    union all
    select ev.*, 'all', 0 from ev where u_evt and (select mo from teampulse_hub_cal) = 1
),
uo as (
    -- «из»: узлы СТАРОЙ строки (откуда ушёл), дата события — новая строка
    select z.* from (
        select ev.*, unnest(ARRAY[k1, k2, k3, k4, k5, k6, k7, k8, k9, k10, k11]) as node_rk,
               unnest(ARRAY[uo1, uo2, uo3, uo4, uo5, uo6, uo7, uo8, uo9, uo10, uo11]) as fu
        from ev where u_evt
    ) z where z.node_rk <> '-'
    union all
    select d.* from (
        select ev.*, coalesce(nullif(k11, '-'), nullif(k10, '-'), nullif(k9, '-'), nullif(k8, '-'),
                nullif(k7, '-'), nullif(k6, '-'), nullif(k5, '-'), nullif(k4, '-'), nullif(k3, '-'),
                nullif(k2, '-'), nullif(k1, '-')) || ':d' as node_rk,
               greatest(uo1, uo2, uo3, uo4, uo5, uo6, uo7, uo8, uo9, uo10, uo11) as fu
        from ev where u_evt
    ) d where d.node_rk is not null
    union all
    select ev.*, 'all', 0 from ev where u_evt and (select mo from teampulse_hub_cal) = 1
),
toa as (
    -- TO (a): строка перехода типа есть, юнит не менялся — юнит и срезы «до перевода» (старая строка)
    select * from ev
    where not u_evt
      and cia = 1 and cactf = 0 and cpactf = 1 and cfx = 0 and chf = 0 and ccc = 0 and ctif = 0
),
sr as (
    -- строковые события: TI (вход в активную), TO-b (уход «в оформление»), найм, смена специализации
    select r0.e, r0.dt, r0.ld, r0.cv, r0.cc, r0.hf, r0.ia, r0.oa, r0.isp, r0.osp,
           r0.ip, r0.ii, r0.ist, r0.oq, r0.oi, r0.ost,
           r0.pa, r0.it, r0.st, r0.ac, r0.sp, r0.k1, r0.k2, r0.k3, r0.k4, r0.k5,
           r0.k6, r0.k7, r0.k8, r0.k9, r0.k10, r0.k11, r0.gr, r0.hs, 'ti' as kind
    from teampulse_hub_trfr r0
    where r0.ia = 1 and r0.actf = 1 and r0.pactf = 0 and r0.hf = 0
      and r0.cc = 0 and r0.tif = 0
      -- GP-перенос 104: по правилу «строки TI/TO не дублируют пары U» — исключаем только юнит-переход (u_evt);
      -- любая пара соседних строк (например, вчера — флаг выхода из прежнего типа) активацию не гасит
      and not exists (select 1 from ev v where v.e = r0.e and v.cdt = r0.dt and v.u_evt)
    union all
    select r0.e, r0.dt, r0.ld, r0.cv, r0.cc, r0.hf, r0.ia, r0.oa, r0.isp, r0.osp,
           r0.ip, r0.ii, r0.ist, r0.oq, r0.oi, r0.ost,
           r0.pa, r0.it, r0.st, r0.ac, r0.sp, r0.k1, r0.k2, r0.k3, r0.k4, r0.k5,
           r0.k6, r0.k7, r0.k8, r0.k9, r0.k10, r0.k11, r0.gr, r0.hs, 'tob' as kind
    from teampulse_hub_trfr r0
    join nx on nx.e = r0.e and nx.dt = r0.dt
    where r0.actf = 1 and r0.oa = 1 and r0.fx = 0 and r0.hf = 0
      and r0.cc = 0 and r0.tif = 0
      -- GP-перенос 104: «следующей строки нет или через ≥ 2 дней» — по строкам источника, как на Trino:
      -- teampulse_hub_trfr хранит только дни с событиями, и следующая строка в нём — следующее событие, а не день
      and not exists (select 1 from usr_cross_data.hr_executive_proteus x
                      where x.mdm_employee_rk = r0.e and x.calendar_dt = r0.dt + 1
                        and x.calendar_dt >= (select grid_start from teampulse_hub_cal) - 1)
    union all
    select r0.e, r0.dt, r0.ld, r0.cv, r0.cc, r0.hf, r0.ia, r0.oa, r0.isp, r0.osp,
           r0.ip, r0.ii, r0.ist, r0.oq, r0.oi, r0.ost,
           r0.pa, r0.it, r0.st, r0.ac, r0.sp, r0.k1, r0.k2, r0.k3, r0.k4, r0.k5,
           r0.k6, r0.k7, r0.k8, r0.k9, r0.k10, r0.k11, r0.gr, r0.hs, 'h' as kind
    from teampulse_hub_trfr r0
    where r0.hf = 1
    union all
    select r0.e, r0.dt, r0.ld, r0.cv, r0.cc, r0.hf, r0.ia, r0.oa, r0.isp, r0.osp,
           r0.ip, r0.ii, r0.ist, r0.oq, r0.oi, r0.ost,
           r0.pa, r0.it, r0.st, r0.ac, r0.sp, r0.k1, r0.k2, r0.k3, r0.k4, r0.k5,
           r0.k6, r0.k7, r0.k8, r0.k9, r0.k10, r0.k11, r0.gr, r0.hs, 'fs' as kind
    from teampulse_hub_trfr r0
    -- 09.11 (стенд в пропорциях боя): флаг «из специализации» в день найма (специализацию сменили на следующий день) —
    -- тоже выход из специализации, как в мастер-отчёте; «в специализацию» в день найма — найм, не перевод
    where (r0.hf = 0 and (r0.isp = 1 or r0.osp = 1)) or (r0.hf = 1 and r0.osp = 1)
),
e2 as (
    -- узлы строки — юнит на каждом уровне (+ «напрямую» и общий корень) для строковых событий
    select z.* from (
        select r.*, unnest(ARRAY[r.k1, r.k2, r.k3, r.k4, r.k5, r.k6, r.k7, r.k8, r.k9, r.k10, r.k11]) as node_rk
        from sr r
    ) z where z.node_rk <> '-'
    union all
    select d.* from (
        select r.*, coalesce(nullif(r.k11, '-'), nullif(r.k10, '-'), nullif(r.k9, '-'), nullif(r.k8, '-'),
                nullif(r.k7, '-'), nullif(r.k6, '-'), nullif(r.k5, '-'), nullif(r.k4, '-'), nullif(r.k3, '-'),
                nullif(r.k2, '-'), nullif(r.k1, '-')) || ':d' as node_rk
        from sr r
    ) d where d.node_rk is not null
    union all
    select r.*, 'all' from sr r where (select mo from teampulse_hub_cal) = 1
),
eo as (
    -- узлы СТАРОЙ строки для TO (a)
    select z.* from (
        select toa.*, unnest(ARRAY[k1, k2, k3, k4, k5, k6, k7, k8, k9, k10, k11]) as node_rk
        from toa
    ) z where z.node_rk <> '-'
    union all
    select d.* from (
        select toa.*, coalesce(nullif(k11, '-'), nullif(k10, '-'), nullif(k9, '-'), nullif(k8, '-'),
                nullif(k7, '-'), nullif(k6, '-'), nullif(k5, '-'), nullif(k4, '-'), nullif(k3, '-'),
                nullif(k2, '-'), nullif(k1, '-')) || ':d' as node_rk
        from toa
    ) d where d.node_rk is not null
    union all
    select toa.*, 'all' from toa where (select mo from teampulse_hub_cal) = 1
),
-- 05.11, поставка 104: парная строка к TI / TO-a — сторона перехода с ДРУГИМ типом численности (Подрядчики → Активная:
-- к «в» в Активную — «из» Подрядчиков; к TO-a — «в» в новый тип). Тип этой строки не «Активная», поэтому при фильтре
-- по умолчанию её отсекает фильтр типа — числа правила выше не меняются; при фильтре из нескольких типов (Активная +
-- Подрядчики) переход внутри фильтра даёт «в» и «из» — водопад сходится, как в 103. Флаги срезов — той же строки
tc as (
    select ev.*, 'o' as dir from ev
    where not u_evt and cia = 1 and cactf = 1 and cpactf = 0 and chf = 0 and ccc = 0 and ctif = 0
      and ac <> cac and ac <> 'Активная'
    union all
    select toa.*, 'i' from toa
    where cac <> ac and cac <> 'Активная'
),
tcn as (
    select z.* from (
        select tc.*, unnest(case when dir = 'o' then ARRAY[k1, k2, k3, k4, k5, k6, k7, k8, k9, k10, k11] else ARRAY[c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11] end) as node_rk from tc
    ) z where z.node_rk <> '-'
    union all
    select d.* from (
        select tc.*, case when dir = 'o' then coalesce(nullif(k11, '-'), nullif(k10, '-'), nullif(k9, '-'), nullif(k8, '-'), nullif(k7, '-'), nullif(k6, '-'), nullif(k5, '-'), nullif(k4, '-'), nullif(k3, '-'), nullif(k2, '-'), nullif(k1, '-')) else coalesce(nullif(c11, '-'), nullif(c10, '-'), nullif(c9, '-'), nullif(c8, '-'), nullif(c7, '-'), nullif(c6, '-'), nullif(c5, '-'), nullif(c4, '-'), nullif(c3, '-'), nullif(c2, '-'), nullif(c1, '-')) end || ':d' as node_rk from tc
    ) d where d.node_rk is not null
    union all
    select tc.*, 'all' from tc where (select mo from teampulse_hub_cal) = 1
),
-- 05.11, поставка 104 (решение владельца): смена покраски / IT-кода / штатности БЕЗ перевода юнита и без входа/выхода
-- из активной — как в поставке 103: по флагу смены (ip ii ist / oq oi ost), датасет засчитывает её только при выбранном
-- фильтре по этому срезу. Дни, которые уже несут событие правила выше (юнит-переход, TI, TO-a, TO-b), исключены —
-- их строки сами несут флаги срезов, двойного счёта нет. Юнит и активная численность — строго по правилу выше
xi as (
    select r0.* from teampulse_hub_trfr r0
    where r0.hf = 0 and r0.cv = 0 and (r0.ip = 1 or r0.ii = 1 or r0.ist = 1)
      and not exists (select 1 from ev v where v.e = r0.e and v.cdt = r0.dt and v.u_evt)
      and not (r0.ia = 1 and r0.actf = 1 and r0.pactf = 0 and r0.cc = 0 and r0.tif = 0)
      and not exists (select 1 from tc where tc.dir = 'i' and tc.e = r0.e and tc.cdt = r0.dt)
),
xo as (
    select r0.* from teampulse_hub_trfr r0
    where r0.fx = 0 and (r0.oq = 1 or r0.oi = 1 or r0.ost = 1)
      and not exists (select 1 from ev v where v.e = r0.e and v.pdt = r0.dt and v.u_evt)
      and r0.oa = 0                                   -- 09.11: строка с выходом из типа — в xa (несёт и oq / oi / ost)
),
-- 09.11 (сверка с мастер-отчётом Executive Report, файл 5, блок 11: «Перевод-» отчёта меньше на 9 за год): выход из типа
-- численности — как у мастера, по флагу строки: transfer_out_active_type_flg = 1 и не увольнение, месяц «день + 1»; срез,
-- юнит и флаги покраски / IT / штата / специализации — этой (старой) строки. Следующую строку не смотрим. Было: TO (a) —
-- по паре строк (флаг входа в новый тип и признаки активной численности у следующей строки, не найм), TO (b) — уход
-- «в оформление» перед разрывом, парная «из» к TI; при несогласованной следующей строке выход терялся. День перевода
-- юнита — в строке U «из» (флаг oa там же)
xa as (
    select r0.* from teampulse_hub_trfr r0
    where r0.oa = 1 and r0.fx = 0
      and not exists (select 1 from ev v where v.e = r0.e and v.pdt = r0.dt and v.u_evt)
),
-- поставка 104: переход «кандидат → боевая» и «стажёр → штат» — найм по дню события (hit и виды найма hcd / hst
-- датасета: вид i, in_ok = 0). Переводом не считается (все формулы переводов берут in_ok = 1), как в правиле выше;
-- до 104 эти строки давала общая ветка «в». День юнит-перехода — уже в строке U «в» (in_ok = 0, вид — cv_k)
hv as (
    select r0.* from teampulse_hub_trfr r0
    where r0.hf = 0 and r0.cv = 1
      and not exists (select 1 from ev v where v.e = r0.e and v.cdt = r0.dt and v.u_evt)
),
xr as (
    select xi.*, 'i' as dir from xi
    union all
    select xo.*, 'o' from xo
    union all
    select xa.*, 'a' from xa
    union all
    select hv.*, 'v' from hv
),
xn as (
    select z.* from (select r.*, unnest(ARRAY[k1, k2, k3, k4, k5, k6, k7, k8, k9, k10, k11]) as node_rk from xr r) z where z.node_rk <> '-'
    union all
    select d.* from (select r.*, coalesce(nullif(k11, '-'), nullif(k10, '-'), nullif(k9, '-'), nullif(k8, '-'), nullif(k7, '-'), nullif(k6, '-'), nullif(k5, '-'), nullif(k4, '-'), nullif(k3, '-'), nullif(k2, '-'), nullif(k1, '-')) || ':d' as node_rk from xr r) d where d.node_rk is not null
    union all
    select r.*, 'all' from xr r where (select mo from teampulse_hub_cal) = 1
)
select node_rk, report_month, trf_kind, paint_cd, it_cd, staff_cd, act_cd, fu, fa, fp, fi, fs, in_ok,
       x_paint_cd, x_it_cd, x_staff_cd, x_act_cd, cv_k, sp_cd, fsp, hg_cd, hs_cd, count(*) as trf_cnt
from (
    -- U «в»: узлы новой строки; флаги фильтров — её же (периметр строит датасет)
    select ui.node_rk, date_trunc('month', ui.cdt)::date as report_month, 'i' as trf_kind,
           ui.cpa as paint_cd, ui.cit as it_cd, ui.cst as staff_cd, ui.cac as act_cd,
           ui.fu, ui.cia as fa, ui.cip as fp, ui.cii as fi, ui.cist as fs,
           1 - least(ui.ccc + ui.ctif, 1) as in_ok,
           -- GP-перенос 104: имена колонок объединения задаёт первая ветка — без них внешний select их не видит
           null::text as x_paint_cd, null::text as x_it_cd, null::text as x_staff_cd, null::text as x_act_cd,
           -- поставка 104: вид перехода в найм (c — из учебной группы, s — стажёр в штат) — для hcd / hst датасета
           case when ui.ccc = 1 then 'c' when ui.ctif = 1 then 's' else '' end as cv_k, ui.csp as sp_cd, ui.cisp as fsp,
           -- 09.11: грейд и источник дня найма — только у строк найма (вид h и переходы в найм, in_ok = 0)
           case when ui.ccc + ui.ctif > 0 then ui.cgr end as hg_cd, case when ui.ccc + ui.ctif > 0 then ui.chs end as hs_cd
    from ui
    union all
    -- U «из»: узлы старой строки, дата события — новая строка. 09.11 (сверка с мастер-отчётом Executive Report: «Перевод-»
    -- на всей компании меньше мастера): флаг выхода из типа численности — старой строки (oa), как у «в» флаг входа новой
    -- (cia). Было 0: переход в другое подразделение с выходом из «Активной» в тот же день у общих узлов пути (и у корня)
    -- выходом не считался
    select uo.node_rk, date_trunc('month', uo.cdt)::date, 'o',
           uo.pa, uo.it, uo.st, uo.ac,
           uo.fu, uo.oa, uo.oq, uo.oi, uo.ost, 1,
           null::text, null::text, null::text, null::text, '', uo.sp, uo.osp, null::text, null::text
    from uo
    union all
    -- TI: вход в активную численность юнита
    select e2.node_rk, date_trunc('month', e2.dt)::date, 'i',
           e2.pa, e2.it, e2.st, e2.ac, 0, 1, e2.ip, e2.ii, e2.ist, 1 - e2.cv,
           null::text, null::text, null::text, null::text, '', e2.sp, e2.isp, null::text, null::text
    from e2 where e2.kind = 'ti'
    union all
    -- 09.11: выход из типа численности по флагу строки (xa выше) — узлы и срезы этой строки, месяц «день + 1»
    select xn.node_rk, date_trunc('month', xn.dt + 1)::date, 'o',
           xn.pa, xn.it, xn.st, xn.ac, 0, 1, xn.oq, xn.oi, xn.ost, 1,
           null::text, null::text, null::text, null::text, '', xn.sp, xn.osp, null::text, null::text
    from xn where xn.dir = 'a'
    union all
    -- найм в компанию: узлы и срез дня найма; вид — c из учебной группы в боевую, s стажёр в штат
    select e2.node_rk, date_trunc('month', e2.dt)::date, 'h',
           e2.pa, e2.it, e2.st, e2.ac, 0, 0, 0, 0, 0, 1,
           null::text, null::text, null::text, null::text,
           case when e2.cv = 0 then '' when e2.cc = 1 then 'c' else 's' end, e2.sp, 0, e2.gr, e2.hs
    from e2 where e2.kind = 'h'
    union all
    -- смена специализации: «внутри юнита» (CI / CO датасета); «из» последним днём месяца — в следующий
    select e2.node_rk, date_trunc('month', e2.dt)::date, 'i',
           e2.pa, e2.it, e2.st, e2.ac, 0, 0, 0, 0, 0, 1,
           null::text, null::text, null::text, null::text, '', e2.sp, 1, null::text, null::text
    from e2 where e2.kind = 'fs' and e2.isp = 1 and e2.hf = 0
    union all
    select e2.node_rk, date_trunc('month', e2.dt + e2.ld)::date, 'o',
           e2.pa, e2.it, e2.st, e2.ac, 0, 0, 0, 0, 0, 1,
           null::text, null::text, null::text, null::text, '', e2.sp, 1, null::text, null::text
    from e2 where e2.kind = 'fs' and e2.osp = 1
      and not exists (select 1 from xa where xa.e = e2.e and xa.dt = e2.dt)   -- 09.11: эта строка уже в xa (fsp = osp)
    union all
    -- поставка 104: смена покраски / IT / штатности без перевода юнита (xi / xo выше): «в» — день новой строки, «из» —
    -- последний день прежнего значения, последний день месяца — в следующий месяц
    select xn.node_rk, date_trunc('month', xn.dt)::date, 'i',
           xn.pa, xn.it, xn.st, xn.ac, 0, 0, xn.ip, xn.ii, xn.ist, 1 - xn.cv,
           null::text, null::text, null::text, null::text, '', xn.sp, 0, null::text, null::text
    from xn where xn.dir = 'i'
    union all
    select xn.node_rk, date_trunc('month', xn.dt + xn.ld)::date, 'o',
           xn.pa, xn.it, xn.st, xn.ac, 0, 0, xn.oq, xn.oi, xn.ost, 1,
           null::text, null::text, null::text, null::text, '', xn.sp, 0, null::text, null::text
    from xn where xn.dir = 'o'
    union all
    -- поставка 104: парная строка к TO-a («в» — новая строка), дата — день перехода (09.11: «из» — по флагу строки, xa)
    select tcn.node_rk, date_trunc('month', tcn.cdt)::date, 'i',
           tcn.cpa, tcn.cit, tcn.cst, tcn.cac, 0, 1, tcn.cip, tcn.cii, tcn.cist, 1,
           null::text, null::text, null::text, null::text, '', tcn.csp, 0, null::text, null::text
    from tcn where tcn.dir = 'i'    union all
    -- поставка 104: найм переходом (hv выше) — срез и флаги смены дня, in_ok = 0
    select xn.node_rk, date_trunc('month', xn.dt)::date, 'i',
           xn.pa, xn.it, xn.st, xn.ac, 0, xn.ia, xn.ip, xn.ii, xn.ist, 0,
           null::text, null::text, null::text, null::text,
           case when xn.cc = 1 then 'c' else 's' end, xn.sp, 0, xn.gr, xn.hs
    from xn where xn.dir = 'v'
) t
where report_month between (select grid_start from teampulse_hub_cal) and (select lm from teampulse_hub_cal)
  -- GP-перенос 104: юнит-переход пишется во все узлы пути; на уровнях, где юнит не менялся, у строки нет ни одного
  -- флага — датасет её не считает ни в одной формуле. Такие строки не храним (числа отчёта не меняются)
  and not (trf_kind in ('i', 'o') and in_ok = 1 and fu + fa + fp + fi + fs + fsp = 0)
group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22
) q
distributed by (node_rk);

-- поставка 63: детализация переводов — событие × узел за 13 последних месяцев: кто (логин и шифр), когда, в
-- какой месяц, какие флаги, что было по другую сторону. Датасет 2а отдаёт её только по запросу (фильтр trd_f)
-- и считает «засчитано / почему нет» тем же правилом, что переводы. emp_code — шифр сотрудника без имени: для
-- выгрузки на сверку
drop table if exists teampulse_hub_trfe;
create table teampulse_hub_trfe as
select * from (
with r as (
    select r.*, vi.pa as xi_pa, vi.it as xi_it, vi.st as xi_st, vi.ac as xi_ac, vi.lu as xi_lu,
           vo.pa as xo_pa, vo.it as xo_it, vo.st as xo_st, vo.ac as xo_ac, vo.lu as xo_lu,
           left(md5('teampulse-hub:' || r.e::text), 10) as emp_code, l.login
    from teampulse_hub_trfr r
    left join teampulse_hub_trfv vi on vi.e = r.e and vi.d = r.dt - 1 and r.hf = 0
    left join teampulse_hub_trfv vo on vo.e = r.e and vo.d = r.dt + 1 and r.fx = 0
    left join teampulse_hub_login l on l.erk = r.e
    where r.dt >= ((select lm from teampulse_hub_cal) - interval '12 month')::date - 1
),
e as (
    select z.* from (
        select r.*, unnest(ARRAY[r.k1, r.k2, r.k3, r.k4, r.k5, r.k6, r.k7, r.k8, r.k9, r.k10, r.k11]) as node_rk,
               unnest(ARRAY[r.ui1, r.ui2, r.ui3, r.ui4, r.ui5, r.ui6, r.ui7, r.ui8, r.ui9, r.ui10, r.ui11]) as fu_in,
               unnest(ARRAY[r.uo1, r.uo2, r.uo3, r.uo4, r.uo5, r.uo6, r.uo7, r.uo8, r.uo9, r.uo10, r.uo11]) as fu_out
        from r
    ) z
    where z.node_rk <> '-'
    union all
    -- поставка 64: «напрямую в юните» — узел юнит:d, флаг — любой флаг юнита строки
    select d.* from (
        select r.*, coalesce(nullif(r.k11, '-'), nullif(r.k10, '-'), nullif(r.k9, '-'), nullif(r.k8, '-'),
                nullif(r.k7, '-'), nullif(r.k6, '-'), nullif(r.k5, '-'), nullif(r.k4, '-'), nullif(r.k3, '-'),
                nullif(r.k2, '-'), nullif(r.k1, '-')) || ':d' as node_rk,
               greatest(r.ui1, r.ui2, r.ui3, r.ui4, r.ui5, r.ui6, r.ui7, r.ui8, r.ui9, r.ui10, r.ui11) as fu_in,
               greatest(r.uo1, r.uo2, r.uo3, r.uo4, r.uo5, r.uo6, r.uo7, r.uo8, r.uo9, r.uo10, r.uo11) as fu_out
        from r
    ) d
    where d.node_rk is not null
    union all
    select r.*, 'all', 0, 0 from r where (select mo from teampulse_hub_cal) = 1
)
select node_rk, report_month, ev_dt, trf_kind, emp_code, login, paint_cd, it_cd, staff_cd, act_cd, fu, fa, fp, fi, fs,
       in_ok, x_paint_cd, x_it_cd, x_staff_cd, x_act_cd, x_unit
from (
    select e.node_rk, date_trunc('month', e.dt)::date as report_month, e.dt as ev_dt, 'i' as trf_kind,
           e.emp_code, e.login, e.pa as paint_cd, e.it as it_cd, e.st as staff_cd, e.ac as act_cd,
           e.fu_in as fu, e.ia as fa, e.ip as fp, e.ii as fi, e.ist as fs, 1 - e.cv as in_ok,
           e.xi_pa as x_paint_cd, e.xi_it as x_it_cd, e.xi_st as x_staff_cd, e.xi_ac as x_act_cd, e.xi_lu as x_unit
    from e
    where e.hf = 0 and (e.fu_in = 1 or e.ia = 1 or e.ip = 1 or e.ii = 1 or e.ist = 1)
    union all
    select e.node_rk, date_trunc('month', e.dt + e.ld)::date, e.dt, 'o', e.emp_code, e.login,
           e.pa, e.it, e.st, e.ac, e.fu_out, e.oa, e.oq, e.oi, e.ost, 1,
           e.xo_pa, e.xo_it, e.xo_st, e.xo_ac, e.xo_lu
    from e
    where e.fx = 0 and (e.fu_out = 1 or e.oa = 1 or e.oq = 1 or e.oi = 1 or e.ost = 1)
) t
where report_month between ((select lm from teampulse_hub_cal) - interval '12 month')::date and (select lm from teampulse_hub_cal)
) q
distributed by (node_rk);
drop table if exists teampulse_hub_trfr;
drop table if exists teampulse_hub_trfv;

select trf_kind, count(*) as rows_cnt, coalesce(sum(trf_cnt), 0) as events
from teampulse_hub_trf
group by 1
union all
select 'детализация ' || trf_kind, count(*), count(distinct emp_code)
from teampulse_hub_trfe
group by 1
order by 1;
