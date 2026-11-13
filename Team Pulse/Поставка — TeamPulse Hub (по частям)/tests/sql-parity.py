"""Exact release gate: delivered virtual SQL versus immutable ordinary SQL.

Requires a synthetic notebook fixture with the access principals used below.
The test never creates tables or modifies data. M1 uses sqlparse 0.4.3, M2 uses
0.4.4 (select its installation with PYTHONPATH). Both use the kit's real lexer
patch, rendering, virtual-table GROUP BY and final SQL path. One worker is the
default because parallel Float64 aggregation can change the golden's own last
exported decimal. No rounding/tolerance is added by this test.

Example: python tests/sql-parity.py --db /path/to/fixture/db --lexenv M1
Use --db '...?...config...' if the local ClickHouse build needs startup options.
"""
import argparse
import hashlib
import json
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
DELIVERY = HERE.parent
TEAM = DELIVERY.parent
REPO = TEAM.parent
sys.path[:0] = [str(REPO / 'proteus-playbook/kit'), str(TEAM / 'stand')]

COLS = 'role id pid lvl nm kids j ms mx'.split()
PARTS = ['dict', 'core', 'people', 'flow', 'aux']
CHANGED = ['core', 'aux']


def token_hashes(sql, sqlparse):
    tokens = [(str(kind), value) for kind, value in sqlparse.lexer.tokenize(sql)
              if kind not in sqlparse.tokens.Whitespace and kind not in sqlparse.tokens.Comment]
    semantic = []
    for kind, value in tokens:
        # 0.4.3 labels IN/NOT IN as Comparison; 0.4.4 emits Keyword IN and
        # separate Keyword NOT. Normalize exactly that known lexer difference.
        # Literals, identifiers, punctuation and all other tokens stay exact.
        if kind in ('Token.Operator.Comparison', 'Token.Keyword') and value in ('IN', 'NOT', 'NOT IN'):
            semantic.extend(('membership-keyword', word) for word in value.split(' '))
        else:
            semantic.append((kind, value))
    digest = lambda value: hashlib.sha256(json.dumps(value, ensure_ascii=False).encode()).hexdigest()
    return digest(tokens), digest(semantic)


def parse_rows(raw):
    return [json.loads(line) for line in str(raw).splitlines() if line.strip()]


def canonical(rows):
    """Ignore only block order and volatile meta.today; preserve multiplicity."""
    out, seen = [], set()
    for item in rows:
        row = dict(item)
        key = row['role'], row['id']
        assert key not in seen, ('duplicate role/id envelope', key)
        seen.add(key)
        if row['role'] in ('meta', 'part'):
            row['j'] = json.loads(row['j'])
            if row['role'] == 'meta':
                row['j'].pop('today', None)
        block_key, blocks = '', []
        for line in (row.get('mx') or '').split('\n'):
            if not line:
                continue
            fields = line.split('\t')
            if fields[0]:
                block_key = fields[0]
            blocks.append([block_key] + fields[1:])
        row['mx'] = sorted(blocks)  # a list, deliberately not a set
        out.append(row)
    return json.dumps(sorted(out, key=lambda r: (r['role'], r['id'])),
                      sort_keys=True, ensure_ascii=False)


def delivered(part, fixture=True):
    files = list(DELIVERY.glob('2.* ' + part + ' *.sql'))
    assert len(files) == 1, ('expected one delivered SQL file', part)
    source = files[0].read_text()
    anchor = '{% set FULL = [] %}'
    assert source.count(anchor) == 1, 'fixture FULL anchor changed'
    return source.replace(anchor, "{% set FULL = ['tester'] %}") if fixture else source


def without_description(source):
    # mk_split replaces only the leading documentation block. Keep every other
    # byte, including Jinja statements and internal comments, for this check.
    assert source.startswith('{#-')
    return source[source.index('-#}') + 3:]


