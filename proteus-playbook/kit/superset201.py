#!/usr/bin/env python3
"""Путь Superset 2.0.1 над SQL виртуального датасета — модуль и CLI.

Что делает Proteus (форк Superset 2.0.1) с текстом датасета до ClickHouse, по исходнику 2.0.1:
  superset/jinja_context.py    — рендер Jinja: SandboxedEnvironment(undefined=DebugUndefined), без расширений;
                                 current_username / current_user_id / cache_key_wrapper / url_param / filter_values /
                                 get_filters / where_in; ExtraCache.regex решает, рендерить ли ради ключа кэша;
  superset/sql_parse.py        — патч лексера sqlparse 0.3.0: ПЕРВЫМ правилом строковый литерал '(''|\\\\|\\|[^'])*'
                                 (в нём \\' кавычку НЕ экранирует); ParsedQuery, is_select, get_statements, LIMIT;
  superset/connectors/sqla/models.py
                               — get_rendered_sql: strip('\\t\\r\\n; ') → format(strip_comments=True) → split
                                 (больше одной — «multiple statements»); get_from_clause: ParsedQuery + «только чтение»;
                                 обёртка SELECT <Измерения> FROM (…) AS virtual_table GROUP BY <Измерения> LIMIT N;
                                 get_query_str_extended: format(reindent=True); get_df: parse_sql (ещё один разбор);
  superset/connectors/sqla/utils.py
                               — сохранение и «Синхронизировать столбцы»: рендер с AlwaysTrueObject (особенность форка),
                                 ParsedQuery без strip_comments, одна инструкция, текст + "\\nLIMIT 1000" исполняется.

Две модели лексера — гоняйте датасет в обеих (kit/setup.sh ставит оба venv):
  ~/.venvs/proteus-kit   — sqlparse 0.3.0 + патч 2.0.1 (исходник 2.0.1: «sqlparse==0.3.0  # PINNED!»);
  ~/.venvs/proteus-sp044 — sqlparse 0.4.4 + тот же литерал, поставленный как в Superset 2.1.3 / 3.0.
  Бой adoption (30.09) ведёт себя как 0.4.x: его pa_one на модели 0.3.0 падает Code 36 после reindent, а в бою
  работает (kit/RESULTS.md). Пока версия не снята в бою (пробы — kit/README.md), датасет должен пройти обе.

Запуск (venv из kit/setup.sh: sqlparse 0.3.0, jinja2 3.0.3, sqlglot 26.33.0, chdb 2.1.1):

    python kit/superset201.py dataset.sql --user a.user --filters '{"unit_f": ["u1"]}' --url-params '{}' \\
        --cols role,k,v,n,j --limit 50000 [--run --db stand/.db] [--hostile] [--json]

    --cols auto        имена колонок верхнего SELECT (sqlglot) или из прямого запуска (--run)
    --save-only        только путь сохранения (AlwaysTrue + LIMIT 1000)
    --no-groupby       обёртка без GROUP BY (сравнить; у react_sanbbox metrics=[] → GROUP BY есть)
    --run              исполнить на chdb: текст после пути vs прямой запуск отрендеренного текста
    --db PATH          каталог chdb со стендовыми таблицами (без него — пустая сессия в памяти)
    --settings 'a=1'   настройки ClickHouse для обоих запусков (можно несколько раз); --matrix — три набора
    --ch-sub 'A=>B'    замена регуляркой перед исполнением на стенде (chdb 2.1.1 без base64Encode:
                       --ch-sub 'base64Encode\\(=>(')
    --hostile          враждебный ввод: значения носителей и параметров адреса с хвостами из HOSTILE
    --dump DIR         записать тексты каждого шага (только в скратч!)
    --no-patch         лексер без патча Superset (сравнить, как видит текст «ванильный» sqlparse)
    --json             отчёт JSON в stdout

Код выхода: 0 — путь пройден, бюджеты и сверки в норме; 1 — ошибка пути, лексера, бюджета или сверки; 2 — вызов.
Модуль без зависимостей от проектов: импортируй render(), chart_path(), save_path(), lexer_problems(), analyze().
"""
import argparse
import json
import os
import re
import sys
import time
from functools import partial

try:
    import sqlparse
    from sqlparse.sql import IdentifierList
    from sqlparse.tokens import DDL, DML, Keyword, Punctuation
except ImportError:  # pragma: no cover
    sys.exit('нет sqlparse: запустите kit/setup.sh и берите python из его venv (sqlparse==0.3.0, как в Superset 2.0.1)')

try:
    import jinja2
    from jinja2 import DebugUndefined, TemplateError
    from jinja2.sandbox import SandboxedEnvironment
except ImportError:  # pragma: no cover
    sys.exit('нет jinja2: запустите kit/setup.sh (jinja2==3.0.3, как в Superset 2.0.1)')

# ─────────────────────────────── версии и бюджеты ───────────────────────────────
SQLPARSE_SUPERSET = '0.3.0'          # setup.py 2.0.1: "sqlparse==0.3.0",  # PINNED!
JINJA_SUPERSET = '3.0.3'             # requirements/base.txt 2.0.1
MAX_QUERY_SIZE = 262144              # ClickHouse 24.8 по умолчанию; считается по тексту ПОСЛЕ обёртки и reindent
TOKENS_MAX = 10000                   # sqlparse ≥ 0.5.4: MAX_GROUPING_TOKENS (запас на обновление Proteus)
DEPTH_MAX = 100                      # sqlparse ≥ 0.5.4: MAX_GROUPING_DEPTH
REINDENT_MAX_S = 1.0                 # ориентир: reindent обёртки на худшем рендере (вывод, бой ≈ 2× стенда)
KEY_MAX_S = 0.5                      # ориентир: разбор ради ключа (идёт на КАЖДОМ расчёте ключа)
SAVE_LIMIT = 1000                    # models/core.py apply_limit_to_sql(limit=1000) при сохранении
VIRTUAL_TABLE = 'virtual_table'

# Враждебный ввод: значения, которые ломают лексер sqlparse 0.3.0 + патч, если экран или литерал выбраны неверно.
HOSTILE = ["O'Brien; x", 'a]b', 'x -- y', 'x // y', '# x', 'a\\', 'a;b', 'Отдел «Альфа» — 1']
# Метка, по которой видно, дошло ли значение до SQL (экран меняет кавычку и слэш, метка — нет).
HOSTILE_MARK = {"O'Brien; x": ['Brien; x'], 'a]b': ['a]b'], 'x -- y': ['x -- y'], 'x // y': ['x // y'],
                '# x': ['# x'], 'a\\': ['a\\', 'repeat(char(92)'], 'a;b': ['a;b'], 'Отдел «Альфа» — 1': ['«Альфа»']}

# ExtraCache.regex: 2.0.0–4.0.2 (jinja_context.py 2.0.1) и 4.1+ (4.1.0 / 5.0.0) — дословно.
CACHE_RX_20 = re.compile(
    r"\{\{.*("
    r"current_user_id\(.*\)|"
    r"current_username\(.*\)|"
    r"cache_key_wrapper\(.*\)|"
    r"url_param\(.*\)"
    r").*\}\}"
)
CACHE_RX_41 = re.compile(
    r"(\{\{|\{%)[^{}]*?("
    r"current_user_id\([^()]*\)|"
    r"current_username\([^()]*\)|"
    r"current_user_email\([^()]*\)|"
    r"cache_key_wrapper\([^()]*\)|"
    r"url_param\([^()]*\)"
    r")"
    r"[^{}]*?(\}\}|\%\})"
)
JINJA_COMMENT = re.compile(r'\{#.*?#\}', re.S)

