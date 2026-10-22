# =============================================================================
# 9. Сверка переводов с мастер-отчётом (поставка 63)
#
# На входе два файла по ОДНОМУ подразделению и ОДНИМ И ТЕМ ЖЕ фильтрам:
#   1) выгрузка детализации из отчёта: «Движение персонала» → «Кто перевёлся — детализация переводов» →
#      «13 месяцев» → «Выгрузить для сверки» (CSV через «;»);
#   2) числа мастер-отчёта по месяцам: CSV или xlsx с колонками «месяц; transfer_in; transfer_out» (как листы
#      Result в Raw_vs_result.xlsx: месяц — дата или «ГГГГ-ММ»).
#
#   python3 "9. Сверка переводов с мастер-отчётом.py" выгрузка.csv мастер.csv  [--out разбор.csv]
#   python3 "9. Сверка переводов с мастер-отчётом.py" выгрузка.csv Raw_vs_result.xlsx --sheet Result2
#
# Что делает: по каждому месяцу — «в» и «из» отчёта (засчитанные события выгрузки) против мастер-отчёта. По
# месяцам, где не сошлось, печатает события этого месяца: засчитанные и нет, с причиной, и подсказку, куда
# смотреть (например: у мастер-отчёта «из» больше — проверьте события «из» в последний день прошлого месяца).
# --out — те же события несошедшихся месяцев в CSV с пустой колонкой note: впишите, какие события мастер-отчёт
# считает иначе и почему, и пришлите файл в чат. В файле нет логинов и названий — только шифр и флаги.
# =============================================================================
import csv, sys, datetime as dt
from collections import Counter, defaultdict

WHY = {'ok': 'засчитано', 'flt': 'вне фильтров отчёта', 'attr': 'смена атрибута без фильтра по нему',
       'cand': 'кандидат или стажёр — не перевод', 'hire': 'кандидат или стажёр — найм'}
FLAGS = [('unit_flag', 'подразделение'), ('type_flag', 'тип'), ('paint_flag', 'покраска'), ('it_flag', 'IT'),
         ('staff_flag', 'оформление')]


def month_key(v):
    """месяц «ГГГГ-ММ» из «2025-11-01 00:00:00», «2025-11-01», «2025-11» или «01.11.2025»; не месяц — None"""
    v = str(v).strip()
    for f, n in (('%Y-%m-%d', 10), ('%Y-%m', 7), ('%d.%m.%Y', 10)):
        try:
            return dt.datetime.strptime(v[:n], f).strftime('%Y-%m')
        except ValueError:
            pass
    return None


def read_master(path, sheet=None):
    rows = []
    if path.lower().endswith('.xlsx'):
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb[sheet] if sheet else wb.worksheets[0]
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
    else:
        with open(path, encoding='utf-8-sig') as f:
            sample = f.read(2048)
            f.seek(0)
            rows = list(csv.reader(f, delimiter=';' if sample.count(';') >= sample.count(',') else ','))
    out = {}
    for r in rows:
        if not r or r[0] is None:
            continue
        m = r[0].strftime('%Y-%m') if isinstance(r[0], (dt.date, dt.datetime)) else month_key(r[0])
        if not m:
            continue
        try:
            out[m] = (int(float(r[1])), int(float(r[2])))
        except (TypeError, ValueError, IndexError):
            continue
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opt = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
    out_path, sheet = opt('--out'), opt('--sheet')
    args = [a for a in args if a not in (out_path, sheet)]
    if len(args) != 2:
        sys.exit(__doc__ or 'нужно два файла: выгрузка отчёта и числа мастер-отчёта')
    with open(args[0], encoding='utf-8-sig') as f:
        ev = list(csv.DictReader(f, delimiter=';'))
    master = read_master(args[1], sheet)
    if not master:
        sys.exit('В файле мастер-отчёта не нашлось строк «месяц; в; из». Для xlsx укажите лист: --sheet Result1')
    ours = Counter((e['report_month'], e['kind']) for e in ev if e['counted'] == '1')
    months = sorted(set(e['report_month'] for e in ev) | set(master))
    print(f"{'месяц':8} | {'в: отчёт':>9} {'мастер':>7} | {'из: отчёт':>10} {'мастер':>7} |")
    bad = []
    for m in months:
        mi, mo = master.get(m, (None, None))
        oi, oo = ours[(m, 'in')], ours[(m, 'out')]
        ok = mi is None or (oi == mi and oo == mo)
        print(f"{m:8} | {oi:>9} {'' if mi is None else mi:>7} | {oo:>10} {'' if mo is None else mo:>7} | {'' if ok else 'НЕ СХОДИТСЯ'}")
        if not ok:
            bad.append(m)
    if not bad:
        print('\nВсе месяцы сошлись.')
        return
    keep = []
    for m in bad:
        mi, mo = master[m]
        print(f'\n=== {m}: «в» отчёт {ours[(m, "in")]} / мастер {mi}, «из» отчёт {ours[(m, "out")]} / мастер {mo}')
        for kind, want in (('in', mi), ('out', mo)):
            got = ours[(m, kind)]
            if got == want:
                continue
            evs = [e for e in ev if e['report_month'] == m and e['kind'] == kind]
            print(f'  «{"в" if kind == "in" else "из"}»: у мастер-отчёта {"больше" if want > got else "меньше"} на {abs(want - got)}. '
                  + ('Среди незасчитанных ниже — кандидаты на недостающие.' if want > got else
                     'Среди засчитанных ниже — кандидаты на лишние.'))
            if kind == 'out':
                ld = [e for e in evs if e['event_date'][:7] != m]
                if ld:
                    print(f'    {len(ld)} событий «из» — в последний день прошлого месяца (у нас идут в {m}).')
            for e in sorted(evs, key=lambda e: (e['counted'] != '1', e['event_date'])):
                fl = ', '.join(n for k, n in FLAGS if e.get(k) == '1') or '—'
                print(f"    {e['event_date']}  {e['emp_code']}  флаги: {fl:28} тип {e['type']:12} "
                      f"{'засчитано' if e['counted'] == '1' else WHY.get(e['why'], e['why'])}")
                keep.append(e)
    if out_path:
        with open(out_path, 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.DictWriter(f, fieldnames=list(ev[0].keys()), delimiter=';')
            w.writeheader()
            w.writerows(keep)
        print(f'\nСобытия несошедшихся месяцев — в {out_path}: впишите в note, как их считает мастер-отчёт.')


if __name__ == '__main__':
    main()
