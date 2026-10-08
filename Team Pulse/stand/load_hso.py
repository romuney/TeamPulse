# Загрузка симуляции в chdb: схема — ровно та, что в ответе DESCRIBE (файл «Разведка»).
import sys
from chdb import session
db, csv_path = sys.argv[1], sys.argv[2]
s = session.Session(db)
s.query("CREATE DATABASE IF NOT EXISTS prod_proteus")
s.query("DROP TABLE IF EXISTS prod_proteus.hr_structure_overall")
s.query("""
CREATE TABLE prod_proteus.hr_structure_overall (
 month Nullable(Date), mngt_unit_rk Nullable(String), mngt_unit_nm Nullable(String), lvl Nullable(Int32),
 parent_mngt_unit_rk Nullable(String), parent_mngt_unit_nm Nullable(String), parent_lvl Nullable(Float64),
 active_type_gr_nm Nullable(String), active_type_nm Nullable(String),
 emp_specialization_oper_code Nullable(String), emp_specialization_it_code Nullable(String),
 employment_relation_type_desc Nullable(String),
 employee_amt Nullable(Float64), transfer_candidate_amt Nullable(Float64), transfer_internal_amt Nullable(Float64),
 hire_amt Nullable(Float64), hire_to_active_amt Nullable(Float64), fire_amt Nullable(Float64), regret_fire_amt Nullable(Float64),
 transfer_in_amt Nullable(Float64), transfer_out_amt Nullable(Float64),
 perf_normal Nullable(Float64), perf_low Nullable(Float64), perf_high Nullable(Float64), perf_gray Nullable(Float64),
 lag_employee_amt Nullable(Float64), ssch_employee_amt Nullable(Float64)
) ENGINE = MergeTree ORDER BY tuple()
""")
s.query(f"""INSERT INTO prod_proteus.hr_structure_overall
SELECT * FROM file('{csv_path}', CSV, 'month Nullable(Date), mngt_unit_rk Nullable(String), mngt_unit_nm Nullable(String), lvl Nullable(Int32),
 parent_mngt_unit_rk Nullable(String), parent_mngt_unit_nm Nullable(String), parent_lvl Nullable(Float64),
 active_type_gr_nm Nullable(String), active_type_nm Nullable(String),
 emp_specialization_oper_code Nullable(String), emp_specialization_it_code Nullable(String),
 employment_relation_type_desc Nullable(String),
 employee_amt Nullable(Float64), transfer_candidate_amt Nullable(Float64), transfer_internal_amt Nullable(Float64),
 hire_amt Nullable(Float64), hire_to_active_amt Nullable(Float64), fire_amt Nullable(Float64), regret_fire_amt Nullable(Float64),
 transfer_in_amt Nullable(Float64), transfer_out_amt Nullable(Float64),
 perf_normal Nullable(Float64), perf_low Nullable(Float64), perf_high Nullable(Float64), perf_gray Nullable(Float64),
 lag_employee_amt Nullable(Float64), ssch_employee_amt Nullable(Float64)')""")
print(s.query("""SELECT count(), uniqExact(mngt_unit_rk), min(month), max(month),
  sumIf(employee_amt, lvl = 1 AND month = '2026-09-01'), sumIf(hire_amt, lvl = 1 AND month = '2026-09-01')
FROM prod_proteus.hr_structure_overall""", "CSV"))
