-- =============================================================================
-- TeamPulse Hub · 5. Переходы людей (поставка 58: SQL вместо build_hub)
-- teampulse_hub_trf — узел × месяц × вид × срез до × срез после: датасет считает из них переводы в выбор
-- и из выбора под любые фильтры. Перевод — только если смену отметил флаг источника: «в» — на первом
-- дне в новом состоянии, «из» — на последнем в старом; переход между днями t−1 и t датируется днём t.
-- Виды: i / o / s — вошёл в узел, вышел, остался со сменой среза; h — найм в компанию (срез дня найма);
-- x… — смены без флага, для сверки (xi / xo / xs, xa — появился без найма, xd — пропал без увольнения).
-- Дневной источник читается один раз. Окно — месяц, как у помесячных частей build_hub: «вчера» для дня
-- месяца — только дни этого месяца и последний день прошлого; «пропал» — нет его до конца месяца.
-- =============================================================================

-- 10а. события по дням: смены юнита или среза, найм и появления, пропажи. Строка — человек × день, у
--      которого есть событие; «0» — прошлый день человека, «1» — следующий. Путь юнита (op) — ключами из
--      строки дня; нынешний путь подставляет 10б: событий мало, а сортировка по людям и дням — узкая
drop table if exists teampulse_hub_ev;
create table teampulse_hub_ev as
select s.e, s.dt, s.mo_dt as report_month, s.u, s.op, s.pa, s.it, s.st, s.ac, s.hf, s.cv, s.fx,
       s.iu, s.ip, s.ii, s.ist, s.ia, s.u0, s.op0, s.pa0, s.it0, s.st0, s.ac0, s.fx0, s.ou0, s.oq0, s.oi0, s.ost0, s.oa0,
       s.g_ok::int as is_g, s.ha_ok::int as is_ha, s.d_ok::int as is_d
