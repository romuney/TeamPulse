# Ноутбук «1. Helicopter — ноут TeamPulse Hub.yaml» (папка поставки) из «TP 2.0.yaml» заказчика:
# параграфы TP 2.0 с правками 1–3 и 5 стенда (stand/nb_tp20.py, FIX — те же строки), срезы отчёта
# в EXEC build_all_metrics, новые параграфы из stand/hub_nb/ и выгрузка таблиц teampulse_hub_*.
# Выключенные и отладочные параграфы TP 2.0 в копию не идут.
#
#   python3 stand/mk_hub_yaml.py            # пересобрать YAML (после правки TP 2.0 или hub_nb/)
import os, sys, uuid
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from nb_tp20 import FIX                                     # noqa: E402

DIR = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub')
SRC = os.path.join(DIR, 'TP 2.0.yaml')
OUT = os.path.join(DIR, '1. Helicopter — ноут TeamPulse Hub.yaml')
NB = os.path.join(HERE, 'hub_nb')
STEPS = (1, 2, 3, 5)          # правка 4 (уровень перевода в ключе hr_structure_overall) не нужна:
                              # переводы через границу узла считает build_hub по людям

EXTRA = {
    'EXEC build_all_metrics': [
        ("build_all_metrics(\n    res_table_name='all_metrics',",
         "# срезы отчёта TeamPulse Hub — сырые коды покраски и IT. В hr_structure_overall не идут:\n"
         "# group_and_sum_metrics берёт ключами только fields\n"
         "HUB_FIELDS = [\n"
         "    {'name': 'emp_specialization_oper_code', 'alias': 'paint_cd'},\n"
         "    {'name': 'emp_specialization_it_code',   'alias': 'it_cd'},\n"
         "]\n\n"
         "build_all_metrics(\n    res_table_name='all_metrics',"),
        ("    fields=fields,", "    fields=fields + HUB_FIELDS,"),
    ],
    'to click': [
        ("tables_dict = {\n    'hr_structure_with_ssch': 'prod_proteus.hr_structure_overall',\n}",
         "tables_dict = {\n"
         "    'hr_structure_with_ssch': 'prod_proteus.hr_structure_overall',   # как в TP 2.0 — для других отчётов\n"
         "    # TeamPulse Hub: датасет отчёта читает только их\n"
         "    'teampulse_hub_meta':   'prod_proteus.teampulse_hub_meta',\n"
         "    'teampulse_hub_unit':   'prod_proteus.teampulse_hub_unit',\n"
         "    'teampulse_hub_series': 'prod_proteus.teampulse_hub_series',\n"
         "    'teampulse_hub_mix':    'prod_proteus.teampulse_hub_mix',\n"
         "}"),
    ],
}
# порядок и состав: индекс параграфа TP 2.0 или новый параграф (заголовок, shebang, файл)
PLAN = [('new', 'TeamPulse Hub — что собирает ноутбук', 'md', 'about.md'),
        0, ('new', 'Схема', 'md', 'scheme.md'),
        2, 3, 4, 5, 6, 7, 14, 15, 16, 18, 19, 20, 22, 23,
        ('new', 'build_hub', 'python', 'build_hub.py'),
        ('new', 'EXEC build_hub', 'python', 'exec_build_hub.py'),
        ('new', 'hub checks', 'python', 'hub_checks.py'),
        30]


def patch(title, code):
    for step, t, old, new in FIX:
        if step in STEPS and t == title:
            assert code.count(old) == 1, (title, old[:60])
            code = code.replace(old, new)
    for old, new in EXTRA.get(title, []):
        assert code.count(old) == 1, (title, old[:60])
        code = code.replace(old, new)
    return code


class Lit(str):
    pass


def lit(dumper, s):
    return dumper.represent_scalar('tag:yaml.org,2002:str', s, style='|')


yaml.add_representer(Lit, lit, Dumper=yaml.SafeDumper)


def main():
    src = yaml.safe_load(open(SRC, encoding='utf-8'))
    ps = src['paragraphs']
    out = []
    for item in PLAN:
        if isinstance(item, tuple):
            _, title, shebang, fn = item
            code = open(os.path.join(NB, fn), encoding='utf-8').read().rstrip('\n')
        else:
            p = ps[item]
            assert p.get('isEnabled', True), p['title']
            title, shebang, code = p['title'], p['shebang'], patch(p['title'], p.get('code') or '')
        code = '\n'.join(line.rstrip() for line in code.split('\n')).strip('\n')
        out.append({'sid': str(uuid.uuid5(uuid.NAMESPACE_URL, 'teampulse-hub/' + title)), 'title': title,
                    'shebang': shebang, 'code': Lit(code), 'isEnabled': True})
    doc = {'title': 'TeamPulse Hub', 'formElements': src.get('formElements', []), 'paragraphs': out,
           'aiProperties': src.get('aiProperties', {'context': ''})}
    with open(OUT, 'w', encoding='utf-8') as f:
        yaml.dump(doc, f, Dumper=yaml.SafeDumper, allow_unicode=True, sort_keys=False, width=1000)
    back = yaml.safe_load(open(OUT, encoding='utf-8'))
    assert [p['code'] for p in back['paragraphs']] == [str(p['code']) for p in out]
    print(f'{os.path.basename(OUT)}: параграфов {len(out)}')
    for p in out:
        print(f"  {p['shebang']:16} {p['title']}")


if __name__ == '__main__':
    main()
