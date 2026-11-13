"""Freeze measured baseline from git; refuses to overwrite an existing snapshot."""
import subprocess, shutil
import study as t
BASE = 'a2a34e0f8dd7c39d2c8d00d3072aa6965b5e066a'
dest = t.OUT / 'source-snapshot'
dest.mkdir(parents=True, exist_ok=False)
paths = subprocess.check_output(['git', '-c', 'core.quotepath=false', 'ls-tree', '-r', '--name-only', BASE], cwd=t.R).decode().splitlines()
for path in paths:
    if path.startswith('Team Pulse/Поставка — TeamPulse Hub (по частям)/2.') and path.endswith('.sql'):
        (dest / path.split('/')[-1]).write_bytes(subprocess.check_output(['git', 'show', BASE+':'+path], cwd=t.R))
# Git may quote non-ASCII paths unless core.quotepath=false is specified.
assert len(list(dest.glob('*.sql'))) == 5, 'expected five baseline SQL files'
ordinary = t.sc.text('all').replace("{% set FULL = ['tester'] %}", '{% set FULL = [] %}')
(dest/'ordinary.sql').write_text(ordinary)
shutil.copyfile(t.Path(__file__).with_name('ch-config.xml'), t.OUT/'ch-config.xml')