def cases_for(units):
    root = units[0]['id']
    branch = next(u['id'] for u in units if u['lvl'] == 4)
    return [
        ('root', 'tester', {}, 'full'),
        ('leaves-and-head', 'tpstudy.combined', {}, 'full'),
        ('head-normalized-outside', '  TPSTUDY.HEAD.ONLY  ', {'unit_f': [root]}, 'restricted'),
        ('multiple-roots', 'tpstudy.multi', {}, 'multiple'),
        ('admin-as-branch', 'tester', {'as_f': ['  BRANCH.USER  '], 'unit_f': [root]}, 'restricted'),
        ('no-access', 'tester', {'as_f': ['nobody.at.all']}, 'denied'),
        ('nonadmin-as-ignored', 'branch.user', {'as_f': ['tester']}, 'restricted'),
        ('hq-it-staff', 'tester', {'unit_f': [branch], 'paint_f': ['Hq'],
                                 'it_f': ['IT'], 'staff_f': ['Штат']}, 'full'),
        ('line-all', 'tester', {'paint_f': ['Line'], 'act_f': ['Вся']}, 'full'),
        ('empty-selection', 'tester', {'paint_f': ['does-not-exist'],
                                      'act_f': ['does-not-exist']}, 'full'),
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', help='required unless --save-only')
    parser.add_argument('--lexenv', choices=['M1', 'M2'], required=True)
    parser.add_argument('--threads', type=int, default=1)
    parser.add_argument('--settings', default='1:1:0', help='primary analyzer:prefer_column_name_to_alias:join_use_nulls')
    parser.add_argument('--extra-settings', default='', help='comma-separated triples, checked on root and hq-it-staff')
    parser.add_argument('--changed-only', action='store_true', help='M2 bounded check: execute only delivered core/aux, compare their tokens/results to M1')
    parser.add_argument('--parts-only', action='store_true', help='legacy analyzer: compare changed ordinary/delivered parts and known M1 hashes; classify paired baseline errors')
    parser.add_argument('--save-only', action='store_true', help='bounded actual-file save lexer/SELECT/LIMIT check; no database query')
    parser.add_argument('--reference', type=Path, help='M1-results.json for exact cross-parser tokens/output comparison')
    parser.add_argument('--case', action='append', help='limit the primary case list explicitly')
    parser.add_argument('--artifacts', type=Path, default=Path('/tmp/teampulse-sql-parity'))
    args = parser.parse_args()
    assert not args.changed_only or args.reference, '--changed-only requires an M1 reference'
    assert not args.parts_only or args.reference, '--parts-only requires an M1 reference'
    assert args.threads > 0
    assert args.save_only or args.db, '--db is required for execution checks'

    import sqlparse
    import superset201 as kit
    import split_check as oracle
    from chdb import session

    expected_version = {'M1': '0.4.3', 'M2': '0.4.4'}[args.lexenv]
    assert sqlparse.__version__ == expected_version, ('wrong SQL parser environment', args.lexenv, sqlparse.__version__)
    kit.lexer_patch(True)
    references = json.loads(args.reference.read_text()) if args.reference else []
    sources = {p: delivered(p) for p in PARTS}
    golden = {p: oracle.text(p) for p in PARTS + ['all']}
    # The unchanged parts are still read from the delivered files, not replaced
    # with test-generated candidates. Exact equality permits reusing their
    # executed results when constructing the ordinary parts oracle below.
    for part in set(PARTS) - set(CHANGED):
        assert without_description(sources[part]) == without_description(golden[part]), ('unexpected change to unchanged part', part)
    for part in CHANGED:
        assert without_description(sources[part]) != without_description(golden[part]), ('optimized delivered part was not generated', part)

    if args.save_only:
        saved = []
        for part in CHANGED:
            rendered = kit.render(delivered(part, fixture=False), user='stand.user', save=True, columns=COLS)
            assert not rendered.error, rendered.error
            path = kit.save_path(rendered.text)
            assert not path['error'], path['error']
            assert path['statements'] == 1
            assert kit.ParsedQuery(path['executed']).limit == kit.SAVE_LIMIT == 1000
            raw, semantic = token_hashes(path['executed'], sqlparse)
            entry = {'part': part, 'sqlparse': sqlparse.__version__, 'statements': 1, 'limit': 1000,
                     'tokens_sha256': raw, 'semantic_tokens_sha256': semantic}
            if args.reference:
                reference = next(r for r in references if r['part'] == part)
                assert entry['semantic_tokens_sha256'] == reference['semantic_tokens_sha256'], ('save token mismatch', part)
            saved.append(entry)
        args.artifacts.mkdir(parents=True, exist_ok=True)
        (args.artifacts / (args.lexenv + '-save-results.json')).write_text(json.dumps(saved, indent=2))
        print('PASS', args.lexenv, 'actual core/aux save path: one SELECT, LIMIT 1000, lexer accepted',
              '+ M1 semantic tokens equal' if args.reference else '', flush=True)
        return

    s = session.Session(args.db)
    started = time.perf_counter()
    summaries, cache = [], {}
    args.artifacts.mkdir(parents=True, exist_ok=True)

    def query(sql):
        return parse_rows(s.query(sql, 'JSONEachRow'))

    def execute(source, user, filters):
        key = source, user, json.dumps(filters, sort_keys=True)
        if key not in cache:
            rendered = kit.render(source, user=user, filters=filters, columns=COLS)
            assert not rendered.error, rendered.error
            path = kit.chart_path(rendered.text, COLS)
            assert not path['error'], path['error']
            cache[key] = path['texts']['executed']
        result = query(cache[key])
        canonical(result)
        assert sum(r['role'] == 'end' for r in result) == 1, 'missing/multiple end marker'
        return result

    def equal(actual, expected, label):
        a, b = canonical(actual), canonical(expected)
        if a != b:
            (args.artifacts / (args.lexenv + '-mismatch.json')).write_text(json.dumps(
                {'check': label, 'actual': actual, 'ordinary': expected}, ensure_ascii=False))
            raise AssertionError((label, 'exact mismatch; details in local artifacts'))

    def token_hash(source, user, filters):
        key = source, user, json.dumps(filters, sort_keys=True)
        return token_hashes(cache[key], sqlparse)

    try:
        units = query('SELECT unit_rk AS id, unit_lvl AS lvl FROM prod_proteus.teampulse_hub_unit ORDER BY unit_lvl,unit_rk')
        cases = cases_for(units)
        if args.case:
            assert set(args.case) <= {c[0] for c in cases}, 'unknown case'
            cases = [c for c in cases if c[0] in args.case]
        configurations = [(args.settings, cases)]
        if args.extra_settings:
            extra_cases = [c for c in cases_for(units) if c[0] in ('root', 'hq-it-staff')]
            configurations += [(pair, extra_cases) for pair in args.extra_settings.split(',')]
        for settings, active_cases in configurations:
            analyzer, prefer, nulls = map(int, settings.split(':'))
            assert analyzer in (0, 1) and prefer in (0, 1) and nulls in (0, 1)
            s.query(f'SET allow_experimental_analyzer={analyzer},prefer_column_name_to_alias={prefer},'
                    f'join_use_nulls={nulls},max_threads={args.threads},max_memory_usage=4000000000')
            for name, user, filters, access in active_cases:
                t = time.perf_counter()
                if args.parts_only:
                    reference = next((r for r in references if r['case'] == name and r['settings'] == '1:1:0'), None)
                    assert reference, ('missing production reference', name)
                    outcomes, row_count = {}, 0
                    def attempt(source):
                        try:
                            return execute(source, user, filters), None
                        except RuntimeError as exc:
                            code = re.search(r'Code:\s*(\d+)\.', str(exc))
                            if not code:
                                raise
                            return None, int(code[1])
                    for part in CHANGED:
                        baseline, baseline_error = attempt(golden[part])
                        candidate, candidate_error = attempt(sources[part])
                        if baseline_error is not None:
                            assert candidate_error == baseline_error, (name, part, 'different error', baseline_error, candidate_error)
                            outcomes[part] = {'status': 'baseline_unsupported', 'clickhouse_code': baseline_error}
                        else:
                            assert candidate_error is None, (name, part, 'new candidate error', candidate_error)
                            equal(candidate, baseline, (settings, name, part))
                            digest = hashlib.sha256(canonical(candidate).encode()).hexdigest()
                            assert digest == reference['delivered_sha256'][part], (name, part, 'production reference mismatch')
                            row_count += len(candidate)
                            outcomes[part] = {'status': 'exact_numeric_match', 'sha256': digest}
                    entry = {'case': name, 'settings': settings, 'parts': outcomes, 'rows': row_count,
                             'numeric_parts': sum(v['status'] == 'exact_numeric_match' for v in outcomes.values()),
                             'merged_equal': False, 'seconds': time.perf_counter() - t}
                    summaries.append(entry)
                    (args.artifacts / (args.lexenv + '-results.json')).write_text(json.dumps(summaries, indent=2))
                    print('CHECK', args.lexenv, settings, name, json.dumps(outcomes), flush=True)
                    continue
                whole = execute(golden['all'], user, filters)
                checked = CHANGED if args.changed_only else PARTS
                actual = {p: execute(sources[p], user, filters) for p in checked}
                baseline_parts = dict(actual)
                for part in CHANGED:
                    baseline_parts[part] = execute(golden[part], user, filters)
                    equal(actual[part], baseline_parts[part], (settings, name, part))
                expected = [r for r in whole if r['role'] != 'end']
                if not args.changed_only:
                    equal(oracle.merge(baseline_parts), expected, (settings, name, 'ordinary parts vs all'))
                    equal(oracle.merge(actual), expected, (settings, name, 'delivered parts vs ordinary all'))
                echoes = []
                for part in checked:
                    pr = [r for r in actual[part] if r['role'] == 'part']
                    assert len(pr) == 1 and pr[0]['id'] == part
                    echoes.append(json.loads(pr[0]['j']))
                echo_keys = ['ok', 'scope', 'req', 'paint', 'it', 'staff', 'act', 'bt']
                assert echoes[0]['bt'], 'missing data build stamp'
                assert all({k: e[k] for k in echo_keys} == {k: echoes[0][k] for k in echo_keys} for e in echoes)
                meta = json.loads(next(r['j'] for r in whole if r['role'] == 'meta'))
                if access == 'full':
                    assert meta['ok'] == 1 and meta['full'] == 1, (name, 'fixture does not provide full access')
                elif access == 'denied':
                    assert meta['ok'] == 0, (name, 'fixture unexpectedly grants access')
                else:
                    assert meta['ok'] == 1 and meta['full'] == 0, (name, 'fixture lacks restricted access')
                    if access == 'multiple':
                        assert len(meta['zone']) >= 2, 'fixture lacks multiple roots'
                entry = {'case': name, 'settings': settings, 'rows': sum(len(r) for r in actual.values()),
                         'changed_parts_checked': len(CHANGED), 'merged_equal': not args.changed_only,
                         'seconds': time.perf_counter() - t,
                         'ordinary_sha256': hashlib.sha256(canonical(expected).encode()).hexdigest(),
                         'delivered_sha256': {p: hashlib.sha256(canonical(actual[p]).encode()).hexdigest() for p in CHANGED},
                         'tokens_sha256': {p: token_hash(sources[p], user, filters)[0] for p in CHANGED},
                         'semantic_tokens_sha256': {p: token_hash(sources[p], user, filters)[1] for p in CHANGED}}
                if args.reference:
                    reference = next((r for r in references if r['case'] == name and r['settings'] == settings), None)
                    assert reference, ('case missing in reference', settings, name)
                    for key in ['ordinary_sha256', 'delivered_sha256', 'semantic_tokens_sha256']:
                        assert entry[key] == reference[key], ('M1/M2 exact mismatch', settings, name, key)
                summaries.append(entry)
                (args.artifacts / (args.lexenv + '-results.json')).write_text(json.dumps(summaries, indent=2))
                print('PASS', args.lexenv, settings, name,
                      'core/aux tokens+output match M1' if args.changed_only else 'core/aux + all delivered parts merged', flush=True)
    finally:
        s.close()
    summary = {'lexenv': args.lexenv, 'sqlparse': sqlparse.__version__, 'threads': args.threads,
               'case_executions': len(summaries), 'changed_part_comparisons': sum(e.get('numeric_parts', len(CHANGED)) for e in summaries),
               'candidate_rows': sum(e['rows'] for e in summaries),
               'merged_vs_ordinary_all': sum(e['merged_equal'] for e in summaries),
               'cross_parser_compared': bool(args.reference) and not args.parts_only,
               'seconds': time.perf_counter() - started,
               'strict_equal': all(e.get('numeric_parts', len(CHANGED)) == len(CHANGED) for e in summaries)}
    (args.artifacts / (args.lexenv + '-summary.json')).write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary), flush=True)


if __name__ == '__main__':
    main()
