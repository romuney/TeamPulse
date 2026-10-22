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
STEPS = (1, 2, 3, 5, 6)       # правка 4 (уровень перевода в ключе hr_structure_overall) не нужна:
                              # переводы через границу узла считают параграфы hub по людям

EXTRA = {
    'EXEC build_all_metrics': [
        ("build_all_metrics(\n    res_table_name='all_metrics',",
         "# срез отчёта TeamPulse Hub — покраска (HQ, Line, Support). В hr_structure_overall не идёт:\n"
         "# group_and_sum_metrics берёт ключами только fields. IT-код — в FIXED_DIMS, как в источнике\n"
         "HUB_FIELDS = [\n"
         "    {'name': 'emp_specialization_oper_code', 'alias': 'paint_cd'},\n"
         "    # 21.10, из прод-ноутбуков HQ и УС: тип компании, специализация (внутри стрима), источник найма\n"
         "    'type_company',\n"
         "    {'name': 'employee_specialization_desc', 'alias': 'specialization'},\n"
         "    'source_type_nm',\n"
         "]\n\n"
         "build_all_metrics(\n    res_table_name='all_metrics',"),
        ("    fields=fields,", "    fields=fields + HUB_FIELDS,"),
    ],
    'build_all_metrics': [
        # 21.10: обычные (non-regrettable) увольнения — как в прод-ноутбуке HQ (non_regrettable_set_hq)
        ("        for c in ('fire_flg', 'regrettable_fire_flg'):",
         "        for c in ('fire_flg', 'regrettable_fire_flg', 'non_regrettable_fire_flg'):"),
        ("            m.append('max((fire_flg = 1 AND regrettable_fire_flg = 1)::int) '\n"
         "                     'AS regret_fire_amt')\n",
         "            m.append('max((fire_flg = 1 AND regrettable_fire_flg = 1)::int) '\n"
         "                     'AS regret_fire_amt')\n"
         "        if has('non_regrettable_fire_flg'):\n"
         "            m.append('max((fire_flg = 1 AND non_regrettable_fire_flg = 1)::int) '\n"
         "                     'AS non_regret_fire_amt')\n"),
        ("            else:\n                m.append('max(hire_flg) AS hire_amt')\n",
         "            else:\n                m.append('max(hire_flg) AS hire_amt')\n"
         "            # TeamPulse Hub (20.10): найм в компанию с любым типом активности — найм «всей\n"
         "            # численности» (hire_amt — только активные на конец месяца)\n"
         "            m.append('max(hire_flg) AS hire_cnt')\n"),
    ],
    'Структура численности': [
        ("| `emp_specialization_oper_code` | Операционная специализация | HQ / nonHQ |",
         "| `emp_specialization_oper_code` | Операционная специализация (покраска) | HQ / Line / Support |"),
        ("| `emp_specialization_it_code` | IT-специализация | IT / nonIT |",
         "| `emp_specialization_it_code` | IT-специализация | IT / Digital / NonIT — три разные, не сводятся |"),
        ("| `active_type_nm` | Тип активности | Активная / Прочая |",
         "| `active_type_nm` | Тип активности; «Активная» — по флагу `active_count_flg` | Активная / Прочие (подрядчики — в прочих) |"),
    ],
    'to click': [
        ("tables_dict = {\n    'hr_structure_with_ssch': 'prod_proteus.hr_structure_overall',\n}",
         "tables_dict = {\n"
         "    # hr_structure_overall выгружает ноутбук TP 2.0 — здесь не трогаем, чтобы не перезаписать (21.10, Адель)\n"
         "    # 'hr_structure_with_ssch': 'prod_proteus.hr_structure_overall',\n"
         "    # TeamPulse Hub: датасет отчёта читает только их\n"
         "    'teampulse_hub_meta':   'prod_proteus.teampulse_hub_meta',\n"
         "    'teampulse_hub_unit':   'prod_proteus.teampulse_hub_unit',\n"
         "    'teampulse_hub_series': 'prod_proteus.teampulse_hub_series',\n"
         "    'teampulse_hub_mix':    'prod_proteus.teampulse_hub_mix',\n"
         "    'teampulse_hub_trf':    'prod_proteus.teampulse_hub_trf',     # переходы — переводы под фильтры\n"
         "    'teampulse_hub_vacancy': 'prod_proteus.teampulse_hub_vacancy',  # вакансии по узлам\n"
         "    'teampulse_hub_ai':      'prod_proteus.teampulse_hub_ai',       # AI-инструменты по узлам\n"
         "}"),
    ],
}
# порядок и состав: индекс параграфа TP 2.0 или новый параграф (заголовок, shebang, файл)
PLAN = [('new', 'TeamPulse Hub — что собирает ноутбук', 'md', 'about.md'),
        0, ('new', 'Схема', 'md', 'scheme.md'),
        2, 3, 4, 5, 6, 7, 14, 15, 16,
        # 22.10, поставка 58: сборка таблиц отчёта — параграфами gp (stand/hub_sql.py → hub_nb/sql_*.sql), без
        # Python, который ждал больше ста запросов в одном параграфе. Сначала — проверка колонок источников
        ('new', 'hub · 0 колонки', 'gp', 'sql_0_cols.sql'),
        # 21.10: вместо vacancy_daily TP 2.0 (JSON по юниту, org_structure LEFT JOIN — терял вакансии
        # юнитов без людей) — плоский снимок structure_x_vacancy; витрина — «hub · 6»
        ('new', 'structure_x_vacancy', 'gp', 'sql_vacancy.sql'),
        19, 20, 22, 23,
        ('new', 'hub · 1 структура', 'gp', 'sql_1_structure.sql'),
        ('new', 'hub · 2 логины и AI', 'python', 'hub_optional.py'),
        ('new', 'hub · 3 справочник и ряды', 'gp', 'sql_3_series.sql'),
        ('new', 'hub · 4 разрезы', 'gp', 'sql_4_mix.sql'),
        ('new', 'hub · 5 переходы', 'gp', 'sql_5_trf.sql'),
        ('new', 'hub · 6 вакансии и meta', 'gp', 'sql_6_final.sql'),
        ('new', 'hub checks', 'gp', 'sql_checks.sql'),
        30]