# ─────────────────────────────── патч лексера Superset ───────────────────────────────
_PATCH_RX = r"'(''|\\\\|\\|[^'])*'"
_patch_state = {'wanted': os.environ.get('SS201_NO_PATCH') != '1', 'status': None}


def lexer_patch(enabled=None):
    """Ставит патч superset/sql_parse.py 2.0.1 (один раз, до первого разбора). Возвращает статус строкой."""
    if enabled is not None:
        _patch_state['wanted'] = enabled
    if _patch_state['status'] is not None:
        return _patch_state['status']
    kw = sqlparse.keywords
    if not _patch_state['wanted']:
        _patch_state['status'] = 'выключен (--no-patch): лексер «ванильный» sqlparse %s' % sqlparse.__version__
    elif not hasattr(kw, 'FLAGS'):
        # 0.4.4+: keywords.FLAGS нет — патч 2.0.x не ставится (Superset 2.0.x на такой версии не импортируется).
        # Superset 2.1.3 / 3.0 на sqlparse 0.4.4 ставят тот же литерал иначе: insert(25) и Lexer.set_SQL_REGEX.
        lex_cls = getattr(sqlparse.lexer, 'Lexer', None)
        if lex_cls is not None and hasattr(lex_cls, 'get_default_instance'):
            rx = kw.SQL_REGEX
            if not any(isinstance(r, str) and r == _PATCH_RX for r, _ in rx[:40]):
                rx.insert(25, (_PATCH_RX, sqlparse.tokens.String.Single))
                lex_cls.get_default_instance().set_SQL_REGEX(rx)
            _patch_state['status'] = ('стоит как в Superset 2.1.3 / 3.0 (sqlparse %s: insert(25) через Lexer) — модель '
                                      '«в Proteus sqlparse 0.4.4», не 2.0.1' % sqlparse.__version__)
        else:
            _patch_state['status'] = ('не встал: sqlparse %s без keywords.FLAGS и Lexer.get_default_instance'
                                      % sqlparse.__version__)
    else:
        first = kw.SQL_REGEX[0][0]
        if getattr(getattr(first, '__self__', None), 'pattern', None) != _PATCH_RX:
            kw.SQL_REGEX.insert(0, (re.compile(_PATCH_RX, kw.FLAGS).match, sqlparse.tokens.String.Single))
        _patch_state['status'] = 'стоит (как superset/sql_parse.py 2.0.1)'
    return _patch_state['status']


def patched():
    return lexer_patch().startswith('стоит')


# ─────────────────────────────── Jinja как в 2.0.1 ───────────────────────────────
NONE_TYPE = type(None).__name__
ALLOWED_TYPES = (NONE_TYPE, 'bool', 'str', 'unicode', 'int', 'long', 'float', 'list', 'dict', 'tuple', 'set')
COLLECTION_TYPES = ('list', 'dict', 'tuple', 'set')


class SupersetTemplateException(Exception):
    pass


class AlwaysTrueObject:
    """Что отдаёт filter_values() форка при сохранении и синхронизации датасета: истинный объект, итерация пустая,
    ни длины, ни «+» (бой 23.09: «unsupported operand type(s) for +: 'AlwaysTrueObject' and 'list'»). В апстриме
    2.0.1 его нет — это поведение форка."""

    def __bool__(self):
        return True

    def __iter__(self):
        return iter(())

    def __str__(self):
        return ''

    def __repr__(self):
        return 'AlwaysTrueObject()'


def safe_proxy(func, *args, **kwargs):
    """jinja_context.safe_proxy: тип результата из белого списка, коллекции — через JSON (кортеж станет списком)."""
    rv = func(*args, **kwargs)
    if isinstance(rv, AlwaysTrueObject):      # форк пропускает свой объект мимо проверки типа
        return rv
    vt = type(rv).__name__
    if vt not in ALLOWED_TYPES:
        raise SupersetTemplateException('Unsafe return type for function %s: %s' % (func.__name__, vt))
    if vt in COLLECTION_TYPES:
        try:
            rv = json.loads(json.dumps(rv))
        except TypeError as ex:
            raise SupersetTemplateException('Unsupported return value for method %s' % func.__name__) from ex
    return rv


def where_in(values, mark="'"):
    """Фильтр where_in 2.0.1: кавычка удваивается, обратный слэш — НЕТ."""
    def quote(value):
        if isinstance(value, str):
            value = value.replace(mark, mark * 2)
            return f'{mark}{value}{mark}'
        return str(value)
    return '(%s)' % ', '.join(quote(v) for v in values)


def _norm_filters(filters):
    """{'col': ['a','b'] | 'a' | {'op': 'LIKE', 'val': 'x%'} | [{'op':..,'val':..}, …]} → {col: [{op, col, val}]}."""
    out = {}
    for col, spec in (filters or {}).items():
        items = spec if isinstance(spec, list) and spec and all(isinstance(x, dict) for x in spec) else [spec]
        lst = []
        for it in items:
            if isinstance(it, dict):
                op, val = (it.get('op') or 'IN').upper(), it.get('val')
            else:
                op, val = 'IN', it
            if op in ('IN', 'NOT IN') and not isinstance(val, list):
                val = [val]
            if val in (None, '', []):
                continue           # get_filters пропускает пустой comparator (and val)
            lst.append({'op': op, 'col': col, 'val': val})
        out[col] = lst
    return out


class ExtraCache:
    """jinja_context.ExtraCache 2.0.1 над «запросом чарта»: фильтры, параметры адреса, пользователь."""

    def __init__(self, user, user_id, filters, url_params, save, escape_quote=True):
        self.user, self.user_id = user, user_id
        self.filters = _norm_filters(filters)
        self.url_params = dict(url_params or {})
        self.save = save
        self.escape_quote = escape_quote
        self.extra_cache_keys = []
        self.applied_filters, self.removed_filters = [], []
        self.asked_filters, self.asked_params, self.calls = [], [], set()

    def current_user_id(self, add_to_cache_keys=True):
        self.calls.add('current_user_id')
        if self.user_id is None:
            return None
        if add_to_cache_keys:
            self.cache_key_wrapper(self.user_id)
        return self.user_id

    def current_username(self, add_to_cache_keys=True):
        self.calls.add('current_username')
        if not self.user:
            return None
        if add_to_cache_keys:
            self.cache_key_wrapper(self.user)
        return self.user

    def cache_key_wrapper(self, key):
        self.calls.add('cache_key_wrapper')
        self.extra_cache_keys.append(key)
        return key

    def url_param(self, param, default=None, add_to_cache_keys=True, escape_result=True):
        """2.0.1: из form_data.url_params (параметры адреса дашборда), при сохранении их нет. escape_result —
        литерал диалектом драйвера (SQLAlchemy 1.3 String: кавычка удваивается; модель — вывод, драйвер не снят)."""
        self.calls.add('url_param')
        if param not in self.asked_params:
            self.asked_params.append(param)
        result = default if self.save else self.url_params.get(param, default)
        if result and escape_result and self.escape_quote:
            result = str(result).replace("'", "''")
        if add_to_cache_keys:
            self.cache_key_wrapper(result)
        return result

    def get_filters(self, column, remove_filter=False):
        self.calls.add('get_filters')
        if column not in self.asked_filters:
            self.asked_filters.append(column)
        if self.save:
            return []
        lst = self.filters.get(column, [])
        if lst:
            if remove_filter and column not in self.removed_filters:
                self.removed_filters.append(column)
            if column not in self.applied_filters:
                self.applied_filters.append(column)
        return [dict(f) for f in lst]

    def filter_values(self, column, default=None, remove_filter=False):
        self.calls.add('filter_values')
        if self.save:
            if column not in self.asked_filters:
                self.asked_filters.append(column)
            return AlwaysTrueObject()
        rv = []
        for flt in self.get_filters(column, remove_filter):
            val = flt.get('val')
            if isinstance(val, list):
                rv.extend(val)
            elif val:
                rv.append(val)
        if not rv and default:
            rv = [default]
        return rv


