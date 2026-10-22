-- =============================================================================
-- TeamPulse Hub · 6. Вакансии, календарь отчёта, уборка (поставка 58: SQL вместо build_hub)
-- teampulse_hub_vacancy — узел × месяц × разрезы вакансии; teampulse_hub_meta — одна строка: последний
-- месяц, дата данных, сетка, корень, юнит по умолчанию. В конце — сколько строк в каждой таблице.
-- =============================================================================

-- 11. вакансии: structure_x_vacancy → узлы нынешней структуры. Путь юнита — по _upath, юнита нет в
--     последнем месяце — свой путь из уровней вакансии. Вакансия — не человек: фильтры среза на неё не действуют
drop table if exists teampulse_hub_vacancy;
create table teampulse_hub_vacancy as
select node_rk, report_month, channel, search_reason, cand_lvl, position_lvl, specialization, status,
       sum(open_cnt) as vac_open_cnt, sum(close_cnt) as vac_close_cnt, sum(new_cnt) as vac_new_cnt,
       sum(ttf_days) as vac_ttf_days, sum(ttf_cnt) as vac_ttf_cnt
from (
    select x.*, unnest(string_to_array((select pre from teampulse_hub_cal) || coalesce(u.cp, x.unit_path), '|')) as node_rk
    from structure_x_vacancy x
    left join teampulse_hub_upath u on u.unit_rk = x.mng_unit_rk::text
    where x.report_month between (select grid_start from teampulse_hub_cal) and (select lm from teampulse_hub_cal)
) e
group by 1, 2, 3, 4, 5, 6, 7, 8
distributed by (node_rk);

-- 9. календарь отчёта, корень и юнит по умолчанию (у корня один ребёнок — он)
drop table if exists teampulse_hub_meta;
create table teampulse_hub_meta as
select c.lm as last_month,
       c.dt as data_dt,
       (date_trunc('year', c.lm) - interval '1 year')::date as grid_start,
       (12 + date_part('month', c.lm))::int as n_months,
       12 as ytd_idx,
       r.unit_rk as root_rk,
       case when r.kids_cnt = 1 then (select unit_rk from teampulse_hub_unit where parent_rk = r.unit_rk) else r.unit_rk end as def_rk,
       now() as built_at,
       'hub-2' as schema_ver
from teampulse_hub_cal c
cross join (select unit_rk, kids_cnt from teampulse_hub_unit where parent_rk = '' order by unit_rk limit 1) r
distributed by (last_month);

drop table if exists teampulse_hub_node;
drop table if exists teampulse_hub_head;
drop table if exists teampulse_hub_uall;
drop table if exists teampulse_hub_uone;

select 'meta' as tbl, count(*) as rows_cnt from teampulse_hub_meta
union all select 'unit', count(*) from teampulse_hub_unit
union all select 'series', count(*) from teampulse_hub_series
union all select 'mix', count(*) from teampulse_hub_mix
union all select 'trf', count(*) from teampulse_hub_trf
union all select 'vacancy', count(*) from teampulse_hub_vacancy
union all select 'ai', count(*) from teampulse_hub_ai;
