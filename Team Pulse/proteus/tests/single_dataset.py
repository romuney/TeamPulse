"""Render the shipping single dataset and parse each branch in local ClickHouse."""
from pathlib import Path
from jinja2 import Environment
import json
import tempfile
import chdb
from chdb import session

root = Path(__file__).resolve().parents[2]
sql = next((root / 'Поставка — TeamPulse Hub').glob('2. *.sql')).read_text()
template = Environment(extensions=['jinja2.ext.do']).from_string(sql)
for unit in ('', 'test_department'):
    filters = {'unit_f': [unit] if unit else []}
    query = template.render(current_username=lambda: 'test_user', filter_values=lambda key: filters.get(key, []))
    assert 'teampulse_hub_review_test' in query and 'review_f' not in sql
    chdb.query('EXPLAIN AST '+query, 'TSV')
print('PASS: full SQL includes review at startup and for each department')

# A nullable key exported for the marker used to null out the entire meta JSON.
rv_expr=query.split('\',"rv":\', ',1)[1].split(',\n',1)[0]
with tempfile.TemporaryDirectory() as tmp:
    db=session.Session(tmp)
    db.query('CREATE DATABASE prod_proteus')
    table='prod_proteus.teampulse_hub_review_test'
    db.query(f'CREATE TABLE {table} (node_rk Nullable(String),mx_key String,mx_val Nullable(String)) ENGINE=Memory')
    for expected in ('','hub-2-review-2|2026'):
        if expected:
            db.query(f"INSERT INTO {table} VALUES (NULL,'rvmeta','{expected}')")
        meta=json.loads(str(db.query("SELECT concat('{\"rv\":',"+rv_expr+",'}')", 'TabSeparatedRaw')))
        assert meta=={'rv':expected}
    db.close()
print('PASS: metadata remains valid with a nullable marker key or absent review marker')
