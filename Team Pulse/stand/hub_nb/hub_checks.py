# =============================================================================
# Проверки таблиц TeamPulse Hub — до выгрузки. Каждая — одно число; не сошлось —
# исключение, и параграф выгрузки не запускается со старыми данными в отчёте
# =============================================================================
from dal_client import query as dal

HUB_P = 'teampulse_hub'
HUB_SRC = 'all_metrics_with_performance_and_office_traffic_and_grt'


def _hub_one(sql):
    v = dal.get_df(datasource='gp', query=sql).iloc[0, 0]
    return 0 if v is None else float(v)


_root = f"(select root_rk from {HUB_P}_meta)"
_lm = f"(select last_month from {HUB_P}_meta)"
HUB_CHECKS = [
    ('корень − люди: численность последнего месяца',
     f"""select (select sum(hc_cnt) from {HUB_P}_series where node_rk = {_root} and report_month = {_lm})
              - (select sum(hc_total_cnt) from {HUB_SRC} where leaf_lvl > 0 and report_month = {_lm})"""),
    ('корень − люди: увольнения за всё время',
     f"""select (select sum(fire_cnt) from {HUB_P}_series where node_rk = {_root})
              - (select sum(fire_amt) from {HUB_SRC} where leaf_lvl > 0)"""),
    ('корень − люди: перформанс за всё время',
     f"""select (select sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) from {HUB_P}_series where node_rk = {_root})
              - (select sum(perf_normal + perf_low + perf_high + perf_gray) from {HUB_SRC} where leaf_lvl > 0)"""),
    ('корень − разрез по полу (численность)',
     f"""select (select sum(hc_cnt) from {HUB_P}_series where node_rk = {_root} and report_month = {_lm})
              - (select sum(mx_n) from {HUB_P}_mix where node_rk = {_root} and mx_key = 'g')"""),
    ('повторы ключа «узел × месяц × срез»',
     f"""select count(*) from (select 1 from {HUB_P}_series
                               group by node_rk, report_month, paint_cd, it_cd, staff_cd, act_cd having count(*) > 1) t"""),
    ('узлов, у которых нет родителя в справочнике (кроме корня)',
     f"""select count(*) from {HUB_P}_unit u
         where u.parent_rk <> '' and not exists (select 1 from {HUB_P}_unit p where p.unit_rk = u.parent_rk)"""),
    # 21.10: переходы — «остался» только при смене среза, без пустых строк
    ('переходы: «остался» без смены среза',
     f"""select count(*) from {HUB_P}_trf where trf_kind = 's'
         and (f_paint_cd, f_it_cd, f_staff_cd, f_act_cd) = (t_paint_cd, t_it_cd, t_staff_cd, t_act_cd)"""),
    ('переходы: строк без людей',
     f"select count(*) from {HUB_P}_trf where trf_cnt <= 0 or (in_ok = 0 and out_ok = 0)"),
]
# 21.10, поставка 50: вакансии корня против снимка structure_x_vacancy — справочно, выгрузку не
# останавливает: вакансия юнита вне дерева людей (другая ветка структуры) в корень не попадёт
HUB_INFO = [
    ('вакансии: корень − снимок (открытые на конец последнего месяца)',
     f"""select coalesce((select sum(vac_open_cnt) from {HUB_P}_vacancy where node_rk = {_root} and report_month = {_lm}), 0)
              - coalesce((select sum(open_cnt) from structure_x_vacancy where report_month = {_lm}), 0)"""),
    ('вакансии: корень − снимок (закрытые за всё время сетки)',
     f"""select coalesce((select sum(vac_close_cnt) from {HUB_P}_vacancy where node_rk = {_root}), 0)
              - coalesce((select sum(close_cnt) from structure_x_vacancy
                           where report_month >= (select grid_start from {HUB_P}_meta)), 0)"""),
]
HUB_CHECKS += [
    ('корней',
     f"select count(*) - 1 from {HUB_P}_unit where parent_rk = ''"),
    ('узлов, где подразделения больше узла (численность)',
     f"""with h as (select node_rk, sum(hc_cnt) as hc from {HUB_P}_series where report_month = {_lm} group by 1)
         select count(*) from {HUB_P}_unit u
         join h on h.node_rk = u.unit_rk
         left join (select u2.parent_rk, sum(h2.hc) as hc from {HUB_P}_unit u2 join h h2 on h2.node_rk = u2.unit_rk
                    group by 1) k on k.parent_rk = u.unit_rk
         where h.hc - coalesce(k.hc, 0) < -0.5"""),
]

_bad = []
for name, sql in HUB_CHECKS:
    v = _hub_one(sql)
    ok = abs(v) < 0.5
    print(f"[{'OK' if ok else 'FAIL'}] {name}: {v:g}")
    if not ok:
        _bad.append(name)
for name, sql in HUB_INFO:
    try:
        print(f"[INFO] {name}: {_hub_one(sql):g}")
    except Exception as e:                      # таблицы вакансий нет — не повод останавливать выгрузку
        print(f"[INFO] {name}: не посчитать ({str(e)[:80]})")
if _bad:
    raise Exception('таблицы TeamPulse Hub не сходятся: ' + '; '.join(_bad))
print('[OK] таблицы TeamPulse Hub сходятся')
