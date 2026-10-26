-- 23.10 (Адель): + руководитель юнита на месяц — логин и имя (unit_head_structure; с поставки 66 там одна строка
-- на юнит и месяц, строки юнита не размножаются)
DROP TABLE IF EXISTS org_structure;
CREATE TABLE org_structure AS

with prep as(
SELECT
    report_month,
    mng_unit_rk,
    leaf_lvl,
    lvl1_nm,
    lvl2_nm,
    lvl3_nm,
    lvl4_nm,
    lvl5_nm,
    lvl6_nm,
    lvl7_nm,
    lvl8_nm,
    lvl9_nm,
    lvl10_nm,
    lvl11_nm
    -- ── метрики: сумма по всем разрезам внутри юнита ──
FROM all_metrics
GROUP BY
    report_month,
    mng_unit_rk,
    leaf_lvl,
    lvl1_nm, lvl2_nm, lvl3_nm, lvl4_nm, lvl5_nm,
    lvl6_nm, lvl7_nm, lvl8_nm, lvl9_nm, lvl10_nm, lvl11_nm
)

SELECT prep.*
    , uhs.leader_login -- логин руководителя
    , uhs.leader_full_nm -- имя руководителя
FROM prep
LEFT JOIN unit_head_structure uhs
    ON prep.mng_unit_rk = uhs.management_unit_rk AND prep.report_month = uhs.report_month


DISTRIBUTED BY (mng_unit_rk);

ANALYZE org_structure;