def dataset_macro(*_a, **_k):
    raise SupersetTemplateException('dataset() в модели не поддержан: подставьте текст датасета сами')


class Rendered:
    """Итог рендера: текст, ключи кэша, какие носители и параметры шаблон спрашивал."""

    def __init__(self, text, cache, seconds, error=None):
        self.text, self.cache, self.seconds, self.error = text, cache, seconds, error

    @property
    def leftovers(self):
        """DebugUndefined печатает неизвестную переменную как {{ x }} — до ClickHouse ошибка не всплывёт."""
        return sorted(set(re.findall(r'\{\{.*?\}\}|\{%.*?%\}', self.text or '')))[:10]


def render(template, *, user='stand.user', user_id=1, filters=None, url_params=None, save=False, columns=None,
           row_limit=50000, table_columns=None, escape_quote=True):
    """Рендер как JinjaTemplateProcessor 2.0.1 (save=True — сохранение: filter_values → AlwaysTrueObject)."""
    cache = ExtraCache(user, user_id, filters, url_params, save, escape_quote)
    env = SandboxedEnvironment(undefined=DebugUndefined)
    env.filters['where_in'] = where_in
    flt_list = [f for lst in cache.filters.values() for f in lst] if not save else []
    # template_kwargs из SqlaTable.get_sqla_query 2.0.1 — доступны шаблону как переменные
    ctx = {
        'columns': list(columns or []), 'from_dttm': None, 'groupby': None, 'metrics': [],
        'row_limit': row_limit, 'row_offset': 0, 'time_column': None, 'time_grain': None, 'to_dttm': None,
        'table_columns': list(table_columns or columns or []), 'filter': flt_list,
        'url_param': partial(safe_proxy, cache.url_param),
        'current_user_id': partial(safe_proxy, cache.current_user_id),
        'current_username': partial(safe_proxy, cache.current_username),
        'cache_key_wrapper': partial(safe_proxy, cache.cache_key_wrapper),
        'filter_values': partial(safe_proxy, cache.filter_values),
        'get_filters': partial(safe_proxy, cache.get_filters),
        'dataset': partial(safe_proxy, dataset_macro),
    }
    for k in ('columns', 'table_columns', 'filter', 'metrics'):
        ctx[k] = json.loads(json.dumps(ctx[k]))
    t0 = time.perf_counter()
    try:
        text = env.from_string(template).render(ctx)
        err = None
    except TemplateError as ex:
        text, err = None, 'Error while rendering virtual dataset query: %s' % ex
    except (SupersetTemplateException, TypeError, ValueError, AttributeError, KeyError) as ex:
        text, err = None, 'Ошибка рендера (%s): %s' % (type(ex).__name__, ex)
    return Rendered(text, cache, time.perf_counter() - t0, err)


# ─────────────────────────────── ключ кэша ───────────────────────────────
def _line_of(text, m):
    a = text.rfind('\n', 0, m.start()) + 1
    b = text.find('\n', m.end())
    return text[a:b if b >= 0 else len(text)].strip()[:160]


def cache_key_report(raw_text, rendered=None, extra_texts=()):
    """Что Superset сделает с ключом кэша. Регулярка — по СЫРОМУ тексту датасета (+ предикат автозаполнения,
    WHERE/HAVING чарта, RLS — extra_texts), как has_extra_cache_key_calls 2.0.1. Вывод — по тексту без {# #}."""
    body = JINJA_COMMENT.sub('', raw_text)
    m_text = CACHE_RX_20.search(raw_text)
    m_extra = any(CACHE_RX_20.search(t) for t in extra_texts)
    m_raw = bool(m_text) or m_extra                     # так решает Superset: рендерить ли ради ключа
    m_body = bool(CACHE_RX_20.search(body)) or m_extra   # то же без комментариев {# #}
    m_41 = bool(CACHE_RX_41.search(body)) or any(CACHE_RX_41.search(t) for t in extra_texts)
    keys = list(rendered.cache.extra_cache_keys) if rendered is not None and rendered.cache else []
    calls = sorted(rendered.cache.calls & {'current_username', 'current_user_id', 'url_param', 'cache_key_wrapper'}) \
        if rendered is not None and rendered.cache else []
    rep = {'regex_2_0_raw': m_raw, 'regex_2_0_body': m_body, 'regex_4_1_body': m_41,
           'match_line': _line_of(raw_text, m_text) if m_text else None,
           'rendered_keys': [str(k)[:60] for k in keys], 'calls': calls, 'warnings': [], 'verdict': ''}
    if m_raw and not m_body:
        rep['warnings'].append('регулярка 2.0 находит вызов только в комментарии {# … #}: Superset будет рендерить и '
                               'разбирать датасет ради ключа на каждом запросе, но значение в ключ не попадёт')
    if m_raw:
        if keys:
            rep['verdict'] = 'ключ ЛИЧНЫЙ: в ключ кэша войдут %s — рендер и разбор на каждом расчёте ключа' % (
                ', '.join(repr(k) for k in rep['rendered_keys'][:4]))
        else:
            rep['verdict'] = ('ключ без значений: регулярка видит вызов, но при рендере он не сработал (комментарий '
                              'или неисполненная ветка) — Superset рендерит впустую на каждом расчёте ключа')
            rep['warnings'].append(rep['verdict'])
    else:
        if keys or set(calls) & {'current_username', 'current_user_id', 'url_param'}:
            rep['verdict'] = ('ОПАСНО: шаблон вызывает %s, но регулярка 2.0 вызова не видит (он в {%% set %%} или '
                              'на нескольких строках) — ответ одного пользователя уйдёт из кэша другому' % ', '.join(calls))
            rep['error'] = rep['verdict']
        else:
            rep['verdict'] = 'ключ ОБЩИЙ: вызовов нет — ключ без рендера, кэш один на всех'
    if m_41 and not m_body:
        rep['warnings'].append('регулярка 4.1+ видит вызов в {% %}, 2.0 — нет: после обновления Proteus (4.1+) Superset '
                               'начнёт рендерить датасет ради ключа на каждом запросе; в ключ войдёт то, что вызов '
                               'вернёт при рендере')
    return rep


# ─────────────────────────────── sqlparse: ParsedQuery 2.0.1 ───────────────────────────────
def _stripped(sql):
    return sql.strip(' \t\n;')


def _extract_limit(statement):
    """sql_parse._extract_limit_from_query: верхний LIMIT <число> (или LIMIT a, b)."""
    idx, _ = statement.token_next_by(m=(Keyword, 'LIMIT'))
    if idx is not None:
        _, token = statement.token_next(idx=idx)
        if token:
            if isinstance(token, IdentifierList):
                idx, _ = token.token_next_by(m=(Punctuation, ','))
                _, token = token.token_next(idx=idx)
            if token and token.ttype == sqlparse.tokens.Literal.Number.Integer:
                return int(token.value)
    return None


