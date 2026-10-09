#!/usr/bin/env bash
# Окружение стенда Proteus: venv на Python 3.12 с версиями боя и node-пакеты (terser, eslint, playwright) для JS.
#
#   bash kit/setup.sh                  # venv в ~/.venvs/proteus-kit (+ ~/.venvs/proteus-sp044), node-пакеты глобально
#   KIT_VENV=/путь bash kit/setup.sh   # другой каталог venv
#   SP044=0 bash kit/setup.sh          # без второго venv с sqlparse 0.4.4
#   NPM=0 bash kit/setup.sh            # без npm (terser, eslint, playwright не ставить)
#   BROWSER=1 bash kit/setup.sh        # ещё и Chromium для kit/sbx (≈150 МБ)
#
# Версии (почему именно они — 13-stand.md):
#   chdb 2.1.1        = ClickHouse 24.8.4.1 (бой — 24.8.15.1); chdb 3.0.0–3.2.0 — тоже 24.8, 4.x — уже 26.x
#   sqlparse 0.3.0    = Superset 2.0.1 (setup.py: «PINNED!»); патч лексера Superset ставит kit/superset201.py
#   jinja2 3.0.3      = Superset 2.0.1 (requirements/base.txt), markupsafe 2.0.1 — так же (ставится на 3.12)
#   sqlglot 26.33.0   — модель проверки форка «Некорректный SQL запрос» (23–30 дают тот же отказ; < 15 не годятся:
#                       не знают CAST(x, 'T') и роняют рабочие датасеты); другие версии — pip install --target
#   pyyaml            — выгрузки Proteus (YAML); psycopg2-binary — стенд GP на PostgreSQL 16
#   sqlparse 0.4.4    — второй venv: вторая модель лексера (Superset 2.1.3–3.x; патч ставит superset201.py так, как
#                       они). Бой adoption (30.09) ведёт себя как 0.4.x, а не 0.3.0 — гоняйте датасет в ОБОИХ venv
#   terser 5.51.2     — сжатие кода чарта (kit/min.cjs): версия закреплена, иначе pack --check разойдётся
#   eslint 10.1.0     — no-undef по kit/eslint.chart.cjs; playwright 1.56.1 — kit/sbx (модель песочницы)
set -euo pipefail

KIT_VENV="${KIT_VENV:-$HOME/.venvs/proteus-kit}"
SP044_VENV="${SP044_VENV:-$HOME/.venvs/proteus-sp044}"
PY="${PYTHON:-python3.12}"
PKGS=(chdb==2.1.1 sqlparse==0.3.0 sqlglot==26.33.0 jinja2==3.0.3 markupsafe==2.0.1 pyyaml psycopg2-binary)

say() { printf '\n== %s\n' "$*"; }

make_venv() {   # $1 — каталог, остальное — пакеты
  local dir="$1"; shift
  if command -v uv >/dev/null 2>&1; then
    [ -x "$dir/bin/python" ] || uv venv -q -p 3.12 "$dir"
    uv pip install -q -p "$dir/bin/python" "$@"
  else
    command -v "$PY" >/dev/null 2>&1 || { echo "нет $PY и нет uv: поставьте Python 3.12 или uv"; exit 1; }
    [ -x "$dir/bin/python" ] || "$PY" -m venv "$dir"
    "$dir/bin/python" -m pip install -q --upgrade pip
    "$dir/bin/python" -m pip install -q "$@"
  fi
}

say "venv $KIT_VENV (Python 3.12)"
if ! make_venv "$KIT_VENV" "${PKGS[@]}"; then
  # jinja2 3.0.3 / markupsafe 2.0.1 не встали (сборка из исходников) — ближайшие, это отмечается ниже
  echo "! jinja2 3.0.3 / markupsafe 2.0.1 не встали — беру jinja2 3.0.x/3.1 с новым markupsafe"
  make_venv "$KIT_VENV" chdb==2.1.1 sqlparse==0.3.0 sqlglot==26.33.0 'jinja2>=3.0.3,<3.2' pyyaml psycopg2-binary
fi

if [ "${SP044:-1}" != "0" ]; then
  say "venv $SP044_VENV (sqlparse 0.4.4 — запас на обновление Proteus)"
  make_venv "$SP044_VENV" chdb==2.1.1 sqlparse==0.4.4 sqlglot==26.33.0 jinja2==3.0.3 markupsafe==2.0.1 \
    || make_venv "$SP044_VENV" chdb==2.1.1 sqlparse==0.4.4 sqlglot==26.33.0 'jinja2>=3.0.3,<3.2'
fi

if [ "${NPM:-1}" != "0" ]; then
  say "node-пакеты глобально: terser 5.51.2 (сжатие), eslint 10.1.0 (no-undef), playwright 1.56.1 (модель песочницы)"
  if command -v npm >/dev/null 2>&1; then
    root="$(npm root -g)"
    for spec in terser@5.51.2 eslint@10.1.0 playwright@1.56.1; do
      name="${spec%@*}"; want="${spec##*@}"
      have="$(NODE_PATH="$root" node -e "try{console.log(require('$name/package.json').version)}catch(e){}" 2>/dev/null || true)"
      if [ "$have" = "$want" ]; then echo "$name $want уже стоит"; else npm i -g "$spec"; fi
    done
    if [ "${BROWSER:-0}" = "1" ]; then
      NODE_PATH="$root" npx -y playwright@1.56.1 install chromium    # ≈150 МБ; путь — PLAYWRIGHT_BROWSERS_PATH
    else
      echo "Chromium для kit/sbx: BROWSER=1 bash kit/setup.sh (или свой PLAYWRIGHT_BROWSERS_PATH)"
    fi
  else
    echo "! нет npm/node — сжатие JS (kit/min.cjs, pack --check), ESLint и kit/sbx работать не будут"
  fi
fi

say "версии"
"$KIT_VENV/bin/python" - <<'EOF'
import sys
from importlib.metadata import version
import chdb
print('python    ', sys.version.split()[0])
for p in ('chdb', 'sqlparse', 'sqlglot', 'jinja2', 'markupsafe', 'pyyaml', 'psycopg2-binary'):
    try:
        print('%-10s' % p, version(p))
    except Exception:
        print('%-10s' % p, 'нет')
print('ClickHouse', str(chdb.query("SELECT version(), getSetting('allow_experimental_analyzer'), "
                                  "getSetting('max_query_size')", 'CSV')).strip())
EOF
if [ -x "$SP044_VENV/bin/python" ]; then
  "$SP044_VENV/bin/python" -c "import sqlparse; print('sp044      sqlparse', sqlparse.__version__)"
fi
if command -v node >/dev/null 2>&1; then
  root="$(npm root -g 2>/dev/null || true)"
  printf 'node       %s' "$(node --version)"
  for name in terser eslint playwright; do
    printf '; %s %s' "$name" "$(NODE_PATH="$root" node -e "try{console.log(require('$name/package.json').version)}catch(e){console.log('нет')}")"
  done
  echo
fi
echo
echo "Готово. Python стенда: $KIT_VENV/bin/python (для pack --gate: PLAYBOOK_PY=$KIT_VENV/bin/python)"
