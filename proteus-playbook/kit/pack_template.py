#!/usr/bin/env python3
"""Шаблон сборщика папки поставки. Скопируй в stand/pack.py проекта, заполни блок НАСТРОЙКИ и COPIES.

    python3 stand/pack.py            # собрать: пишет только изменившиеся файлы, печатает «файл → менялся ли»
    python3 stand/pack.py --check    # сверить папку с исходниками, ничего не писать (код 1 — разошлись)
    python3 stand/pack.py --gate     # после сборки прогнать kit/sqlgate.py по SQL поставки

Правила (playbook, 14-delivery.md):
  * исходники — источник правды; в папке поставки ничего не правят руками (кроме «0. Инструкция.md» и
    файлов вида 'raw', которые сюда кладёт человек);
  * номер файла закреплён за объектом Proteus навсегда: «замени из файла N целиком»;
  * один исходник на варианты: вариант — подстановка ровно одной строки (one_line падает, если строк не одна);
  * JS чарта — сжатая сборка terser 5.51.2 (kit/min.cjs): код чарта едет в каждом POST chart/data;
  * id чартов борда — из BOARD_IDS вместо уникальных числовых заглушек (000000, 111111…), заглушек не остаётся;
  * штамп «отчёт · поставка N · дата · sha12 исходника» — в шапке каждого файла (у JSON шапки нет: формат);
    дата — константа DATE, а не «сегодня», иначе --check расходится на следующий день;
  * SQL Lab-файлы: ни одного «system» и SHOW (SQL Lab Proteus: «Использование "system" запрещено») — сборка падает.
Нужны node и terser@5.51.2 глобально (kit/setup.sh); без них сборка JS падает, а не пропускается.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

# ─────────────────────────────── НАСТРОЙКИ (заполнить) ───────────────────────────────
REPORT = 'Отчёт'                       # имя отчёта: в шапках и в имени папки
DELIVERY = '1'                         # номер поставки — поднимай при выпуске
DATE = '2026-10-08'                    # дата поставки — руками (штамп не зависит от дня сборки)
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))   # корень репозитория
OUT = os.path.join(ROOT, 'Поставка — %s' % REPORT)
KIT = os.environ.get('PLAYBOOK_KIT') or os.path.join(ROOT, 'kit')                         # где kit/min.cjs, sqlgate.py
KIT_PY = os.environ.get('PLAYBOOK_PY') or os.path.expanduser('~/.venvs/proteus-kit/bin/python')  # venv из kit/setup.sh
SEND_KBPS = 50                         # отправка у владельца ≈ 50 КБ/с (DevTools 07.10): код чарта — в каждом POST
JS_BUDGET_KB = 150                     # сжатая сборка больше — сборка падает (≈ 3 с на каждый запрос данных)
BUILD_CMD = 'python3 stand/pack.py'

# id чартов на борде: заглушка исходника → id (None — ещё не прислан: заглушка остаётся, шапка просит Ctrl+H)
BOARD_IDS = {
    '000000': None,                    # чарт «Отчёт»
}

# (исходник от ROOT, файл поставки, вид, подстановки [(строка исходника, замена)][, флаги kit/min.cjs])
# вид: dataset — SQL датасета; sqllab — SQL для SQL Lab; js — код чарта (сжатие); css — CSS борда (id чартов);
#      snippet — сниппет DevTools (id чартов, без сжатия); json — JSON-метаданные (проверка формата, без шапки);
#      py — параграф/ноутбук Python (шапка #); raw — байт в байт.
COPIES = [
    ('proteus/report.data.sql', '1. Датасет «Отчёт».sql', 'dataset', []),
    ('proteus/report.chart.js', '2. Чарт «Отчёт».js', 'js', []),
    ('proteus/report.board.css', '3. CSS борда.css', 'css', []),
    ('proteus/report.sqllab.sql', '4. SQL Lab — проверка на бою.sql', 'sqllab', []),
    ('proteus/report.board-check.js', '5. Проверка на бою — разметка борда (DevTools).js', 'snippet', []),
]
# ───────────────────────────────────────────────────────────────────────────────────────


def sha12(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]


def stamp(src, text):
    """Одна строка штампа: что, откуда, где править."""
    return ('%s · поставка %s · %s · %s %s · СОБРАН АВТОМАТИЧЕСКИ: не правьте здесь — исходник %s, сборка — %s'
            % (REPORT, DELIVERY, DATE, os.path.basename(src), sha12(text), src, BUILD_CMD))


def one_line(text, old, new, where=''):
    """Подстановка варианта: строка должна встречаться в исходнике ровно один раз."""
    n = text.count(old)
    if n != 1:
        sys.exit('%s: строка должна встречаться ровно один раз (найдено %d): %r' % (where, n, old.strip()[:80]))
    return text.replace(old, new)


def board_ids(text, where, mode):
    """Заглушки id → id чартов борда. css: в «chart-id-<заглушка>» (и #chart-id-, и .dashboard-chart-id-);
    snippet: заглушка целым словом. Заглушки должны быть, и ни одна подставленная не должна остаться."""
    todo = []
    for ph, real in BOARD_IDS.items():
        if mode == 'css':
            pat = re.compile(r'(?<=chart-id-)%s(?![0-9])' % re.escape(ph))
        else:
            pat = re.compile(r'(?<![0-9A-Za-z_])%s(?![0-9A-Za-z_])' % re.escape(ph))
        n = len(pat.findall(text))
        if n == 0 and text.count(ph):
            sys.exit('%s: заглушка %s есть, но не в месте id чарта — выберите уникальную заглушку (DV-21)' % (where, ph))
        if not real:
            if n:
                todo.append(ph)
            continue
        if re.search(r'(?<![0-9])%s(?![0-9])' % re.escape(str(real)), text):
            sys.exit('%s: id %s уже стоит в исходнике — в исходнике должны быть только заглушки' % (where, real))
        text = pat.sub(str(real), text)
        if ph in text:
            sys.exit('%s: заглушка %s осталась после подстановки (встречается не только как id чарта)' % (where, ph))
    return text, todo


SQLLAB_FORBIDDEN = [(re.compile(r'(?i)system'), 'system'), (re.compile(r'(?i)\bshow\b'), 'SHOW')]


def sqllab_guard(text, where):
    for rx, word in SQLLAB_FORBIDDEN:
        m = rx.search(text)
        if m:
            sys.exit('%s: слово «%s» в строке %d — SQL Lab Proteus отвергнет файл («Использование "system" запрещено»)'
                     % (where, word, text.count('\n', 0, m.start()) + 1))
    if re.search(r'(?i)\breplace\b', text):
        print('  ! %s: REPLACE в SQL Lab-файле — отказ не подтверждён боем, проверьте' % where)


def npm_root():
    try:
        return subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ''


def minify(text, head, where, extra=()):
    """kit/min.cjs: node min.cjs 'шапка' --check --budget КБ < in.js > out.js (terser 5.51.2, ES5, верхний уровень
    не трогается; --check: разбор как ES5, option на месте, имена верхнего уровня, без eval). extra — флаги min.cjs
    (например ['--css-var', 'TP_CSS'])."""
    mincjs = os.path.join(KIT, 'min.cjs')
    if not os.path.exists(mincjs):
        sys.exit('нет %s — нужен kit/min.cjs из playbook (PLAYBOOK_KIT=<путь к kit>)' % mincjs)
    cmd = ['node', mincjs, head, '--check', '--budget', str(JS_BUDGET_KB), '--kbps', str(SEND_KBPS)] + list(extra)
    try:
        r = subprocess.run(cmd, input=text, capture_output=True, text=True, check=True,
                           env=dict(os.environ, NODE_PATH=npm_root()))
    except (OSError, subprocess.CalledProcessError) as e:
        sys.exit('%s: сборка не прошла (нужны node и npm i -g terser@5.51.2; бюджет %d КБ): %s'
                 % (where, JS_BUDGET_KB, (getattr(e, 'stderr', '') or str(e))[-600:]))
    out = r.stdout
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(out)
        tmp = f.name
    try:
        chk = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    finally:
        os.unlink(tmp)
    if chk.returncode:
        sys.exit('%s: сборка не проходит node --check: %s' % (where, chk.stderr[-300:]))
    return out


def build_one(src, name, kind, subs, extra=()):
    """→ (текст файла поставки, заметки). extra — флаги kit/min.cjs для вида js."""
    path = os.path.join(ROOT, src)
    text = open(path, encoding='utf-8').read()
    for old, new in subs:
        text = one_line(text, old, new, name)
    st = stamp(src, text)
    notes = []
    if kind == 'dataset':
        m = re.findall(r"\{% set BUILD = '[^']*' %\}", text)
        if len(m) == 1:   # штамп и в ответ (meta.build), если датасет его эхом отдаёт
            text = text.replace(m[0], "{% set BUILD = '" + '%s/%s/%s' % (DELIVERY, DATE, sha12(text)) + "' %}")
        out = '{# %s #}\n%s' % (st, text)
        if re.search(r'(?i)system', text):
            notes.append('слово «system» в датасете — в SQL Lab его не запустить')
    elif kind == 'sqllab':
        sqllab_guard(text, name)
        out = '-- %s\n%s' % (st, text)
        sqllab_guard(out, name)
    elif kind == 'js':
        out = minify(text, st, name, extra)
        kb = len(out.encode('utf-8')) / 1024
        notes.append('%.1f КБ (исходник %.1f КБ), ≈ %.1f с отправки при %d КБ/с' % (
            kb, len(text.encode('utf-8')) / 1024, kb / SEND_KBPS, SEND_KBPS))
    elif kind == 'css':
        body, todo = board_ids(text, name, 'css')
        head = '/* %s */\n' % st
        if todo:
            head += '/* ЗАМЕНИТЕ во всех местах (Ctrl+H) заглушки id чартов: %s */\n' % ', '.join(todo)
            notes.append('не подставлены id: %s' % ', '.join(todo))
        out = head + body
    elif kind == 'snippet':
        body, todo = board_ids(text, name, 'snippet')
        out = '// %s\n%s' % (st, body)
        if todo:
            notes.append('не подставлены id: %s' % ', '.join(todo))
    elif kind == 'json':
        json.loads(text)          # битый JSON — падение сборки, а не владельца
        out = text
    elif kind == 'py':
        out = '# %s\n%s' % (st, text)
    elif kind == 'raw':
        out = text
    else:
        sys.exit('%s: неизвестный вид %r' % (name, kind))
    return out, notes


def main(argv):
    check, gate = '--check' in argv, '--gate' in argv
    names = [c[1] for c in COPIES]
    nums = [n.split('.', 1)[0] for n in names]
    if len(set(nums)) != len(nums):
        sys.exit('номера файлов поставки повторяются: %s' % nums)
    os.makedirs(OUT, exist_ok=True)
    rows, bad, changed = [], 0, []
    for c in COPIES:
        src, name, kind, subs = c[:4]
        text, notes = build_one(src, name, kind, subs, c[4] if len(c) > 4 else ())
        path = os.path.join(OUT, name)
        old = open(path, encoding='utf-8').read() if os.path.exists(path) else None
        same = old == text
        if check:
            status = 'ok' if same else ('НЕТ' if old is None else 'РАЗНЫЕ')
            bad += not same
        elif same:
            status = 'без изменений'
        else:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            open(path, 'w', encoding='utf-8').write(text)
            status = 'записан' if old is not None else 'новый'
            changed.append(name.split('.', 1)[0])
        rows.append((name, src, kind, status, '; '.join(notes)))
    w = max(len(r[0]) for r in rows)
    print('%s — поставка %s, %s → %s' % (REPORT, DELIVERY, DATE, os.path.relpath(OUT, ROOT)))
    for name, src, kind, status, note in rows:
        print('  %-*s  %-8s %-14s %s' % (w, name, kind, status, note))
    if not check:
        print('Заменить в «Что нового»: %s' % (', '.join(changed) if changed else 'ничего — копии совпадают'))
    if gate:
        sql = [os.path.join(OUT, c[1]) for c in COPIES if c[2] == 'dataset']
        lab = [os.path.join(OUT, c[1]) for c in COPIES if c[2] == 'sqllab']
        gp = os.path.join(KIT, 'sqlgate.py')
        py = KIT_PY if os.path.exists(KIT_PY) else sys.executable
        rc = 0
        if sql:
            rc |= subprocess.run([py, gp] + sql).returncode
        if lab:
            rc |= subprocess.run([py, gp, '--sqllab'] + lab).returncode
        bad += rc
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