class ParsedQuery:
    """Подмножество superset/sql_parse.ParsedQuery 2.0.1, нужное пути датасета, сохранения и SQL Lab."""

    def __init__(self, sql, strip_comments=False):
        if strip_comments:
            sql = sqlparse.format(sql, strip_comments=True)
        self.sql = sql
        self._parsed = sqlparse.parse(_stripped(sql))
        self._limit = None
        for st in self._parsed:
            self._limit = _extract_limit(st)

    @property
    def limit(self):
        return self._limit

    def strip_comments(self):
        return sqlparse.format(_stripped(self.sql), strip_comments=True)

    def is_select(self):
        parsed = sqlparse.parse(self.strip_comments())
        if not parsed:
            return False
        if parsed[0].get_type() == 'SELECT':
            return True
        if parsed[0].get_type() != 'UNKNOWN':
            return False
        if any(t.ttype == DDL for t in parsed[0]) or any(t.ttype == DML and t.value != 'SELECT' for t in parsed[0]):
            return False
        if parsed[0][0].ttype == Keyword:
            return False
        return any(t.ttype == DML and t.value == 'SELECT' for t in parsed[0])

    def _starts(self, word):
        return sqlparse.format(_stripped(self.sql), strip_comments=True).upper().startswith(word)

    def is_explain(self):
        return self._starts('EXPLAIN')

    def is_show(self):
        return self._starts('SHOW')

    def is_unknown(self):
        return bool(self._parsed) and self._parsed[0].get_type() == 'UNKNOWN'

    def is_readonly(self):
        """BaseEngineSpec.is_readonly_query: select / explain / show."""
        return self.is_select() or self.is_explain() or self.is_show()

    def get_statements(self):
        out = []
        for st in self._parsed:
            if st:
                s = str(st).strip(' \n;\t')
                if s:
                    out.append(s)
        return out

    def set_or_update_query_limit(self, new_limit, force=False):
        """Без верхнего LIMIT — текст + "\\nLIMIT N"; иначе меньший из двух (force — всегда новый)."""
        if not self._limit:
            return f'{_stripped(self.sql)}\nLIMIT {new_limit}'
        statement = self._parsed[0]
        limit_pos = None
        for pos, item in enumerate(statement.tokens):
            if item.ttype in Keyword and item.value.lower() == 'limit':
                limit_pos = pos
                break
        _, limit = statement.token_next(idx=limit_pos)
        if limit.ttype == sqlparse.tokens.Literal.Number.Integer and (force or new_limit < int(limit.value)):
            limit.value = new_limit
        elif limit.is_group:
            limit.value = f'{next(limit.get_identifiers())}, {new_limit}'
        return ''.join(str(i.value) for i in statement.tokens)


# ─────────────────────────────── метрики текста ───────────────────────────────
def tokens(text):
    """Токены лексера sqlparse (пробелы — тоже токены): так считает MAX_GROUPING_TOKENS sqlparse ≥ 0.5.4."""
    lexer_patch()
    return sum(1 for _ in sqlparse.lexer.tokenize(text))


def paren_stats(text):
    """(число «(», наибольшая глубина) — по токенам лексера, то есть вне строк, как их видит sqlparse."""
    lexer_patch()
    n = depth = top = 0
    for tt, v in sqlparse.lexer.tokenize(text):
        if tt in Punctuation and v == '(':
            n += 1
            depth += 1
            top = max(top, depth)
        elif tt in Punctuation and v == ')':
            depth -= 1
    return n, top


def kb(text):
    return len((text or '').encode('utf-8')) / 1024


def _tm(steps, name, f, *a, **k):
    t0 = time.perf_counter()
    r = f(*a, **k)
    steps[name] = steps.get(name, 0.0) + time.perf_counter() - t0
    return r


# ─────────────────────────────── путь запроса чарта ───────────────────────────────
def _ident(c):
    return c if re.fullmatch(r'[a-z_][a-z0-9_]*', c) else '`%s`' % c.replace('`', '\\`')


def wrap(sql, cols, row_limit=50000, groupby=True, where=None):
    """Обёртка, как её компилирует SQLAlchemy 1.3 у react_sanbbox (metrics=[] → need_groupby → GROUP BY по всем
    «Измерениям»); where — фильтры по колонкам датасета (носитель, ставший колонкой: SP-14)."""
    sel = ', '.join('%s AS %s' % (_ident(c), _ident(c)) for c in cols)
    grp = ', '.join(_ident(c) for c in cols)
    w = ''
    if where:
        w = ' \nWHERE ' + ' AND '.join('%s IN %s' % (_ident(c), where_in([str(x) for x in v])) for c, v in where.items())
    g = (' GROUP BY %s' % grp) if groupby and cols else ''
    return 'SELECT %s \nFROM (%s) AS %s%s%s \n LIMIT %d' % (sel, sql, VIRTUAL_TABLE, w, g, row_limit)


def chart_path(rendered, cols, row_limit=50000, groupby=True, where=None):
    """Запрос чарта (POST chart/data) от отрендеренного текста до текста ClickHouse. → dict: steps (секунды),
    texts (dataset / wrapped / final / executed), error (сообщение Superset), notes."""
    lexer_patch()
    st, notes = {}, []
    res = {'steps': st, 'notes': notes, 'error': None, 'texts': {}}
    sql = _tm(st, 'strip', lambda s: s.strip('\t\r\n; '), rendered)
    sql = _tm(st, 'format(strip_comments)', sqlparse.format, sql, strip_comments=True)
    res['texts']['dataset'] = sql
    if not sql:
        res['error'] = 'Virtual dataset query cannot be empty'
        return res
    n = len(_tm(st, 'split', sqlparse.split, sql))
    res['statements'] = n
    if n > 1:
        res['error'] = 'Virtual dataset query cannot consist of multiple statements (sqlparse насчитал %d)' % n
        return res
    pq = _tm(st, 'ParsedQuery (parse)', ParsedQuery, sql)
    ok = _tm(st, 'is_select (format + parse)', lambda: pq.is_unknown() or pq.is_readonly())
    if not ok:
        res['error'] = 'Virtual dataset query must be read-only'
        return res
    wrapped = wrap(sql, cols, row_limit, groupby, where)
    res['texts']['wrapped'] = wrapped
    final = _tm(st, 'format(reindent) обёртки', sqlparse.format, wrapped, reindent=True)
    res['texts']['final'] = final
    stmts = _tm(st, 'parse_sql (get_df)', lambda s: [str(x).strip(' ;') for x in sqlparse.parse(s)], final)
    stmts = [s for s in stmts if s]
    if len(stmts) > 1:
        notes.append('get_df разобрал итог на %d инструкций и выполнит их подряд; данные — из последней' % len(stmts))
        res['error'] = 'после reindent sqlparse видит %d инструкций' % len(stmts)
    res['texts']['executed'] = stmts[-1] if stmts else ''
    key_steps = ('strip', 'format(strip_comments)', 'split', 'ParsedQuery (parse)', 'is_select (format + parse)')
    res['parse_for_key'] = sum(st.get(k, 0.0) for k in key_steps)
    res['query_cost'] = res['parse_for_key'] + st.get('format(reindent) обёртки', 0) + st.get('parse_sql (get_df)', 0)
    return res


def save_path(rendered_save, limit=SAVE_LIMIT):
    """Сохранение и «Синхронизировать столбцы» (connectors/sqla/utils.py get_virtual_table_metadata 2.0.1):
    ParsedQuery без strip_comments, «только SELECT», одна инструкция, LIMIT 1000 — и этот текст исполняется."""
    lexer_patch()
    res = {'error': None, 'executed': None}
    pq = ParsedQuery(rendered_save)
    if not pq.is_readonly():
        res['error'] = 'Only `SELECT` statements are allowed'
        return res
    stmts = pq.get_statements()
    res['statements'] = len(stmts)
    if len(stmts) > 1:
        res['error'] = 'Only single queries supported (sqlparse насчитал %d)' % len(stmts)
        return res
    if not stmts:
        res['error'] = 'Virtual dataset query cannot be empty'
        return res
    res['executed'] = ParsedQuery(stmts[0]).set_or_update_query_limit(limit)
    res['limit_note'] = ('верхний LIMIT датасета — %d: при сохранении станет min(%d, %d)' % (pq.limit, pq.limit, limit)
                         if pq.limit else None)
    return res


