# Детализация переводов (поставка 63): засчитанные события месяца = переводы отчёта — для подразделений разной
# глубины и разных фильтров. Датасет 2а с trd_f (подразделение) и trm_f (13 месяцев) отдаёт строку ev; её «ok»
# по месяцам и видам сверяются с рядами tin / tout строки scope того же ответа (unit_f — то же подразделение).
#   python3 stand/trd_check.py <папка стенда>
import json, os, sys
from collections import Counter
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import nb_hub_check as hc                                                 # noqa: E402

CASES = [('по умолчанию (Активная)', {}), ('Активная + Подрядчики', {'act_f': ['Активная', 'Подрядчики']}),
         ('вся численность', {'act_f': ['Вся']}), ('покраска Hq', {'paint_f': ['Hq']}),
         ('Line + Support, Не штат', {'paint_f': ['Line', 'Support'], 'staff_f': ['Не штат']})]


def main():
    db = os.path.join(sys.argv[1], 'db')
    _, rows = hc.run(db, hc.F2A, {})
    meta = json.loads(rows[0]['j'])
    dl = [l.split('\t') for l in next(r for r in rows if r['role'] == 'dict')['j'].split('\n') if l]
    by_lvl = {}
    for f in dl:
        by_lvl.setdefault(int(f[2]), []).append(f[0])
    nodes = [meta['root']] + [sorted(by_lvl[l])[0] for l in sorted(by_lvl) if l > min(by_lvl)][:3]
    import datetime as dt
    lm = dt.date.fromisoformat(meta['lm'])
    months = [(dt.date(lm.year + (lm.month - 1 - k) // 12, (lm.month - 1 - k) % 12 + 1, 1)) for k in range(12, -1, -1)]
    m0 = dt.date.fromisoformat(meta['m0'])
    bad, total = 0, 0
    for name, flt in CASES:
        for n in nodes:
            f = dict(flt, unit_f=[n], trd_f=[n], trm_f=[m.isoformat()[:7] for m in months])
            _, rr = hc.run(db, hc.F2A, f)
            mk = json.loads(rr[0]['j'])['mk'].split(',')
            sc = next(r for r in rr if r['role'] == 'scope')
            ser = dict(zip(mk, [[float(x) for x in a.split(',')] for a in sc['ms'].split(';')]))
            ev = next((r for r in rr if r['role'] == 'ev'), None)
            got = Counter()
            for l in (ev['j'] if ev else '').split('\n'):
                if l:
                    p = l.split('\t')
                    if p[16] == 'ok':
                        got[(p[1][:7], p[2])] += 1
            for m in months:
                i = (m.year - m0.year) * 12 + m.month - m0.month
                want = {'i': round(ser['tin'][i]), 'o': round(ser['tout'][i])}
                for k in 'io':
                    total += 1
                    if got[(m.isoformat()[:7], k)] != want[k]:
                        bad += 1
                        print(f'  РАСХОЖДЕНИЕ {name} · узел {n} · {m:%Y-%m} · {k}: детализация {got[(m.isoformat()[:7], k)]}, отчёт {want[k]}')
        print(f'{name:28}: узлов {len(nodes)} × 13 мес × в/из — проверено')
    print(f'ИТОГ: {total - bad} из {total} — ' + ('детализация = числам отчёта' if not bad else f'{bad} расхождений'))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
