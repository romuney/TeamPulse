# Папка «Выгрузка руководителей»: ноутбук Helicopter = сборка TeamPulse Hub (тот же YAML поставки, без выгрузки в
# ClickHouse) + параграф логинов в начале + параграф метрик и Excel в конце. Логика метрик — та же, что у отчёта:
# таблицы собирает тот же код, формулы — stand/heads/heads_export.py (сверка с отчётом — stand/heads/check_heads.py).
#
#   python3 stand/mk_heads_yaml.py           # пересобрать после правки ноутбука Hub (mk_hub_yaml.py) или stand/heads/
import os, uuid
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
HUB = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub', '1. Helicopter — ноут TeamPulse Hub.yaml')
OUT_DIR = os.path.join(HERE, '..', 'Выгрузка руководителей')
OUT = os.path.join(OUT_DIR, '1. Helicopter — ноут выгрузки руководителей.yaml')
SRC = os.path.join(HERE, 'heads')
DROP = {'to click', 'TeamPulse Hub — что собирает ноутбук'}

ABOUT = """# TeamPulse Hub — выгрузка руководителей в Excel

1. В параграфе **«Выгрузка руководителей · логины»** впишите логины руководителей.
2. «Запустить все». Сначала идёт сборка таблиц TeamPulse Hub — тот же код, что у ноутбука отчёта, без изменений и без
   выгрузки в ClickHouse (отчёт этот ноутбук не трогает).
3. Последний параграф **«Выгрузка руководителей · метрики и Excel»** даёт ссылку «Скачать Excel».

В Excel: строка на каждый юнит руководителя из списка (логин жирным, юнит под ним серым), под ней — его прямые
подразделения обычным шрифтом; группы схлопываются и раскрываются (кнопки «+ / −» слева). Метрики — как в отчёте
TeamPulse Hub у выбранного юнита при настройках по умолчанию; формулы — на листе «Как считается».
"""


def para(title, shebang, code):
    return {'sid': str(uuid.uuid5(uuid.NAMESPACE_URL, 'heads:' + title)), 'title': title, 'shebang': shebang,
            'code': code, 'isEnabled': 'True'}


def main():
    d = yaml.safe_load(open(HUB, encoding='utf-8'))
    ps = [p for p in d['paragraphs'] if p['title'] not in DROP]
    for p in ps:      # свой ноутбук — свои номера параграфов (не совпадают с ноутбуком отчёта)
        p['sid'] = str(uuid.uuid5(uuid.NAMESPACE_URL, 'heads:' + p['sid']))
    head = [para('Выгрузка руководителей — что делает ноутбук', 'md', ABOUT),
            para('Выгрузка руководителей · логины', 'python', open(os.path.join(SRC, 'heads_logins.py'), encoding='utf-8').read())]
    tail = [para('Выгрузка руководителей · метрики и Excel', 'python', open(os.path.join(SRC, 'heads_export.py'), encoding='utf-8').read())]
    d['title'] = 'TeamPulse Hub — выгрузка руководителей'
    d['paragraphs'] = head + ps + tail
    os.makedirs(OUT_DIR, exist_ok=True)
    yaml.safe_dump(d, open(OUT, 'w', encoding='utf-8'), allow_unicode=True, sort_keys=False, width=1000)
    print(f'{OUT}: параграфов {len(d["paragraphs"])}')


if __name__ == '__main__':
    main()