# ─────────────────────────────── лексер sqlparse против sqlglot ───────────────────────────────
def _sqlglot_tokens(text):
    from sqlglot.dialects.clickhouse import ClickHouse
    return ClickHouse().tokenize(text)


def lexer_problems(text):
    """Видят ли sqlparse (0.3.0 + патч) и ClickHouse (sqlglot) строки одинаково, и вырезал ли strip_comments только
    комментарии. → список проблем (пусто — норма). Без sqlglot — ['нет sqlglot'].
    Правила: каждая строка sqlglot — строка sqlparse с теми же границами или целиком внутри имени […] sqlparse
    (T-SQL: sqlparse читает […] одним именем до первой «]»); имя […] кончается на скобке массива; лишних строк нет."""
    lexer_patch()
    try:
        toks = _sqlglot_tokens(text)
    except ImportError:
        return ['нет sqlglot: сверка лексеров пропущена (kit/setup.sh ставит sqlglot==26.33.0)']
    except Exception as ex:  # noqa: BLE001 — sqlglot не токенизирует: ClickHouse вероятно тоже не примет
        return ['sqlglot не токенизирует текст: %s' % str(ex).splitlines()[0][:160]]
    a, br, pos = set(), [], 0
    for tt, v in sqlparse.lexer.tokenize(text):
        if tt in sqlparse.tokens.String.Single:
            a.add((pos, pos + len(v) - 1))
        elif tt in sqlparse.tokens.Name and v.startswith('['):
            br.append((pos, pos + len(v) - 1))
        pos += len(v)
    b = [(t.start, t.end) for t in toks if t.token_type.name in ('STRING', 'NATIONAL_STRING', 'RAW_STRING')]
    lb = {t.start for t in toks if t.token_type.name == 'L_BRACKET'}
    rb = {t.start for t in toks if t.token_type.name == 'R_BRACKET'}

    def where(at):
        return text[max(0, at - 50):at + 30].replace('\n', ' ')
    out = []
    for x, y in br:
        if x not in lb or y not in rb:
            out.append('sqlparse читает «[…]» именем до «]» не на скобке массива (строка или регулярка со «]» '
                       'внутри — пиши array(…)): …%s…' % where(y))
            break
    starts = sorted(br)
    import bisect
    for sp in b:
        if sp in a:
            continue
        i = bisect.bisect_right(starts, (sp[0], 10 ** 12)) - 1
        if i < 0 or not (starts[i][0] < sp[0] and sp[1] < starts[i][1]):
            out.append('строку ClickHouse sqlparse видит иначе (экран \\\' или «]»?): …%s…' % where(sp[0]))
            break
    extra = sorted(a - set(b))
    if extra:
        out.append('у sqlparse лишняя строка (код читается как строка): …%s…' % where(extra[0][0]))
    # strip_comments вырезал только комментарии: токены ClickHouse до и после одинаковы
    after = sqlparse.format(text.strip('\t\r\n; '), strip_comments=True)
    try:
        t2 = _sqlglot_tokens(after)
    except Exception as ex:  # noqa: BLE001
        out.append('после strip_comments текст испорчен: %s' % str(ex).splitlines()[0][:160])
        return out
    x1 = [(t.token_type.name, t.text) for t in toks]
    x2 = [(t.token_type.name, t.text) for t in t2]
    for x in (x1, x2):          # хвостовые «;» срезает и сам Superset (strip('\t\r\n; '))
        while x and x[-1][0] == 'SEMICOLON':
            x.pop()
    if x1 != x2:
        i = next((i for i, (p, q) in enumerate(zip(x1, x2)) if p != q), min(len(x1), len(x2)))
        out.append('strip_comments изменил не только комментарии: токен %d %r → %r' % (
            i + 1, x1[i][1][:50] if i < len(x1) else None, x2[i][1][:50] if i < len(x2) else None))
    return out


# ─────────────────────────────── chdb ───────────────────────────────
_session = {}


def chdb_session(db=None):
    """Одна сессия chdb на процесс (в chdb 2.x движок инициализируется один раз)."""
    if 's' not in _session:
        from chdb import session
        _session['s'] = session.Session(db) if db else session.Session()
        _session['db'] = db
    elif _session.get('db') != db:
        raise RuntimeError('chdb: в одном процессе — один каталог (%s)' % _session.get('db'))
    return _session['s']


def ch_version(db=None):
    try:
        return str(chdb_session(db).query('SELECT version()', 'CSV')).strip().strip('"')
    except Exception as ex:  # noqa: BLE001
        return 'chdb недоступен: %s' % ex


def ch_run(sql, db=None, settings='', subs=()):
    """→ (строки dict, секунды, ошибка). subs — [(regex, замена)] для стенда (функций нет в chdb)."""
    for a, b in subs:
        sql = re.sub(a, b, sql)
    q = sql + ('\nSETTINGS ' + settings if settings else '')
    t0 = time.perf_counter()
    try:
        r = chdb_session(db).query(q, 'JSONEachRow')
        data = r.bytes().decode('utf-8') if hasattr(r, 'bytes') else str(r)
        rows = [json.loads(x) for x in data.splitlines() if x.strip()]
        return rows, time.perf_counter() - t0, None
    except Exception as ex:  # noqa: BLE001
        return None, time.perf_counter() - t0, str(ex).strip().splitlines()[0][:300]


def compare_run(rendered_text, final_text, cols, row_limit, db, settings, subs):
    """Прямой запуск отрендеренного текста (как есть, с комментариями) против текста после пути Superset."""
    out = {'settings': settings}
    direct, td, ed = ch_run(rendered_text, db, settings, subs)
    via, tv, ev = ch_run(final_text, db, settings, subs)
    out.update(direct_s=td, via_s=tv, direct_error=ed, via_error=ev)
    if ed or ev:
        out['same'] = False if (ev and not ed) else None
        return out
    missing = [c for c in cols if direct and c not in direct[0]]
    if missing:
        out['same'] = False
        out['note'] = 'в ответе датасета нет колонок %s' % missing
        return out
    proj = [json.dumps([r.get(c) for c in cols], ensure_ascii=False, sort_keys=True) for r in direct]
    uniq = set(proj)
    got = [json.dumps([r.get(c) for c in cols], ensure_ascii=False, sort_keys=True) for r in via]
    out.update(direct_rows=len(direct), unique_rows=len(uniq), via_rows=len(via))
    if len(uniq) > row_limit:
        out['same'] = set(got) <= uniq and len(got) == row_limit
        out['note'] = 'ответ больше лимита строк (%d > %d): обёртка режет произвольные строки' % (len(uniq), row_limit)
    else:
        out['same'] = set(got) == uniq and len(got) == len(uniq)
    if out['same'] is False:
        # Ответ разный — сначала проверить, детерминирован ли сам датасет (groupArray без сортировки и т. п.)
        again, _, e2 = ch_run(rendered_text, db, settings, subs)
        if not e2:
            uniq2 = {json.dumps([r.get(c) for c in cols], ensure_ascii=False, sort_keys=True) for r in again}
            if uniq2 != uniq:
                out['same'] = None
                out['nondeterministic'] = True
                out['note'] = ('ответ датасета недетерминирован: два прямых запуска разные (порядок groupArray / '
                               'arrayStringConcat без сортировки) — сверка пути невозможна')
    if len(uniq) < len(direct):
        out['glued'] = len(direct) - len(uniq)
    return out


# ─────────────────────────────── анализ одного варианта ───────────────────────────────
def _hostile_variant(filters, url_params, asked_f, asked_p, h):
    f2 = {}
    for col in asked_f:
        vals = (filters or {}).get(col)
        if vals is None:
            f2[col] = [h]
        else:
            vals = vals if isinstance(vals, list) else [vals]
            f2[col] = [(str(v) + h) if not isinstance(v, dict) else v for v in vals] or [h]
    p2 = {}
    for p in asked_p:
        v = (url_params or {}).get(p)
        p2[p] = h if v in (None, '') else str(v) + h
    return f2, p2