from (
    select w.*,
           -- смена против прошлого дня того же окна месяца; найм — отдельно (h)
           (w.mo_dt between c.grid_start and c.lm and w.dt0 >= w.mo_dt - 1 and w.hf = 0
            and (w.u <> w.u0 or (w.pa, w.it, w.st, w.ac) <> (w.pa0, w.it0, w.st0, w.ac0))) as g_ok,
           -- найм в компанию или появление: прошлого дня в окне месяца нет
           (w.mo_dt between c.grid_start and c.lm and (w.hf = 1 or w.dt0 is null or w.dt0 < w.mo_dt - 1)) as ha_ok,
           -- пропал без увольнения: следующего дня нет до конца месяца, где был бы «завтра»
           (w.mo_d1 between c.grid_start and c.lm and w.fx = 0 and w.dt < least(((w.mo_d1 + interval '1 month')::date - 1), c.dt)
            and (w.dt1 is null or w.dt1 > ((w.mo_d1 + interval '1 month')::date - 1))) as d_ok
    from (
        select y.*, date_trunc('month', y.dt)::date as mo_dt, date_trunc('month', y.dt + 1)::date as mo_d1,
               lag(y.dt) over wd as dt0, lag(y.u) over wd as u0, lag(y.op) over wd as op0,
               lag(y.pa) over wd as pa0, lag(y.it) over wd as it0, lag(y.st) over wd as st0,
               lag(y.ac) over wd as ac0, lag(y.fx) over wd as fx0, lag(y.ou) over wd as ou0,
               lag(y.oq) over wd as oq0, lag(y.oi) over wd as oi0, lag(y.ost) over wd as ost0,
               lag(y.oa) over wd as oa0,
               lead(y.dt) over wd as dt1
        from (
            -- одна строка на человека и день (если их несколько — с меньшим юнитом): то же окно по человеку,
            -- что и у «вчера», — GP перераспределяет строки один раз
            select z.*, case when lag(z.dt) over (partition by z.e order by z.dt, z.u) = z.dt then 0 else 1 end as rn
            from (
                -- юнит дня — самый глубокий уровень с ключом (lf), его путь — ключи уровней до него (op)
                select q.e, q.dt, case q.lf when 1 then q.k1 when 2 then q.k2 when 3 then q.k3 when 4 then q.k4
                                     when 5 then q.k5 when 6 then q.k6 when 7 then q.k7 when 8 then q.k8
                                     when 9 then q.k9 when 10 then q.k10 when 11 then q.k11 else '' end as u,
                       case when q.lf = 0 then '' else concat_ws('|', q.k1, case when q.lf >= 2 then q.k2 end,
                                                             case when q.lf >= 3 then q.k3 end,
                                                             case when q.lf >= 4 then q.k4 end,
                                                             case when q.lf >= 5 then q.k5 end,
                                                             case when q.lf >= 6 then q.k6 end,
                                                             case when q.lf >= 7 then q.k7 end,
                                                             case when q.lf >= 8 then q.k8 end,
                                                             case when q.lf >= 9 then q.k9 end,
                                                             case when q.lf >= 10 then q.k10 end,
                                                             case when q.lf >= 11 then q.k11 end) end as op,
                       q.pa, q.it, q.st, q.ac, q.hf, q.cv, q.fx, q.iu, q.ou, q.ip, q.oq, q.ii, q.oi, q.ist, q.ost, q.ia, q.oa
                from (
                    select r.*, case when r.k11 <> '-' then 11 when r.k10 <> '-' then 10 when r.k9 <> '-' then 9
                              when r.k8 <> '-' then 8 when r.k7 <> '-' then 7 when r.k6 <> '-' then 6
                              when r.k5 <> '-' then 5 when r.k4 <> '-' then 4 when r.k3 <> '-' then 3
                              when r.k2 <> '-' then 2 when r.k1 <> '-' then 1 else 0 end as lf
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
                               coalesce(nullif(coalesce(x.emp_specialization_oper_code::text, '-'), ''), '-') as pa,
                               coalesce(nullif(coalesce(x.emp_specialization_it_code::text, '-'), ''), '-') as it,
                               case when x.employment_relation_type_desc = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as st,
                               case when coalesce(x.active_count_flg::text, '0') = '1' then 'Активная' else 'Прочие' end as ac,
                               (coalesce(x.hire_flg::text, '0') = '1')::int as hf,
                               least((coalesce(x.transfer_candidate_flg::text, '0') = '1')::int + (coalesce(x.transfer_internal_flg::text, '0') = '1')::int, 1) as cv,
                               (coalesce(x.fire_flg::text, '0') = '1')::int as fx,
                               (coalesce(x.lvl1_mngt_unit_in_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl2_mngt_unit_in_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl3_mngt_unit_in_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl4_mngt_unit_in_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl5_mngt_unit_in_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl6_mngt_unit_in_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl7_mngt_unit_in_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl8_mngt_unit_in_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl9_mngt_unit_in_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl10_mngt_unit_in_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl11_mngt_unit_in_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl12_mngt_unit_in_trsf_flg::text, '0') = '1')::int as iu,
                               (coalesce(x.lvl1_mngt_unit_out_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl2_mngt_unit_out_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl3_mngt_unit_out_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl4_mngt_unit_out_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl5_mngt_unit_out_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl6_mngt_unit_out_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl7_mngt_unit_out_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl8_mngt_unit_out_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl9_mngt_unit_out_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl10_mngt_unit_out_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl11_mngt_unit_out_trsf_flg::text, '0') = '1' or
                                coalesce(x.lvl12_mngt_unit_out_trsf_flg::text, '0') = '1')::int as ou,
                               (coalesce(x.transfer_to_hq_flg::text, '0') = '1')::int as ip, (coalesce(x.transfer_out_hq_flg::text, '0') = '1')::int as oq,
                               (coalesce(x.transfer_to_it_flg::text, '0') = '1')::int as ii, (coalesce(x.transfer_out_it_flg::text, '0') = '1')::int as oi,
                               (coalesce(x.transfer_to_employment_relation_type_flg::text, '0') = '1')::int as ist,
                               (coalesce(x.transfer_out_employment_relation_type_flg::text, '0') = '1')::int as ost,
                               (coalesce(x.transfer_to_active_type_flg::text, '0') = '1')::int as ia,
                               (coalesce(x.transfer_out_active_type_flg::text, '0') = '1')::int as oa
                        from usr_cross_data.hr_executive_proteus x
                        -- сетка отчёта и последний день перед ней; первое условие — отсечение партиций
                        where x.calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date
                          and x.calendar_dt >= (select grid_start from teampulse_hub_cal) - 1
                          and x.calendar_dt < ((select lm from teampulse_hub_cal) + interval '1 month')::date
                    ) r
                ) q
            ) z
        ) y
        where y.rn = 1
        window wd as (partition by y.e order by y.dt)
    ) w
    cross join teampulse_hub_cal c
) s
where s.g_ok or s.ha_ok or s.d_ok
distributed by (e);

