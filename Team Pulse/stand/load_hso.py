# Загрузка симуляции в chdb: схема — та, что в разведке 12.10.2026 (describe датасета 174609,
# файл «Разведка»): 32 колонки, active_type_nm больше нет, employment_relation_type вместо _desc.
import sys
from chdb import session
db, csv_path = sys.argv[1], sys.argv[2]
SCHEMA = """month Nullable(Date), mngt_unit_rk Nullable(String), mngt_unit_nm Nullable(String), lvl Nullable(Int32),
 parent_mngt_unit_rk Nullable(String), parent_mngt_unit_nm Nullable(String), parent_lvl Nullable(Int32),
 active_type_gr_nm Nullable(String),
 emp_specialization_oper_code Nullable(String), emp_specialization_it_code Nullable(String),
 employment_relation_type Nullable(String),
 employee_amt Nullable(Float64), transfer_candidate_amt Nullable(Float64), transfer_internal_amt Nullable(Float64),
 hire_amt Nullable(Float64), hire_to_active_amt Nullable(Float64), fire_amt Nullable(Float64), regret_fire_amt Nullable(Float64),
 transfer_in_amt Nullable(Float64), transfer_out_amt Nullable(Float64),
 perf_normal Nullable(Float64), perf_low Nullable(Float64), perf_high Nullable(Float64), perf_gray Nullable(Float64),
 lag_employee_amt Nullable(Float64), ssch_employee_amt Nullable(Float64),
 work_day_amt Nullable(Float64), office_visit_amt Nullable(Float64),
 grt_approve_cnt Nullable(Int64), grt_decline_cnt Nullable(Int64), grt_cancel_cnt Nullable(Int64), grt_inprogress_cnt Nullable(Int64)"""
s = session.Session(db)
s.query("CREATE DATABASE IF NOT EXISTS prod_proteus")
s.query("DROP TABLE IF EXISTS prod_proteus.hr_structure_overall")
s.query(f"CREATE TABLE prod_proteus.hr_structure_overall ({SCHEMA}) ENGINE = MergeTree ORDER BY tuple()")
s.query(f"INSERT INTO prod_proteus.hr_structure_overall SELECT * FROM file('{csv_path}', CSV, '{SCHEMA}')")
print(s.query("""SELECT count(), uniqExact(mngt_unit_rk), min(month), max(month),
  sumIf(employee_amt, lvl = 1 AND month = '2026-09-01'), sumIf(grt_approve_cnt, lvl = 1 AND month = '2026-09-01')
FROM prod_proteus.hr_structure_overall""", "CSV"), 'колонок', len(str(s.query("DESCRIBE TABLE prod_proteus.hr_structure_overall", "TSV")).strip().splitlines()))