def analyze_variant(name, template, opts, filters, url_params, save=False):
    """Один вариант рендера → отчёт dict (рендер, путь, метрики, бюджеты, лексер, исполнение)."""
    r = render(template, user=opts.get('user'), user_id=opts.get('user_id'), filters=filters, url_params=url_params,
               save=save, columns=opts.get('cols'), row_limit=opts.get('limit', 50000),
               escape_quote=not opts.get('no_escape_dialect'))
    v = {'name': name, 'save': save, 'errors': [], 'warnings': [], 'render_s': r.seconds,
         'asked_filters': list(r.cache.asked_filters), 'asked_params': list(r.cache.asked_params)}
    if r.error:
        v['errors'].append(r.error)
        return v, r
    if r.leftovers:
        v['errors'].append('после рендера остался Jinja-текст (DebugUndefined: неизвестная переменная): %s'
                           % ', '.join(r.leftovers[:4]))
    text = r.text
    v['kb_rendered'] = kb(text)
    if save:
        # Сохранение и синхронизация: обёртки и reindent нет — исполняется текст + LIMIT 1000 (save_path).
        t0 = time.perf_counter()
        sp = save_path(text)
        v['save_s'] = time.perf_counter() - t0
        v['save_path'] = {k: sp.get(k) for k in ('error', 'statements', 'limit_note')}
        if sp['error']:
            v['errors'].append('сохранение: ' + sp['error'])
        v['_save_text'] = sp.get('executed')
        v['tokens_dataset'] = tokens(text)
        lp = lexer_problems(text)
        if lp and lp[0].startswith('нет sqlglot'):
            v['warnings'].extend(lp)
        else:
            v['errors'].extend('лексер: ' + x for x in lp)
        return v, r
    cols = opts['cols']
    where = {c: (vals if isinstance(vals, list) else [vals]) for c, vals in (filters or {}).items()
             if c in cols and vals and not isinstance(vals, dict)}
    if where:
        v['warnings'].append('носители %s — колонки датасета: Superset навесит на обёртку WHERE … IN (SP-14)'
                             % ', '.join(sorted(where)))
    p = chart_path(text, cols, opts.get('limit', 50000), not opts.get('no_groupby'), where)
    v['steps'] = p['steps']
    v['notes'] = p['notes']
    v['statements'] = p.get('statements')
    if p['error']:
        v['errors'].append('путь Superset: ' + p['error'])
    ds = p['texts'].get('dataset') or ''
    fin = p['texts'].get('executed') or ''
    v['_texts'] = p['texts']
    v['kb_dataset'] = kb(ds)
    v['kb_wrapped'] = kb(p['texts'].get('wrapped'))
    v['kb_final'] = kb(fin)
    v['bytes_final'] = len(fin.encode('utf-8'))
    v['tokens_dataset'] = tokens(ds) if ds else 0
    v['tokens_final'] = tokens(fin) if fin else 0
    v['parens'], v['depth'] = paren_stats(ds) if ds else (0, 0)
    v['parens_raw'] = ds.count('(')     # по сырому тексту (со строками) — так считали стенды проектов
    v['parse_for_key_s'] = r.seconds + p.get('parse_for_key', 0.0)
    v['query_cost_s'] = r.seconds + p.get('query_cost', 0.0)
    v['reindent_s'] = p['steps'].get('format(reindent) обёртки', 0.0)
    # бюджеты
    b = []
    if fin:
        b.append(('max_query_size (после reindent)', v['bytes_final'], MAX_QUERY_SIZE, v['bytes_final'] <= MAX_QUERY_SIZE))
    if ds:
        b.append(('токены sqlparse (датасет)', v['tokens_dataset'], TOKENS_MAX, v['tokens_dataset'] < TOKENS_MAX))
        b.append(('глубина скобок', v['depth'], DEPTH_MAX, v['depth'] < DEPTH_MAX))
    v['budgets'] = [{'name': n, 'value': x, 'limit': lim, 'ok': ok} for n, x, lim, ok in b]
    for n, x, lim, ok in b:
        if not ok:
            v['errors'].append('бюджет: %s = %s ≥ %s' % (n, x, lim))
        elif n.startswith('max_query_size') and x > 0.9 * lim:
            v['warnings'].append('max_query_size: %.1f КиБ — меньше 10%% запаса до 256 КиБ' % (x / 1024))
    lim_re = opts.get('max_reindent_s', REINDENT_MAX_S)
    if v['reindent_s'] > lim_re:
        v['warnings'].append('reindent %.2f с > %.2f с (бой ≈ 2× стенда)' % (v['reindent_s'], lim_re))
    # лексер
    if text:
        lp = lexer_problems(text)
        if lp and lp[0].startswith('нет sqlglot'):
            v['warnings'].extend(lp)
        else:
            v['errors'].extend('лексер: ' + x for x in lp)
    return v, r


