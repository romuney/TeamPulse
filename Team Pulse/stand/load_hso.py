# Загрузка симуляции в chdb: схема — разведка 15.10.2026 (describe физического датасета
# 175625, файл «Разведка»): 46 колонок, денормализованное дерево lvl1_nm … lvl11_nm + leaf_lvl.
import sys
from chdb import session
db, csv_path = sys.argv[1], sys.argv[2]
LVL = ', '.join(f'lvl{i}_nm Nullable(String)' for i in range(1, 12))
SCHEMA = f"""report_month Nullable(Date), mng_unit_rk Nullable(String), leaf_lvl Nullable(Int32), {LVL},
 gender Nullable(String), type_age Nullable(String), experience_group_nm Nullable(String), grade Nullable(String),
 seniority Nullable(String), employee_contract_type Nullable(String), legal_organization Nullable(String),
 employee_stream Nullable(String), employment_relation_type Nullable(String),
 fire_reason_group Nullable(String), fire_initiative Nullable(String),
 hc_total_cnt Nullable(Int64), hc_active_cnt Nullable(Int64), lag_hc_active_cnt Nullable(Int64),
 ssch_hc_active_cnt Nullable(Float64),
 hire_amt Nullable(Int64), fire_amt Nullable(Int64), regret_fire_amt Nullable(Int64),
 transfer_in_amt Nullable(Int64), transfer_out_amt Nullable(Int64),
 transfer_candidate_amt Nullable(Int64), transfer_internal_amt Nullable(Int64),
 perf_normal Nullable(Float64), perf_low Nullable(Float64), perf_high Nullable(Float64), perf_gray Nullable(Float64),
 work_day_amt Nullable(Float64), office_visit_amt Nullable(Float64),
 grt_approve_cnt Nullable(Int64), grt_decline_cnt Nullable(Int64), grt_cancel_cnt Nullable(Int64), grt_inprogress_cnt Nullable(Int64)"""
s = session.Session(db)
s.query("CREATE DATABASE IF NOT EXISTS prod_proteus")
s.query("DROP TABLE IF EXISTS prod_proteus.hr_structure_overall")
s.query(f"CREATE TABLE prod_proteus.hr_structure_overall ({SCHEMA}) ENGINE = MergeTree ORDER BY tuple()")
s.query(f"INSERT INTO prod_proteus.hr_structure_overall SELECT * FROM file('{csv_path}', CSV, '{SCHEMA}')")
print(s.query("""SELECT count(), uniqExact(mng_unit_rk), min(report_month), max(report_month),
  sumIf(hc_total_cnt, leaf_lvl = 1 AND report_month = '2026-09-01'), sumIf(grt_approve_cnt, leaf_lvl = 1 AND report_month = '2026-09-01')
FROM prod_proteus.hr_structure_overall""", "CSV"), 'колонок', len(str(s.query("DESCRIBE TABLE prod_proteus.hr_structure_overall", "TSV")).strip().splitlines()))
