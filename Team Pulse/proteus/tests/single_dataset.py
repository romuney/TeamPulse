"""Render the shipping single dataset and parse each branch in local ClickHouse."""
from pathlib import Path
from jinja2 import Environment
import chdb

root = Path(__file__).resolve().parents[2]
sql = next((root / 'Поставка — TeamPulse Hub').glob('2. *.sql')).read_text()
template = Environment(extensions=['jinja2.ext.do']).from_string(sql)
for unit in ('', 'test_department'):
    for review in (False, True):
        filters = {'unit_f': [unit] if unit else [], 'review_f': ['1'] if review else []}
        query = template.render(current_username=lambda: 'test_user',
                                filter_values=lambda key: filters.get(key, []))
        assert query.count('prod_proteus.teampulse_hub_review_test') == (2 if review else 0)
        assert ('"reviewMode":"loaded"' if review else '"reviewMode":"deferred"') in query
        chdb.query('EXPLAIN AST '+query, 'TSV')
print('PASS: root and department, default query excludes review, review query includes metadata and aggregates')