def analyze(path, opts):
    """Файл датасета → полный отчёт (варианты: сохранение, открытие, враждебный ввод)."""
    template = open(path, encoding='utf-8').read()
    rep = {'file': path, 'variants': [], 'errors': [], 'warnings': []}
    filters, url_params = opts.get('filters') or {}, opts.get('url_params') or {}
    # колонки «Измерений»
    if opts.get('cols') in (None, 'auto', ['auto']):
        r0 = render(template, user=opts.get('user'), user_id=opts.get('user_id'), filters=filters, url_params=url_params)
        cols = None
        if r0.text:
            try:
                import sqlglot
                ds0 = sqlparse.format(r0.text.strip('\t\r\n; '), strip_comments=True)
                ast = sqlglot.parse_one(ds0, read='clickhouse')
                cols = [c for c in ast.named_selects if c]
            except Exception:  # noqa: BLE001
                cols = None
            if not cols and opts.get('run'):
                rows, _, err = ch_run(r0.text, opts.get('db'), '', opts.get('subs', ()))
                cols = list(rows[0].keys()) if rows else None
        if not cols:
            rep['errors'].append('--cols auto: колонки верхнего SELECT не определить, задайте --cols явно')
            return rep
        opts = dict(opts, cols=cols)
    rep['cols'] = opts['cols']
    variants = []
    if not opts.get('open_only'):
        variants.append(('сохранение (AlwaysTrue)', filters, url_params, True))
    if not opts.get('save_only'):
        variants.append(('открытие' + (' с фильтрами' if filters or url_params else ''), filters, url_params, False))
    renders = {}
    for name, f, u, save in variants:
        v, r = analyze_variant(name, template, opts, f, u, save)
        rep['variants'].append(v)
        renders[name] = r
    open_r = next((renders[n] for n, _, _, s in variants if not s), None)
    rep['cache'] = cache_key_report(template, open_r, opts.get('extra_texts', ()))
    if rep['cache'].get('error'):
        rep['errors'].append(rep['cache']['error'])
    rep['warnings'].extend(rep['cache']['warnings'])
    if open_r is not None and open_r.cache:
        rep['asked_filters'] = open_r.cache.asked_filters
        rep['asked_params'] = open_r.cache.asked_params
        cost = next((v['parse_for_key_s'] for v in rep['variants'] if not v['save'] and 'parse_for_key_s' in v), 0.0)
        qc = next((v['query_cost_s'] for v in rep['variants'] if not v['save'] and 'query_cost_s' in v), 0.0)
        keyed = rep['cache']['regex_2_0_raw']
        rep['timing'] = {'keyed': keyed, 'key_s': cost if keyed else 0.0, 'query_s': qc,
                         'cold_s': (3 * cost if keyed else 0.0) + qc, 'warm_s': cost if keyed else 0.0}
        if keyed and cost > opts.get('max_key_s', KEY_MAX_S):
            rep['warnings'].append('разбор ради ключа %.2f с > %.2f с — он идёт на каждом заборе qc-… (SP-22)'
                                   % (cost, opts.get('max_key_s', KEY_MAX_S)))
    # враждебный ввод
    if opts.get('hostile') and open_r is not None and open_r.cache and not (
            open_r.cache.asked_filters or open_r.cache.asked_params):
        rep['warnings'].append('враждебный ввод неприменим: шаблон не читает ни носителей, ни параметров адреса')
    elif opts.get('hostile') and open_r is not None and open_r.cache:
        # ошибки, которые есть уже при открытии, у враждебных вариантов не повторяем — только новые
        base = {e.split('…')[0] for v in rep['variants'] if not v['save'] for e in v['errors']}
        for h in HOSTILE:
            f2, p2 = _hostile_variant(filters, url_params, open_r.cache.asked_filters, open_r.cache.asked_params, h)
            v, r = analyze_variant('враждебный %r' % h, template, opts, f2, p2, False)
            v['hostile'] = h
            same = [e for e in v['errors'] if e.split('…')[0] in base]
            v['errors'] = [e for e in v['errors'] if e.split('…')[0] not in base]
            if same:
                v.setdefault('notes', []).append('и %d ошибок, как при открытии' % len(same))
            v['reached_sql'] = bool(r.text and any(m in r.text for m in HOSTILE_MARK[h]))
            if not v['reached_sql'] and not v['errors']:
                v['warnings'].append('значение до SQL не дошло: шаблон его отбросил (пределы / белые списки)')
            rep['variants'].append(v)
            renders[v['name']] = r
    # исполнение на chdb
    if opts.get('run'):
        sets = opts.get('settings') or ['']
        for v in rep['variants']:
            r = renders.get(v['name'])
            if r is None or not r.text:
                continue
            v['runs'] = []
            if v['save'] and v.get('_save_text'):
                rows, t, err = ch_run(v['_save_text'], opts.get('db'), sets[0], opts.get('subs', ()))
                v['save_run'] = {'s': t, 'error': err, 'rows': None if rows is None else len(rows)}
                if err:
                    v['errors'].append('сохранение в ClickHouse: ' + err)
            fin = v.get('_texts', {}).get('executed')
            if not fin:
                continue
            for s in sets:
                c = compare_run(r.text, fin, opts['cols'], opts.get('limit', 50000), opts.get('db'), s,
                                opts.get('subs', ()))
                v['runs'].append(c)
                tag = ' [%s]' % s if s else ''
                if c.get('via_error') and not c.get('direct_error'):
                    v['errors'].append('ClickHouse на тексте после пути%s: %s' % (tag, c['via_error']))
                elif c.get('direct_error') and c.get('via_error'):
                    (v['warnings'] if v.get('hostile') else v['errors']).append(
                        'ClickHouse%s: %s' % (tag, c['via_error']))
                elif c.get('same') is False:
                    v['errors'].append('ответ после пути ДРУГОЙ%s (%s)' % (tag, c.get('note', 'строки разные')))
                elif c.get('nondeterministic'):
                    v['warnings'].append(c['note'] + tag)
                if c.get('glued'):
                    v['warnings'].append('GROUP BY обёртки склеит %d одинаковых строк ответа (SP-13)' % c['glued'])
    for v in rep['variants']:
        rep['errors'].extend('%s: %s' % (v['name'], e) for e in v['errors'])
        rep['warnings'].extend('%s: %s' % (v['name'], w) for w in v['warnings'])
    return rep


# ─────────────────────────────── печать ───────────────────────────────
def versions(db=None, with_ch=False):
    out = {'python': sys.version.split()[0], 'sqlparse': sqlparse.__version__, 'patch': lexer_patch(),
           'jinja2': jinja2.__version__}
    try:
        import sqlglot
        out['sqlglot'] = sqlglot.__version__
    except ImportError:
        out['sqlglot'] = 'нет'
    if with_ch:
        out['clickhouse'] = ch_version(db)
    return out


def print_report(rep, ver):
    print('=' * 100)
    print('%s' % rep['file'])
    print('sqlparse %s (патч: %s) · jinja2 %s · sqlglot %s%s' % (
        ver['sqlparse'], ver['patch'], ver['jinja2'], ver['sqlglot'],
        (' · ClickHouse %s' % ver['clickhouse']) if 'clickhouse' in ver else ''))
    if ver['sqlparse'] != SQLPARSE_SUPERSET:
        if ver['patch'].startswith('стоит как в Superset 2.1.3'):
            print('  · вторая модель лексера (sqlparse %s, патч 2.1.3/3.0): бой adoption ведёт себя так; '
                  'датасет должен пройти и её, и 0.3.0' % ver['sqlparse'])
        else:
            print('  ! sqlparse не %s и без патча Superset: это не модель Proteus' % SQLPARSE_SUPERSET)
    if ver['jinja2'] != JINJA_SUPERSET:
        print('  ! jinja2 %s, в Superset 2.0.1 — %s' % (ver['jinja2'], JINJA_SUPERSET))
    if 'cols' in rep:
        print('Измерения: %s' % ', '.join(rep['cols']))
    c = rep.get('cache')
    if c:
        print('Ключ кэша: %s' % c['verdict'])
        print('  регулярка 2.0–4.0: %s (без {# #}: %s) · 4.1+: %s%s' % (
            'да' if c['regex_2_0_raw'] else 'нет', 'да' if c['regex_2_0_body'] else 'нет',
            'да' if c['regex_4_1_body'] else 'нет', ('  ← ' + c['match_line']) if c.get('match_line') else ''))
    if rep.get('asked_filters') or rep.get('asked_params'):
        print('Шаблон спрашивает: filter_values %s; url_param %s' % (
            ', '.join(rep.get('asked_filters') or []) or '—', ', '.join(rep.get('asked_params') or []) or '—'))
    for v in rep['variants']:
        flag = 'ОШИБКА' if v['errors'] else 'ок'
        if 'hostile' in v:
            # враждебный ввод — одной строкой, подробности только у провала
            if v['hostile'] == HOSTILE[0]:
                print('-' * 100)
                print('Враждебный ввод: каждое значение носителя и параметра адреса + хвост (или сам хвост):')
            runs = v.get('runs', [])
            r = ('; ClickHouse: ' + ('ответ тот же' if all(x.get('same') for x in runs) else
                                     'недетерминирован' if any(x.get('nondeterministic') for x in runs) else
                                     'см. ниже')) if runs else ''
            print('[%s] %-34s дошло до SQL: %s; инструкций %s%s%s' % (
                flag, v['name'], 'да' if v.get('reached_sql') else 'нет', v.get('statements', '?'), r,
                ''.join('; ' + n for n in v.get('notes', []) if n.startswith('и '))))
            for e in v['errors']:
                print('    ✗ ' + e)
            continue
        print('-' * 100)
        print('[%s] %s' % (flag, v['name']))
        if v['save'] and 'kb_rendered' in v:
            print('  текст: рендер %.1f КБ, токенов sqlparse %d; Jinja %.3f с, разбор при сохранении %.3f с' % (
                v['kb_rendered'], v.get('tokens_dataset', 0), v['render_s'], v.get('save_s', 0.0)))
        if 'kb_dataset' in v:
            print('  текст: рендер %.1f КБ → датасет %.1f КБ → обёртка %.1f КБ → после reindent %.1f КБ' % (
                v['kb_rendered'], v['kb_dataset'], v['kb_wrapped'], v['kb_final']))
            print('  токенов sqlparse %d (итог %d), «(» %d по тексту / %d по лексеру sqlparse, глубина %d' % (
                v['tokens_dataset'], v['tokens_final'], v['parens_raw'], v['parens'], v['depth']))
            print('  шаги: Jinja %.3f с; %s' % (v['render_s'], '; '.join('%s %.3f с' % kv for kv in v['steps'].items())))
            print('  разбор ради ключа %.3f с · запрос целиком %.3f с' % (v['parse_for_key_s'], v['query_cost_s']))
        if v.get('save_path'):
            sp = v['save_path']
            print('  сохранение: %s%s' % (
                sp['error'] or 'одна инструкция, исполнится с LIMIT %d' % SAVE_LIMIT,
                ('; ' + sp['limit_note']) if sp.get('limit_note') else ''))
        if v.get('save_run'):
            sr = v['save_run']
            print('  сохранение в ClickHouse: %s' % (sr['error'] or '%d строк, %.2f с' % (sr['rows'], sr['s'])))
        for run in v.get('runs', []):
            tag = ('[%s] ' % run['settings']) if run['settings'] else ''
            if run.get('via_error') or run.get('direct_error'):
                print('  ClickHouse %sпрямо: %s; после пути: %s' % (
                    tag, run.get('direct_error') or 'ок', run.get('via_error') or 'ок'))
            else:
                print('  ClickHouse %sпрямо %d строк (%d уникальных) %.2f с · после пути %d строк %.2f с — %s' % (
                    tag, run['direct_rows'], run['unique_rows'], run['direct_s'], run['via_rows'], run['via_s'],
                    'ответ тот же' if run['same'] else ('НЕ СРАВНИТЬ: ответ недетерминирован' if run.get(
                        'nondeterministic') else 'ОТВЕТ ДРУГОЙ')))
        if 'reached_sql' in v:
            print('  значение дошло до SQL: %s' % ('да' if v['reached_sql'] else 'нет (отброшено шаблоном)'))
        for e in v['errors']:
            print('  ✗ ' + e)
        for w in v['warnings']:
            print('  ! ' + w)
        for n in v.get('notes', []):
            print('  · ' + n)
    t = rep.get('timing')
    if t:
        print('-' * 100)
        if t['keyed']:
            print('Цена в Superset: холодное открытие ≈ %.2f с разбора (POST + воркер: ключ и запрос + забор qc-…), '
                  'из кэша ≈ %.2f с на каждом POST' % (t['cold_s'], t['warm_s']))
        else:
            print('Цена в Superset: холодное открытие ≈ %.2f с разбора, из кэша — без рендера' % t['cold_s'])
    for e in rep['errors'] if not rep['variants'] else []:
        print('✗ ' + e)
    print('ИТОГ: %s (ошибок %d, предупреждений %d)' % ('провал' if rep['errors'] else 'ок', len(rep['errors']),
                                                       len(rep['warnings'])))


