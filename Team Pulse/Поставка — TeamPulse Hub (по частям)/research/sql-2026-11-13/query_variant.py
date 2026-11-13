"""Study-only: fuse the three mm series scans; shipped SQL is never modified.

Each M slot belongs to exactly one of s/g/h. The original selected, HQ-growth,
and HQ-active predicates remain separate sumIf conditions. A union of those
predicates is only a read filter; it never becomes a metric's own predicate.
Other tables, the independent mh/HQ result, date windows and zero-grid stay as-is.
"""
import re


def _once(source, old, new):
    if source.count(old) != 1:
        raise ValueError('Expected unique SQL anchor: ' + old[:100])
    return source.replace(old, new)


def transform(template):
    start = template.index('  mm AS (')
    end = template.index('  arr AS (', start)
    mm = template[start:end]
    for role, condition in [('g', 'cond_rh()'), ('h', 'cond_hq()')]:
        branch = ("      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('" + role + "') }} AS a2\n"
                  "      FROM prod_proteus.teampulse_hub_series\n"
                  "      WHERE node_rk IN {{ PK }} AND {{ GRID }} AND {{ " + condition + " }}\n"
                  "      GROUP BY u2, i2")
        if mm.count(branch) != 1:
            raise ValueError('Missing unique mm ' + role + ' branch')
        at = mm.index(branch)
        union = mm.rfind('      UNION ALL\n', 0, at)
        if union < 0 or re.sub(r'{#.*?#}', '', mm[union + len('      UNION ALL\n'):at], flags=re.S).strip():
            raise ValueError('Unexpected content before mm ' + role + ' branch')
        mm = mm[:union] + mm[at + len(branch):]
    first = ("      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('s') }} AS a2\n"
             "      FROM prod_proteus.teampulse_hub_series\n"
             "      WHERE node_rk IN {{ PK }} AND {{ GRID }} AND {{ cond() }}\n"
             "      GROUP BY u2, i2")
    fused = ("      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec_mm_series() }} AS a2\n"
             "      FROM\n"
             "      (\n"
             "        SELECT *, {{ cond() }} AS tp_mm_selected, {{ cond_rh() }} AS tp_mm_growth, {{ cond_hq() }} AS tp_mm_hq\n"
             "        FROM prod_proteus.teampulse_hub_series\n"
             "        WHERE node_rk IN {{ PK }} AND {{ GRID }}\n"
             "          AND (({{ cond() }}) OR ({{ cond_rh() }}) OR ({{ cond_hq() }}))\n"
             "      )\n"
             "      GROUP BY u2, i2")
    mm = _once(mm, first, fused)
    macro = """{#- Study-only: disjoint M slots, original independent predicates. #}
{% macro vec_mm_series() -%}
{%- set conditions = {'s': 'tp_mm_selected', 'g': 'tp_mm_growth', 'h': 'tp_mm_hq'} -%}
{%- set xs = [] -%}
{%- for m in M -%}
{%- if m[1] in conditions -%}
{%- set _ = xs.append('sumIf(toFloat64(' ~ m[2] ~ '), ' ~ conditions[m[1]] ~ ')') -%}
{%- else -%}{%- set _ = xs.append('0') -%}{%- endif -%}
{%- endfor -%}
arrayMap(x -> ifNull(x, 0), [{{ xs|join(', ') }}])
{%- endmacro %}
"""
    return template[:start] + macro + mm + template[end:]


def transform_peer(template):
    """Study-only: discard precisely the existing plin node set before grouping.

    The final peer filters remain in place. Population thresholds, month/week
    definitions, selected filters and independent AI/vacancy semantics are intact.
    In particular pai's max(week) is still selected globally before node exclusion.
    """
    source = template
    plin_at = source.index('  plin AS (')
    peer_at = source.index('  peer AS (', plin_at)
    plin = source[plin_at:peer_at]
    if plin.count(' AS (') != 1 or not plin.rstrip().endswith('),'):
        raise ValueError('Unexpected plin definition')
    source = source[:plin_at] + source[peer_at:]
    source = _once(source, '  pnv AS (', plin + '  pnv AS (')
    predicate = "ifNull(node_rk, '') NOT IN (SELECT xu FROM plin)"

    at = source.index('  pnv AS (')
    end = source.index('  pvt AS (', at)
    pnv = source[at:end]
    pnv = _once(pnv,
                'WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND {{ cond() }}',
                'WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND {{ cond() }} AND ' + predicate)
    source = source[:at] + pnv + source[end:]

    at = source.index('  pvt AS (')
    end = source.index('  pai AS (', at)
    pvt = source[at:end]
    old = 'WHERE [report_month BETWEEN toStartOfYear(mc) AND mc AND ttf_d IS NOT NULL AND ifNull(vac_ttf_cnt, 0) > 0][1]'
    pvt = _once(pvt, old, old + ' AND ' + predicate)
    source = source[:at] + pvt + source[end:]

    at = source.index('  pai AS (')
    end = source.index('  peer AS (', at)
    pai = source[at:end]
    pai = _once(pai, '\n    GROUP BY pu', '\n      AND ' + predicate + '\n    GROUP BY pu')
    return source[:at] + pai + source[end:]
