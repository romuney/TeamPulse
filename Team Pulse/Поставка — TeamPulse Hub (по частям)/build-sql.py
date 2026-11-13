"""Build only experimental virtual datasets from the unchanged ordinary source.

python build-sql.py [--check]
No notebook, JS, board CSS or dashboard metadata is written.
"""
import argparse
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    shared = module('split_generator', HERE.parent / 'stand/mk_split.py')
    patch = module('split_sql_patch', HERE / 'src/sql-patches.py')
    datasets = shared.datasets()
    different = []
    for part, name, _ in shared.PARTS:
        source = datasets[name]
        if part in ('core', 'aux'):
            source = patch.transform(source) if part == 'core' else patch.transform_peer(source)
            boundary = source.index('-#}') + 4
            source = ('{#- TeamPulse Hub: экспериментальная часть ' + part + '.\n'
                      '    Собрано build-sql.py из обычного датасета с точечными src/sql-patches.py.\n'
                      '    Обычная поставка — эталон; GP, права, фильтры и контракт ответа сохранены.\n'
                      '    Не править вручную. Пересборка: python build-sql.py. -#}\n' + source[boundary:])
        target = HERE / name
        if not target.exists() or target.read_text() != source:
            different.append(name)
            if not args.check:
                target.write_text(source)
    if args.check and different:
        raise SystemExit('SQL build differs: ' + ', '.join(different))
    print(('PASS: SQL artifacts match source' if args.check else 'SQL files updated: ' + ', '.join(different)))


if __name__ == '__main__':
    main()