def _json_arg(s):
    if not s:
        return {}
    if s.startswith('@'):
        return json.load(open(s[1:], encoding='utf-8'))
    return json.loads(s)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0], formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog=__doc__.split('\n\n', 1)[1])
    ap.add_argument('dataset', nargs='+', help='файл(ы) SQL датасета (шаблон Jinja)')
    ap.add_argument('--user', default='stand.user', help='логин (current_username)')
    ap.add_argument('--user-id', type=int, default=1, help='current_user_id')
    ap.add_argument('--filters', default='', help="JSON {носитель: [значения]} или @файл.json")
    ap.add_argument('--url-params', default='', help='JSON {параметр адреса: значение} или @файл.json')
    ap.add_argument('--cols', default='auto', help='«Измерения» через запятую или auto')
    ap.add_argument('--limit', type=int, default=50000, help='лимит строк чарта (row_limit)')
    ap.add_argument('--no-groupby', action='store_true', help='обёртка без GROUP BY')
    ap.add_argument('--save-only', action='store_true', help='только путь сохранения')
    ap.add_argument('--open-only', action='store_true', help='без варианта сохранения')
    ap.add_argument('--hostile', action='store_true', help='варианты с враждебными значениями')
    ap.add_argument('--run', action='store_true', help='исполнить на chdb и сверить с прямым запуском')
    ap.add_argument('--db', default=None, help='каталог chdb стенда')
    ap.add_argument('--settings', action='append', default=None, help="настройки ClickHouse ('a = 1, b = 0')")
    ap.add_argument('--matrix', action='store_true', help='три набора настроек: новый, старый анализатор, *_use_nulls')
    ap.add_argument('--ch-sub', action='append', default=[], help="'регулярка=>замена' перед исполнением на стенде")
    ap.add_argument('--extra-text', action='append', default=[],
                    help='ещё текст для регулярки ключа: предикат автозаполнения, WHERE/HAVING чарта, RLS')
    ap.add_argument('--no-escape-dialect', action='store_true', help='url_param(escape_result=True) не экранирует')
    ap.add_argument('--no-patch', action='store_true', help='лексер без патча Superset')
    ap.add_argument('--max-reindent-s', type=float, default=REINDENT_MAX_S)
    ap.add_argument('--max-key-s', type=float, default=KEY_MAX_S)
    ap.add_argument('--dump', default=None, help='каталог для текстов шагов (только скратч)')
    ap.add_argument('--json', action='store_true', help='отчёт JSON')
    a = ap.parse_args(argv)
    lexer_patch(not a.no_patch)
    try:
        filters, url_params = _json_arg(a.filters), _json_arg(a.url_params)
    except (ValueError, OSError) as ex:
        print('--filters / --url-params: %s' % ex, file=sys.stderr)
        return 2
    settings = a.settings or ['']
    if a.matrix:
        settings = ['allow_experimental_analyzer = 1', 'allow_experimental_analyzer = 0',
                    'allow_experimental_analyzer = 1, join_use_nulls = 1, prefer_column_name_to_alias = 1, '
                    'group_by_use_nulls = 1']
    subs = []
    for s in a.ch_sub:
        if '=>' not in s:
            print('--ch-sub: нужно «регулярка=>замена»', file=sys.stderr)
            return 2
        x, y = s.split('=>', 1)
        subs.append((x, y))
    opts = {'user': a.user, 'user_id': a.user_id, 'filters': filters, 'url_params': url_params,
            'cols': 'auto' if a.cols == 'auto' else [c.strip() for c in a.cols.split(',') if c.strip()],
            'limit': a.limit, 'no_groupby': a.no_groupby, 'save_only': a.save_only, 'open_only': a.open_only,
            'hostile': a.hostile, 'run': a.run, 'db': a.db, 'settings': settings, 'subs': subs,
            'extra_texts': a.extra_text, 'no_escape_dialect': a.no_escape_dialect,
            'max_reindent_s': a.max_reindent_s, 'max_key_s': a.max_key_s}
    ver = versions(a.db, a.run)
    bad = 0
    reports = []
    for path in a.dataset:
        rep = analyze(path, opts)
        reports.append(rep)
        bad += bool(rep['errors'])
        if a.dump:
            base = os.path.join(a.dump, re.sub(r'[^\w.-]+', '_', os.path.basename(path)))
            os.makedirs(a.dump, exist_ok=True)
            for i, v in enumerate(rep['variants']):
                for k, t in (v.get('_texts') or {}).items():
                    if t:
                        open('%s.%d.%s.sql' % (base, i, k), 'w', encoding='utf-8').write(t)
        if not a.json:
            print_report(rep, ver)
    if a.json:
        for rep in reports:
            for v in rep['variants']:
                v.pop('_texts', None)
                v.pop('_save_text', None)
        print(json.dumps({'versions': ver, 'reports': reports}, ensure_ascii=False, indent=1, default=str))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