-- 10б. события → переходы по узлам. Путь юнита — нынешний (_upath), у юнита вне нынешней структуры — свой
--      (op). Какие части перехода отметил источник: «в» на новом дне или «из» на прошлом; неотмеченная часть —
--      как будто не менялась (вид без «x»), по значениям — сверка (вид «x…»)
drop table if exists teampulse_hub_trf;
create table teampulse_hub_trf as
select * from (
with s as (
    select v.*,
           case when v.u = '' then '' else coalesce(ua1.cp, v.op) end as cp,
           case when v.u0 = '' then '' else coalesce(ua0.cp, v.op0) end as cpb
    from teampulse_hub_ev v
    left join teampulse_hub_upath ua1 on ua1.unit_rk = v.u
    left join teampulse_hub_upath ua0 on ua0.unit_rk = v.u0
),
g as (
    select s.*,
           coalesce(greatest(s.iu, s.ou0), (s.u <> s.u0)::int) as gu,
           coalesce(greatest(s.ip, s.oq0), (s.pa <> s.pa0)::int) as gp,
           coalesce(greatest(s.ii, s.oi0), (s.it <> s.it0)::int) as gi,
           coalesce(greatest(s.ist, s.ost0), (s.st <> s.st0)::int) as gs,
           greatest(coalesce(greatest(s.ia, s.oa0), (s.ac <> s.ac0)::int), s.cv) as ga
    from s
    where s.is_g = 1
),
c as (
    -- «было» с учётом флагов (e): неотмеченная часть — как будто не менялась; «было» по значениям (t)
    select g.report_month, g.pa, g.it, g.st, g.ac,
           case when g.gp = 1 then g.pa0 else g.pa end as epa, case when g.gi = 1 then g.it0 else g.it end as eit,
           case when g.gs = 1 then g.st0 else g.st end as est, case when g.ga = 1 then g.ac0 else g.ac end as eac,
           g.pa0 as tpa, g.it0 as tit, g.st0 as tst, g.ac0 as tac,
           1 - g.cv as in_ok, 1 - g.fx0 as out_ok,
           g.cp as cp1,
           case when g.gu = 1 then g.cpb else g.cp end as ecp,
           g.cpb as tcp
    from g
),
r as (
    -- событие: путь до (a0) и после (a1), срез до (f) и после (t), вид-префикс
    select report_month, '' as pfx, ecp as cp0, cp1, epa as fpa, eit as fit, est as fst, eac as fac,
           pa as tpa_, it as tit_, st as tst_, ac as tac_, in_ok, out_ok
    from c where ecp <> cp1 or (epa, eit, est, eac) <> (pa, it, st, ac)
    union all
    select report_month, 'x', tcp, ecp, tpa, tit, tst, tac, epa, eit, est, eac, 1, 1
    from c where tcp <> ecp or (tpa, tit, tst, tac) <> (epa, eit, est, eac)
    union all
    select s.report_month, case when s.hf = 1 then 'h' else 'a' end, '', s.cp,
           '', '', '', '', s.pa, s.it, s.st, s.ac, 1, 1
    from s where s.is_ha = 1
    union all
    select date_trunc('month', s.dt + 1)::date, 'd', s.cp, '',
           s.pa, s.it, s.st, s.ac, '', '', '', '', 1, 1
    from s where s.is_d = 1
),
t as (
    select r.*, case when r.cp0 = '' then '{}'::text[] else string_to_array((select pre from teampulse_hub_cal) || r.cp0, '|') end as a0,
           case when r.cp1 = '' then '{}'::text[] else string_to_array((select pre from teampulse_hub_cal) || r.cp1, '|') end as a1,
           (fpa, fit, fst, fac) <> (tpa_, tit_, tst_, tac_) as cut_chg
    from r
),
n as (
    select report_month, node_rk, pfx, case when node_rk = any(a0) then 's' else 'i' end as k,
           fpa, fit, fst, fac, tpa_, tit_, tst_, tac_, in_ok, out_ok, cut_chg
    from (select t.*, unnest(t.a1) as node_rk from t) z
    union all
    select report_month, node_rk, pfx, 'o', fpa, fit, fst, fac, tpa_, tit_, tst_, tac_, in_ok, out_ok, cut_chg
    from (select t.*, unnest(t.a0) as node_rk from t) z
    where not (node_rk = any(a1))
)
select node_rk, report_month,
       case pfx when '' then k when 'x' then 'x' || k when 'h' then 'h' when 'a' then 'xa' else 'xd' end as trf_kind,
       case when k = 'i' then '' else fpa end as f_paint_cd, case when k = 'i' then '' else fit end as f_it_cd,
       case when k = 'i' then '' else fst end as f_staff_cd, case when k = 'i' then '' else fac end as f_act_cd,
       case when k = 'o' then '' else tpa_ end as t_paint_cd, case when k = 'o' then '' else tit_ end as t_it_cd,
       case when k = 'o' then '' else tst_ end as t_staff_cd, case when k = 'o' then '' else tac_ end as t_act_cd,
       case when k = 'o' then 1 else in_ok end as in_ok, case when k = 'i' then 1 else out_ok end as out_ok,
       count(*) as trf_cnt
from n
where (k <> 's' or cut_chg) and (k <> 'o' or out_ok = 1)
group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
) q
distributed by (node_rk);
drop table if exists teampulse_hub_ev;

select count(*) as trf_rows, coalesce(sum(trf_cnt), 0) as transitions from teampulse_hub_trf;
