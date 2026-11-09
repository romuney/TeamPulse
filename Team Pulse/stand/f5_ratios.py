"""Пропорции стенда против боя (09.11, владелец: «подгоняй стенд под данные и масштаб боя»).

Запуск после прогона стенда (stand/nb_tp20.py --hub ...):
    python3 stand/f5_ratios.py "Поставка — TeamPulse Hub/5. Helicopter — отладка на реальных данных (GP).sql" <CSV файла 5 с боя>
Файл 5 выполняется на PostgreSQL стенда; из обоих результатов считаются только доли (найм, БГ, стажёры, отток, переводы в / из
к численности в месяц, покраска, разметка мониторинга, посещаемость, посещения без брони, наймы без источника) — абсолютных
чисел боя скрипт не печатает. CSV с боя в репозиторий не кладётся.
"""
import psycopg2,sys,collections,csv
c=psycopg2.connect(host='/tmp/pgt',port=55432,user='pg',dbname='postgres').cursor()
c.execute(open(sys.argv[1],encoding='utf-8').read()); st=[(str(r[0]),r[2],r[4],float(r[5]) if r[5] is not None else None) for r in c.fetchall()]
pr=[(x['n'],x['stroka'],x['pokazatel'],float(x['znachenie']) if x['znachenie'] not in ('',None) else None) for x in csv.DictReader(open(sys.argv[2],encoding='utf-8-sig'))]
def ratios(R):
    d=collections.defaultdict(dict)
    for n,k,p,v in R: d[(n,k if k!='Hq' else 'HQ')][p]=v
    w=[k for (n,k) in d if n=='1' and k.startswith('водопад')][0]; W=d[('1',w)]
    hc=sum(v['hc'] for (n,k),v in d.items() if n=='1' and not k.startswith('вод'))/12
    o={}
    for m in ['hire','hire_bg','hire_intern','fire','tin','tout']: o[m+'/hc/мес %']=round(100*W[m]/11/hc,2)
    o['bg/hire %']=round(100*W['hire_bg']/W['hire'],1); o['intern/hire %']=round(100*W['hire_intern']/W['hire'],1)
    o['ostatok']=W['ostatok']
    tot=d[('3','ИТОГО')]['hc']
    for pc in ('HQ','Line','Support'):
        x=d[('3',pc)]; o['доля '+pc]=round(100*x['hc']/tot,1); o['размечено '+pc]=round(100*(1-x['ne_razmecheno']/x['hc']),1)
        o['посещ '+pc]=d[('9',pc)]['attendance_pct']; o['без брони '+pc]=d[('9',pc)]['no_booking_share_pct']
    h8=[v for (n,k),v in d.items() if n=='8']; o['найм без источника %']=round(100*sum(v['no_value_on_hire_day'] for v in h8)/sum(v['hires'] for v in h8),1)
    return o
a,b=ratios(st),ratios(pr)
for k in b: print(f'{k:24s} стенд {a.get(k)!s:8s} бой {b[k]}')