# поставка 58: файл 1а — как поставить и код новых параграфов (шапка — hub_nb/1a_head.md). Замер — стенд ×25
# (см. AGENTS.md, «Ноутбук: сборка параграфами gp»)
OUT_1A = os.path.join(DIR, '1а. Helicopter — изменённые параграфы.md')
P58 = ['hub · 0 колонки', 'structure_x_vacancy', 'hub · 1 структура', 'hub · 2 логины и AI', 'hub · 3 справочник и ряды',
       'hub · 4 разрезы', 'hub · 5 переходы', 'hub · 6 вакансии и meta', 'hub checks']
TIMING = {'T_PY': '198', 'Q_PY': '112', 'T_SQL': '69', 'Q_SQL': '18'}


def write_1a(out):
    head = open(os.path.join(NB, '1a_head.md'), encoding='utf-8').read()
    for k, v in TIMING.items():
        head = head.replace('{{' + k + '}}', v)
    assert '{{' not in head
    by = {p['title']: p for p in out}
    parts = [head.rstrip('\n')]
    for i, t in enumerate(P58, 1):
        p = by[t]
        lang = 'sql' if p['shebang'] == 'gp' else 'python'
        parts.append(f"\n### {i}. {t} — {p['shebang']}\n\n```{lang}\n{p['code']}\n```")
    with open(OUT_1A, 'w', encoding='utf-8') as f:
        f.write('\n'.join(parts) + '\n')
    print(f'{os.path.basename(OUT_1A)}: параграфов {len(P58)}')


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
    write_1a(out)


if __name__ == '__main__':
    main()
