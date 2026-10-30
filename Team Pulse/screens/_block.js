/* ============================================================================
   screens/_block.js — общий каркас детальной вкладки и реестр экранов.
   Неймспейс: window.TPSCREENS. Загружается ПЕРВЫМ среди screens/*.

   Каркас одинаков для всех восьми блоков: заголовок → инсайт → KPI блока →
   две колонки (таблица подразделений слева, содержимое справа).
   Блок-специфичное живёт в своём файле и регистрируется так:

     TPSCREENS.blocks.turnover = {
       subTabs:   [['dynamics','Динамика'],['reasons','Причины']],
       defaultSub:'dynamics',
       title(sub){ return '...' },      // заголовок правой панели
       view(ctx){ return '<html>' }     // тело правой панели
     };

   ctx, который получает view():
     S          — состояние (только читать)
     b          — определение блока из D.BLOCKS
     sub        — активная под-вкладка
     lp         — пути листьев ВЫБРАННОГО узла (клик по строке таблицы)
     rl, bl     — листья отбора и базы сравнения
     rows       — строки сводной таблицы (первый уровень, без раскрытий и поиска)
     root, sel  — пути юнита отчёта и выбранного узла
     benchLabel — подпись базы сравнения
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, INS=window.TPINSIGHTS, STY=window.TPSTORY;
const esc=U.esc;

const blocks={};

/* ---------- общие помощники, доступны экранам ---------- */
/* Корень сводной таблицы — юнит отчёта. Временного корня (drillRoot и кнопки ↓)
   больше нет: глубже трёх уровней ведёт переход в юнит, а он меняет сам юнит
   отчёта — с путём, «← Назад» и ссылкой (итерация 29, механика HRBP HUB). */
function currentRoot(S){return S.unit}
/* 31.10-б, п. 4: «Найм и вакансии HQ» — без доли внутреннего найма (метрика остаётся в данных и в других местах).
   Поставка 90: окно колонок — у всех блоков, кроме структуры, одно (D.periodTotal), см. renderBlock */
const TBL_OVR={hiring:{hide:{internal_share:1}}};
/* Глубина сводной таблицы: три уровня вниз от юнита отчёта. Глубже — «Открыть
   юнит» у выбранной строки. Переключателя глубины нет намеренно: на шести
   уровнях имя сжималось бы в столбик, а длинный список переставал читаться. */
const TREE_DEPTH=3;
function rowLeaves(path,S){return D.leavesUnder(path).map(l=>l.path).filter(p=>D.leafPasses(p,S))}
/* основная метрика таблицы: первая сравнимая среди ВЫБРАННЫХ метрик блока,
   иначе просто первая выбранная. Скрытая метрика главной быть не может —
   от неё зависит колонка «К базе» и подсветка строк. */
function blockMain(bk,S){
  const m=D.METRIC_BY_KEY[S.mainMetric];
  if(m&&m.block===bk&&D.metricVisible(m.key,S))return S.mainMetric;
  const mets=D.visibleMetricsOfBlock(bk,S);
  return (mets.find(x=>D.comparable(x.key))||mets[0]).key;
}
/* Строки, у которых есть что раскрывать в пределах трёх уровней: первый
   и второй уровень с детьми. Ими и только ими управляет каретка в ИТОГО —
   «раскрыть всё» открывает все три уровня разом. У строки третьего уровня
   каретки нет, даже если под ней есть подразделения: туда ведёт переход. */
function expandableRows(root){
  const out=[];
  (function walk(p,d){
    D.rowsOf(p).forEach(n=>{
      if(d<TREE_DEPTH&&D.rowsOf(n.path).length){out.push(n.path);walk(n.path,d+1)}
    });
  })(root,1);
  return out;
}
/* isEmpty(path) — у подразделения под текущими фильтрами никого нет. Такие
   строки не выводятся (22.10: «только строки, которые есть в данных»; раньше
   уходили вниз своего уровня и приглушались). Порядок — как в оргдереве. */
/* Три уровня вниз (TREE_DEPTH): раскрытая строка добавляет своих детей,
   кнопкой или кареткой ИТОГО. У юнита без подразделений (команды) строк нет —
   экран говорит об этом словами, а не повторяет ИТОГО второй строкой.
   q — поиск: дерево обходится целиком в пределах трёх уровней, остаются
   находки (hit) и их предки (anc) — свёрнутый родитель находку не прячет. */
/* cmp — сортировка соседей по колонке (мониторинг, 21.10): внутри каждого уровня, пустые — внизу */
function pivotRows(root,expanded,isEmpty,q,cmp){
  const rows=[], emp=isEmpty||(()=>false), needle=String(q||'').trim().toLowerCase();
  /* 22.10: подразделения, где под фильтрами никого нет, не выводятся — только строки, которые есть в данных */
  const order=list=>{const live=list.filter(n=>!emp(n.path));if(cmp)live.sort(cmp);return live};
  (function walk(p,d){
    order(D.rowsOf(p)).forEach(n=>{
      /* kidsOf: в пробнике у юнита третьего уровня дети в ответ не едут —
         их число приходит из датасета («ниже ещё N») */
      const kids=D.kidsOf(n.path);
      rows.push({n:n,depth:d,empty:emp(n.path),kids:kids});
      if(kids&&d<TREE_DEPTH&&(needle||expanded.has(n.path)))walk(n.path,d+1);
    });
  })(root,1);
  if(!needle)return rows;
  /* поиск — по названию, логину и фамилии-имени руководителя */
  const has=t=>!!t&&String(t).toLowerCase().indexOf(needle)>=0;
  const hits=rows.filter(r=>has(r.n.name)||r.n.head&&(has(r.n.head.login)||has(r.n.head.name))).map(r=>r.n.path);
  return rows.filter(r=>{
    r.hit=hits.indexOf(r.n.path)>=0;
    r.anc=!r.hit&&hits.some(h=>h.indexOf(r.n.path+'/')===0);
    return r.hit||r.anc;
  });
}
/* Имя того, что сейчас показано в правой панели: выбранная строка таблицы,
   иначе юнит отчёта. Именно этим именем
   подписана синяя линия в легенде: «значение» ничего не объясняет. */
/* ---------- Динамика: только «год к году» ----------
   13.10 заказчик: «убери 12 мес, оставь только год к году» — как в HRBP HUB.
   Переключателя масштаба больше нет: каждый график динамики стоит на оси
   янв.–дек., этот год против прошлого. Ориентир — тот же выбор, что везде:
   цель KPI или база, и только для текущего года. База не рисуется в двух
   случаях: у несравнимых метрик (там она вводит в заблуждение) и у метрик с
   утверждённым KPI — на полотне остаются пороги цели, и вторая пунктирная
   линия рядом с ними спорила бы с ними за роль ориентира.

   Все метрики — линиями (13.10, второй заход: счётные потоки барами с серой
   «тенью» прошлого года рядом с линиями сбивали с толку). Этот год — яркая
   линия, прошлый — бледная. */
/* цвет линии потока — тот же, что на вкладках блока: пришли — C_IN, ушли —
   C_OUT; одиночные метрики — кобальтом */
/* численность — серым (23.10), как во всех отчётах */
const YOY_COLOR={hc_total:G.C_CNT,hc_active:G.C_CNT,hc_avg:G.C_CNT,attrition:G.C_OUT,transfer_out:G.C_OUT,tgrowth_deny:G.C_OUT,
  hire:G.C_IN,transfer_in:G.C_IN,vac_closed:G.C_IN,tgrowth_pass:G.C_IN,vac_open:G.C_VAC,ai_wau:G.C_AI};
function yoyChart(key,lp,bl,S,opt){
  opt=opt||{};
  /* opt.noBench (26.10-б) — без линии базы: ряд не метрики целиком, а её части (текучесть по инициатору) */
  const kpi=D.kpiFor(key,S), cmp=D.comparable(key)&&!kpi&&!opt.noBench, bench=D.benchmarkLabel(S);
  /* opt.scale (22.10, посещаемость по сегменту и городу): ряд выбора — ряд отбора × коэффициент; opt.yser (поставка 66) —
     свой ряд «год к году» той же метрики (настоящая посещаемость выбранного сегмента) */
  const y0=opt.yser||D.yoySeries(lp,key), sc=opt.scale, mul=a=>a.map(v=>v==null?null:+(v*sc).toFixed(1));
  /* opt.ref (26.10, AI BI.md): свой пунктир вместо базы — {name, cur}: численность команды под WAU */
  const y=sc&&sc!==1?{cur:mul(y0.cur),prev:mul(y0.prev)}:y0, by=opt.ref?opt.ref.cur:cmp?D.yoySeries(bl,key).cur:null;
  const col=opt.color||YOY_COLOR[key]||G.C_LINE;
  /* счётный поток (найм, уход…) — бар этого года, позади прозрачный бар прошлого (15.10); численность — так же,
     серым (23.10) */
  const flow=G.asBars(key);
  const legend=(flow?[{name:String(D.YEAR_CUR),color:G.soft(col)},{name:String(D.YEAR_PREV),color:G.ghostCol(col),ghost:true}]
      :[{name:String(D.YEAR_CUR),color:col},{name:String(D.YEAR_PREV),color:G.C_PREV}])
    .concat(opt.ref?[{name:opt.ref.name,color:G.C_BENCH,dash:true}]:cmp?[{name:bench,color:G.C_BENCH,dash:true}]:[]);
  /* gap — заливка разрыва с базой светофором (итерация 32): где линия лучше
     базы — зелёным, где хуже — красным, в мёртвой зоне ±5% — без заливки */
  /* 31.10: итог за период под шапкой — по ряду графика (свой ряд — простым правилом); opt.period:false — без него */
  const period=opt.period===false?null:D.periodTotal(lp,key,opt.yser||sc&&sc!==1?y:null);
  return G.chart('yoy',{metricKey:key,cur:y.cur,prev:y.prev,bench:by},
    Object.assign({legend,benchName:opt.ref?opt.ref.name:bench,kpi:kpi,h:300,fill:true,gap:cmp&&!opt.ref,
      offDef:cmp&&!opt.ref?['bench']:null},opt,{color:col,period:period}));
}
/* Метрика главы: одно полотно «год к году» с ориентиром. Акценты истории
   (opt.ann) приходят по окну отчёта — на ось года их переводит draw.js. */
function metricLine(key,lp,bl,S,opt){return yoyChart(key,lp,bl,S,opt)}
/* 27.10-в, п. 5: длинный список — первые n и «Остальные», которые раскрываются вторым уровнем (как регион в «Структуре»);
   раскрытие помнит общий набор mixOpen под ключом rest:<k> */
function rest(ctx,k,n,word){return {top:n,restWord:word,restKey:'rest:'+k,restOpen:!!(ctx.mixOpen&&ctx.mixOpen.has('rest:'+k))}}
/* Несколько метрик одной главы — панели друг под другом, у каждой своя шкала
   и своя легенда «этот год / прошлый»; клик по ней скрывает линию во всех
   панелях графика. items: [{key, name, color, ann}] */
/* поставка 96 (заказчик): у долей в панелях — линия базы, как у одиночного графика; по умолчанию выключена (offDef) —
   opt.bl — листья базы, opt.S — выбор (имя базы) */
function yoyPanels(lp,items,opt){
  opt=opt||{};
  const cmp=k=>opt.bl&&D.comparable(k)&&!D.kpiFor(k,opt.S);
  return G.chart('panels',{panels:items.map(it=>{
    const y=D.yoySeries(lp,it.key);
    return {name:it.name,key:it.key,cur:y.cur,prev:y.prev,color:it.color||YOY_COLOR[it.key]||G.C_LINE,ann:it.ann||null,
      period:D.periodTotal(lp,it.key),bench:cmp(it.key)?D.yoySeries(opt.bl,it.key).cur:null};
  })},Object.assign({h:520,fill:true,benchName:opt.bl?D.benchmarkLabel(opt.S):'',offDef:['bench'],
    /* третий пункт — для переключателя серий (легенда панелей рисуется у каждой панели своя) */
    legend:[{name:String(D.YEAR_CUR)},{name:String(D.YEAR_PREV)}].concat(opt.bl&&items.some(it=>cmp(it.key))?[{id:'bench',name:'база'}]:[])},opt,{bl:null,S:null}));
}
/* Пара встречных потоков (пришли / ушли) на оси года — «ежики»: приход
   барами вверх, уход вниз, прошлый год — прозрачными барами позади (15.10). opt.legend — имена
   двух потоков; пункты «этот год» и «прошлый» добавляются здесь. */
function yoyPair(lp,aKey,bKey,opt){
  const raw=opt&&opt.legend||[], src=raw.map(it=>Object.assign({},it,{color:G.soft(it.color)}));
  const cA=raw[0]?raw[0].color:G.C_IN, cB=raw[1]?raw[1].color:G.C_OUT;
  const lg=src.concat([{name:String(D.YEAR_CUR),split:[G.soft(cA),G.soft(cB)]},
    {name:String(D.YEAR_PREV),split:[cA,cB],ghost:true}]);
  /* 31.10: итог пары — оба потока за период, у каждого — год назад */
  const pa=D.periodTotal(lp,aKey), pb=D.periodTotal(lp,bKey), lc=x=>String(x||'').charAt(0).toLowerCase()+String(x||'').slice(1);
  const period=pa&&pb?{head:pa.head,c:pa.c,strip:pa.strip,parts:[{name:lc(lg[0]&&lg[0].name),cur:pa.cur,prev:pa.prev},{name:lc(lg[1]&&lg[1].name),cur:pb.cur,prev:pb.prev}]}:null;
  return G.chart('pair',{a:Object.assign({key:aKey},D.yoySeries(lp,aKey)),b:Object.assign({key:bKey},D.yoySeries(lp,bKey))},
    Object.assign({h:300,fill:true,aName:lg[0]&&lg[0].name,bName:lg[1]&&lg[1].name,period:period},opt||{},{legend:lg}));
}

/* Значение того же месяца год назад — прямо из расширенной сетки, а не
   «значение минус изменение»: у доли без знаменателя изменения нет. */
function yearAgo(lp,key){return D.aggregateExt(lp,key)[D.NEXT-13-(D.closedOnly(key)?1:0)]}

/* ---------- пробник: что на вкладке — заглушка ----------
   В Proteus (TP_REAL) живые только метрики и ряды из hr_structure_overall:
   численность, движение, текучесть, regret и оценки. Разбивки по атрибутам,
   которых в таблице нет, и метрики без источника — демо на генераторе, и
   вкладка говорит об этом плашкой над содержимым. '*' — все под-вкладки блока. */
/* ---------- Что на вкладке в разработке (14.10) ----------
   t — что здесь не настоящее, need — что нужно (иначе — из плана этапа),
   part — вкладка частично живая. '*' — все под-вкладки блока. Одна карта и
   для плашки над содержимым, и для отметки шага, и для пункта меню блока. */
/* t — что здесь условно, для руководителя (TEXT_GUIDE.md): без таблиц и полей */
const DEV_TABS={
  /* 15.10, разведка 3: разрезы состава и увольнений — в основной таблице. Условны
     только пересечения разрезов (срез по клику, «разрез × разрез») и то, чего в
     таблице нет: регион, специализации внутри стримов (формат работы — с 16.10) */
  /* 21.10: точный срез (таблица состава ноутбука) снимает «оценочные» пересечения —
     прототип вкладок по файлу «Структура» показан без плашек */
  structure:{},
  hiring:{vacancies:{stage:2,t:'Вакансии и срок закрытия пока условные.'},
    plan:{stage:2,part:true,t:'Принятые — настоящие. План найма и статусы вакансий пока условные.'},
    profile:{stage:2,part:true,t:'Общий найм — настоящий. Каналы и грейды принятых пока условные.'}},
  tgrowth:{'*':{stage:6,t:'Заявки на T-рост и решения по ним пока условные.'}},
  /* 21.10: «Рабочая активность» по файлу Антона — прототип на демо-данных, без плашки */
  monitor:{
    review:{stage:5,t:'Итоги ревью пока условные.'}},
  office:{'*':{stage:7,t:'Посещаемость и бронирование пока условные.'}},
  ai:{'*':{stage:8,t:'Данные об AI-инструментах пока условные.'}}
};
/* Колонки разведки 12.10 оживляют часть вкладок: решения и конверсию T-роста
   и посещаемость за месяц. Там отметки нет, на соседних — уточнённый текст:
   что из блока живое, а что ещё нет. Без колонок — прежние записи DEV_TABS. */
const DEV_LIVE={
  /* поставка 50 (21.10, из прод-ноутбуков HQ и УС): вакансии, найм по источникам и AI — живые */
  hiring:{live:['vac_open','vac_closed','time_to_fill'],subs:['vacancies','profile'],
    '*':{stage:2,part:true,t:'Принятые, вакансии и найм по источникам — настоящие. План найма и статусы воронки пока условные.'}},
  ai:{live:['ai_penetration','ai_wau'],subs:['adoption'],
    '*':{stage:8,t:'Проникновение и активные пользователи по месяцам — настоящие (вкладка «Пользуются ли AI?»). Кто и как пользуется — пока условно: нужна недельная AI-выгрузка по людям.'}},
  tgrowth:{live:['tgrowth_conv'],subs:['flow'],
    '*':{stage:6,t:'Решения по заявкам и конверсия — настоящие (вкладка «Растут ли люди внутри?»). '+
      'Как растут по грейдам и меняют специализацию — пока условно: нужны данные сервиса «Рост».'}},
  office:{live:['office_att'],subs:[],
    part:{attend:{stage:7,part:true,t:'Посещаемость по месяцам — настоящая. Сегменты и города пока условные.'}},
    '*':{stage:7,t:'Посещаемость за месяц — настоящая (вкладка «Кто и где ходит?»). '+
      'Календарь по дням, сегменты, города и бронирование пока условные.'}}
};
/* поставка 71 (параграфы «Роста» Адели): статусы роста и заявки по грейдам и специализациям пришли — без отметки */
if(D.ROST_LIVE){DEV_LIVE.tgrowth.subs.push('grades','spec');delete DEV_LIVE.tgrowth['*']}
/* поставка 66 (посещения Адели): вкладки «Офиса», чьи данные пришли в ответе, — без отметки */
if(D.OFF_LIVE){
  const o=DEV_LIVE.office, L=D.OFF_LIVE, rest=[];
  if(L.cal)o.subs.push('calendar');else rest.push('календарь по дням');
  if(L.seg&&L.city)o.subs.push('attend');
  else if(L.seg||L.city)o.part.attend={stage:7,part:true,t:'Посещаемость по месяцам и '+(L.seg?'сегменты':'города')+
    ' — настоящие. '+(L.seg?'Города':'Сегменты')+' пока условные.'};
  if(!L.seg)rest.push('сегменты');
  if(!L.city)rest.push('города');
  if(L.bk){o.live.push('booking_viol');o.subs.push('booking')}else rest.push('бронирование');
  if(rest.length<4)o['*']={stage:7,t:'Посещаемость за месяц — настоящая. '+rest.join(', ').replace(/^./,c=>c.toUpperCase())+
    ' пока условные.'};
}
function devOf(bk,sub){
  const lv=DEV_LIVE[bk];
  if(lv&&lv.live.every(k=>!D.isDev(k)))return lv.subs.indexOf(sub)>=0?null:(lv.part&&lv.part[sub])||lv['*'];
  const d=DEV_TABS[bk]||{};
  return d[sub]||d['*']||null;
}
/* Блок целиком: 'full' — все под-вкладки в разработке, 'part' — часть, '' — живой */
function blockDev(bk){
  const subs=(blocks[bk]||{}).subTabs||[], st=subs.map(t=>devOf(bk,t[0]));
  if(!subs.length||!st.some(Boolean))return '';
  return st.every(x=>x&&!x.part)?'full':'part';
}
/* Плашка над содержимым вкладки. В пробнике вывод главы по заглушке не
   строится (book → demo): утверждать по сгенерированной цифре нельзя. */
function demoNoteFor(bk,sub){return D.REAL&&devOf(bk,sub)?'1':''}

/* ---------- Вывод блока (20.10) ----------
   Одна карточка: слева огонёк и вывод, справа «где это происходит»; фон — градиент по
   тяжести, как у выводов главной. Таблица и главы под ней всегда открыты.
   sum — TPINSIGHTS.blockSummary: заголовок, до трёх фактов по номерам и «Что
   сделать». Фактов нет — «всё спокойно» и что именно проверено. */
const BK_TAG={high:'Требует действий',mid:'Посмотреть',good:'Хорошая новость',none:'Всё спокойно'};
function conclusion(sum,b,S){
  let head=sum.head, facts, todo=sum.todo;
  if(!sum.list.length){
    const vis=D.visibleMetricsOfBlock(b.key,S).filter(m=>!D.isStub(m.key)), cmp=vis.filter(m=>D.comparable(m.key)||D.kpiFor(m.key,S));
    head='Заметных отклонений нет';
    facts='<div class="bk-pl">'+(cmp.length?'<span class="bk-p"'+U.tipAttr({title:'Что проверили',
        text:'Ни одна метрика не отличается от ориентира на '+INS.INS_GAP+'% и больше и не сдвинулась заметно за год.'})+
        '>проверили <b>'+cmp.length+' '+U.plural(cmp.length,['метрику','метрики','метрик'])+'</b> — отклонений нет</span>'
        :'<span class="bk-p">метрики блока — количества, смотрим тренды</span>')+
      '<span class="bk-p">ничего не ухудшается '+INS.INS_TREND+' мес. подряд</span></div>';
    todo='Отдельных действий не нужно.';
  }
  /* 30.10, шаг 2 («полаконичнее, поменьше букв»): вывод — заголовок, пилюли (метрики вывода с ориентиром и
     главные факты первой проблемы: люди, где) и одно действие; три абзаца фактов сняты */
  if(facts==null){
    const lead=sum.list.find(c=>c.sev!=='good')||sum.list[0];
    const kp=sum.list.slice(0,3).map(c=>'<span class="bk-p '+c.sev+'">'+c.kp+'</span>');
    /* «где» — уже в заголовке и в панели справа, «год назад» — в пилюле метрики */
    const more=(lead.pills||[]).filter(t=>!/^(год назад|почти всё|больше половины)/.test(t)).map(t=>'<span class="bk-p">'+t+'</span>');
    facts='<div class="bk-pl">'+kp.concat(more).join('')+'</div>';
  }
  /* огонёк по настроению вывода (20.10, заказчик): тревога, насторожен, улыбка, спокоен */
  const op=window.TPSCREENS.onepager||{}, ico=op.moodIco?op.moodIco(op.MOOD_ICO[sum.sev],52,BK_TAG[sum.sev]):'';
  return '<div class="bk-sum '+sum.sev+'">'+ico+'<div class="bk-sx"><div class="bk-tag">Вывод блока · '+BK_TAG[sum.sev]+'</div>'+
    '<div class="bk-h">'+esc(head)+'</div>'+facts+
    '<div class="bk-do">'+todo+'</div></div></div>';
}
/* 31.10: «Где это происходит» в «Саммари» снята (файл итерации, п. 2 и 6) — функция wherePanel удалена */

/* ---------- рендер детальной вкладки ----------
   view — состояние показа, которое в ссылку не едет: tq — поиск по таблице. */
function renderBlock(S,expanded,mixOpen,view){
  const b=D.BLOCK_BY_KEY[S.tab];
  const mod=blocks[b.key];
  /* под-вкладка проверяется по списку блока: после перекомпоновки вкладок ссылка
     с ?sub=speed или ?sub=conv ведёт в никуда, и экран собирался бы наполовину */
  if(!S.subTab||!mod.subTabs.some(t=>t[0]===S.subTab))S.subTab=mod.defaultSub;
  /* 31.10-б, п. 6: фильтр покраски «Рост HQ» не меняет; файл 6, п. 4: вкладка — только по численности HQ (в пробнике — ряды и
     разрезы датасета с покраской HQ вместо выбранной, cond_rh; в макете — команды HQ) */
  if(b.key==='tgrowth'&&S.paint!=='HQ')S=Object.assign({},S,{paint:'HQ'});
  const root=currentRoot(S), rootNode=D.NODE_BY_PATH[root];
  const rl=D.reportLeaves(S), bl=D.benchmarkLeaves(S);
  const mainK=blockMain(b.key,S);
  /* Срез состава живёт только на «Структуре численности» и только там читается.
     Гейт по блоку не перестраховка: подпись «N чел» под именем подразделения
     стоит на КАЖДОЙ вкладке, и без него срез, взятый в составе, молча ужимал бы
     численность в оттоке и найме — там, где его никто не брал и не видит.
     Режутся только счётные метрики численности, остальное `lastValSlice`
     пропускает через обычную агрегацию (`D.sliceable`). */
  const slice=b.key==='structure'?D.sliceParse(S.mixSel):[];
  const selIds=slice.map(p=>p.id);
  /* поставка 90 (заказчик: «однозначная интерпретация цифр»): колонки таблицы подразделений — то же число, что итог за
     период под графиком: потоки и доли — с января по закрытый месяц, накопительные — на его конец, состояния — сейчас;
     окно подписано под названием колонки. Структура — состояния на сегодня со срезом (lastValSlice) */
  const ov=TBL_OVR[b.key]||{}, P0={}, pt=k=>P0[k]||(P0[k]=D.periodTotal(rl,k)||{});
  const val=(lp,key)=>b.key==='tgrowth'&&key==='hc_total'&&D.ROST_NODE?D.rostHc(lp):
    b.key==='structure'||pt(key).stock?D.lastValSlice(lp,key,selIds):(D.periodTotal(lp,key)||{}).v;
  /* mets — выбранные пользователем метрики блока. Отсюда и столбцы сводной
     таблицы, и KPI-карточки над ней. Графики в правой панели от набора
     не зависят: они рисуют смысл блока, а не список метрик. */
  const mets=D.visibleMetricsOfBlock(b.key,S).filter(m=>!(ov.hide&&ov.hide[m.key]));
  /* поставка 99: окно периода названо в шапке вкладки — под колонкой подписаны только исключения («сейчас», «на конец …») */
  const perOf=k=>b.key==='structure'||pt(k).lab===D.PER_SPAN?'':pt(k).lab||'';

  if(!rl.length){
    return '<div class="page-h"><h2>'+esc(b.name)+'</h2><p>'+esc(b.hint)+'</p></div>'+
      U.empty('Под эти фильтры никто не попал','Снимите один из фильтров в шапке.');
  }
  const tq=String(view&&view.tq||'').trim();
  const isEmpty=p=>!rowLeaves(p,S).length;
  /* свои колонки таблицы (мониторинг, 21.10): {k, name, tip, val(md) | spark(md), share};
     md — данные блока по листьям строки (mod.data). Шапка сортирует: по убыванию, по
     возрастанию, снова как в оргдереве. */
  const tcols=mod.cols||null, tdata=tcols?(lp=>mod.data?mod.data(lp):D.monData(lp)):null;
  const ts=String(S.tsort||'').split(':'), tsc=tcols&&tcols.find(c=>c.k===ts[0]&&c.val), tsd=ts[1]==='a'?1:-1;
  const cmp=tsc?(a,b)=>{const x=tdata(rowLeaves(a.path,S)), y=tdata(rowLeaves(b.path,S));
    return tsd*((x?tsc.val(x):0)-(y?tsc.val(y):0))}:null;
  const rows=pivotRows(root,expanded,isEmpty,tq,cmp);
  /* инсайт про концентрацию считается по первому уровню всегда — от
     раскрытий и набранного поиска он зависеть не должен */
  const baseRows=pivotRows(root,new Set(),isEmpty);
  /* выбранной может быть только строка внутри юнита отчёта: после перехода
     прежний выбор указывал бы мимо таблицы */
  const sel=S.selNode&&D.NODE_BY_PATH[S.selNode]&&S.selNode.indexOf(root+'/')===0?S.selNode:root;
  const selNode=D.NODE_BY_PATH[sel];

  /* 1 · заголовок: название слева, переход на детальный дашборд справа.
     Метрика с KPI из «сравнимых с базой» вычтена: она сравнивается с целью,
     и обещать по ней базу в подзаголовке было бы неправдой. */
  const kpiMets=mets.filter(m=>D.kpiFor(m.key,S));
  const cmpMets=mets.filter(m=>D.comparable(m.key)&&!D.kpiFor(m.key,S));
  const cmpTxt=(cmpMets.length
      ? 'Сравниваем с базой <b>'+esc(D.benchmarkLabel(S))+'</b>.'
      : kpiMets.length?'':'Здесь количества — с базой они не сравниваются.')+
    (kpiMets.length?' Где есть цель KPI — с целью.':'');
  /* «Детальный дашборд» ведёт туда, где блок есть в Proteus: при покраске HQ —
     в HQ-версию 34136, иначе в общую 34661; HQ-блоки — всегда в 34136. */
  const dash=D.blockDash(b.key,S);
  let h='<div class="page-h"><div class="ph-row"><h2>'+esc(b.name)+'</h2>'+
    '<a class="btn dash" href="'+(dash?dash.href:b.drillUrl)+'" target="_blank" rel="noopener"'+
    (dash?U.tipAttr({title:'Детальный дашборд',text:'«'+dash.name+'» в Proteus — все графики этого блока.',
      note:dash.only?'':'Для покраски HQ откроется HQ-версия.'}):'')+
    '>Детальный дашборд'+U.icoExt()+'</a></div>'+
    '<p>'+esc(b.hint)+' '+cmpTxt+'</p>'+
    /* поставка 83: охват данных вкладки (у «Рост HQ» — только HQ) — сразу под описанием, до вывода и графиков */
    (b.scope?'<p class="ph-scope">'+esc(b.scope)+'</p>':'')+'</div>';

  /* 2 · вывод блока и где это происходит (20.10, одобрено: «сначала вывод → где
     это происходит → таблица»). Факты — те же карточки, что на главной. */
  const sum=INS.blockSummary(b.key,S,rl,bl);
  /* 31.10, файл итерации п. 2 и 6: в «Саммари» только короткий текстовый вывод — таблица «Где это происходит» снята на
     всех вкладках (подразделения — в таблице ниже), блок в одну колонку и ниже по высоте */
  h+='<div class="bk-top '+sum.sev+' solo">'+conclusion(sum,b,S)+'</div>';

  /* 4 · KPI блока
     Дельта и ориентир разведены по строкам карточки: в первой — изменение и
     месяц, с которым оно сравнивается, во второй — цель KPI или база. Пока
     они стояли в одной строке, «+3» и «база 4,1%» читались как одно
     сравнение, хотя это два разных. Классы n2…n5 держат ровно столько колонок,
     сколько метрик: у движения персонала их теперь пять. */
  /* n1…n8: колонок ровно столько, сколько метрик. После итерации 28 у движения
     персонала их семь — полоса на ноутбуке переносится на два ряда по четыре. */
  /* свой KPI-полосы блок (мониторинг, 21.10): снимок недели по выбранной строке таблицы */
  /* 23.10: у «Структуры численности» KPI-полосы нет — её единственная метрика (численность) уже стоит в «Итого»
     таблицы; на её месте — полка среза */
  /* 27.10-в, п. 20: «Переводы в» и «Переводы из» — одной карточкой «Переводы» (в − из) на месте первой из них */
  /* KPI-карточки блока сняты (29–30.10), их код удалён в поставке 85 */

  /* 4a · что сейчас срезано. Плашка стоит под карточками, а не только в той
     таблице, по которой кликнули: без неё «191 → 59» в карточке выглядит
     поломкой отчёта, а не ответом на свой же клик. */
  /* 22.10: полка срезов — у вкладок со срезами (структура — срез состава, посещаемость — сегмент и
     локация); sticky. 23.10: только когда что-то выбрано — пустой нет */
  /* 31.10 (поставка 82): отдельной полки больше нет — выбранное пилюлями в шапке карточки графиков (ниже, selChips) */

  /* 5 · две колонки. Когда колонок метрик шесть и больше (движение персонала,
     найм после итерации 28), сводной таблице нужно больше места, чем графику:
     левая колонка становится шире — иначе главная метрика и «К базе» уезжали
     за край панели под горизонтальную прокрутку. */
  const wideL=tcols?true:mets.length>=7;
  /* Таблица подразделений — по выбору (итерация 32): m-both — таблица слева,
     графики справа (по умолчанию: таблица — основа фильтрации), m-charts —
     графики во всю ширину; share — доля
     таблицы после перетаскивания разделителя (null — раскладка по умолчанию).
     Разметка всегда полная — обе панели и разделитель, — а что видно, решает CSS:
     ниже 1121px (широкой таблице — 1241px) показанная таблица встаёт над графиками. */
  const sp=view&&view.split||{};
  /* 30.10, шаг 2: у маленькой команды (нет подразделений ниже или меньше 30 человек) таблица по умолчанию
     свёрнута в полоску слева — графики во всю ширину; выбор пользователя (sp.mode) — главнее */
  const hcR=D.lastVal(rl,'hc_total'), smallTeam=!INS.unitsOf(S).length||(hcR!=null&&hcR<INS.CARD.small);
  const mode=sp.mode==='charts'||sp.mode==='both'?sp.mode:smallTeam?'charts':'both', share=sp.share!=null?sp.share:null;
  /* 31.10 (поставка 82, заказчик): всё, что выбрано кликом, — пилюлями в строке над обеими карточками: срез меняет и
     таблицу слева, и графики справа. Подразделение (действует на всех вкладках), срез структуры, сегмент и город
     посещаемости. Строка липкая и всегда одной высоты: выбрали или сняли — ничего не сдвигается; в покое — подсказка,
     что можно кликнуть */
  const selChips=(sel!==root?[{dim:'Подразделение',cat:selNode.name,attr:'data-selnode="'+esc(root)+'"',
      tip:'Графики и главы — по этому подразделению, на всех вкладках. × — вернуть «'+D.NODE_BY_PATH[root].name+'» целиком.'}]:[])
    .concat(b.key==='structure'?U.sliceChips(slice,'Таблица и графики — по срезу, база и выводы — по всей команде.')
      :mod.shelfChips?mod.shelfChips(S):[]);
  h+='<div class="sel-row">'+(selChips.length?'<span class="sel-lbl">Выбрано</span>'+U.selBar(selChips)+
    (sel!==root&&!selNode.direct?U.openUnitBtn(sel,selNode.name,'Открыть'):''):
    /* единственное место с общей подсказкой про клик (поставка 82): в сносках и «Что с этим делать» её больше нет;
       тонкости (Shift+клик, Escape) — в подсказке при наведении */
    '<span class="sel-hint"'+U.tipAttr({title:'Как выбрать',text:b.key==='structure'?
      'Shift+клик — добавить ещё одну категорию того же разреза. Выборы по разным разрезам складываются. Escape — снять всё.'
      :'Повторный клик или Escape — снять выбор.'})+'>'+(b.key==='structure'?'Клик по подразделению, куску полосы или строке таблицы — таблица и графики покажут только выбранное'
      :mod.shelfChips&&S.subTab==='attend'?'Клик по подразделению, сегменту или городу — таблицы и динамика покажут только выбранное'
      :'Клик по подразделению в таблице — графики покажут только его, на всех вкладках')+'</span>')+'</div>';
  h+='<div class="split'+(wideL?' wide-l':'')+' m-'+mode+(share!=null?' custom':'')+'" id="bk-det"'+
    (share!=null?' style="--split-l:'+(share*100).toFixed(2)+'fr;--split-r:'+((1-share)*100).toFixed(2)+'fr"':'')+'>';

  /* Состояние каретки ИТОГО: пока раскрыто не всё — она предлагает раскрыть,
     и только когда раскрыты все раскрываемые строки — свернуть. */
  const expandable=expandableRows(root);
  const allOpen=expandable.length>0&&expandable.every(p=>expanded.has(p));

  /* 5a · сводная таблица подразделений
     Колонки «К базе» / «К цели KPI» больше нет (итерация 32, заказчик: «непонятно,
     по какой логике он появляется»). Ориентир — база или цель — живёт в
     KPI-карточках над таблицей и на графиках главы. */
  /* 26.10, ревью критиков (правило UI-24, как у карточек): у подразделения меньше 30 человек доля неустойчива. 27.10:
     значение не прячем (прочерк читался как пропавшие данные) — серым, с подсказкой и строкой-пояснением под таблицей */
  const SMALL=INS.CARD.small, isSm=hc=>hc&&hc<SMALL;
  let anySm=false;
  const smAttr=(hc,cls)=>{anySm=true;return ' class="small-n'+(cls?' '+cls:'')+'"'+U.tipAttr({title:'Меньше '+SMALL+' человек',
    text:'Один человек сдвигает долю на '+(100/hc).toFixed(1).replace('.',',')+' п.п.'})};
  const tcell=(c,md,lead,unit)=>{
    if(!md)return '<td>—</td>';
    const v=c.val&&c.val(md), hc=tcols[0].val(md);
    if(c.spark)return '<td'+(unit&&isSm(hc)?smAttr(hc,'sp'):' class="sp"')+'>'+c.spark(md)+'</td>';
    if(v==null)return '<td'+U.tipAttr({title:c.name,text:'Появится с витриной мониторинга по неделям.'})+'>—</td>';
    return '<td'+(lead?' class="lead"':'')+(c.share?U.tipAttr({title:c.name,rows:[{label:'Человек',value:D.fmtInt(v)},{label:'От численности',value:hc?(Math.round(v/hc*1000)/10).toFixed(1).replace('.',',')+'%':'—'}]}):'')+'>'+D.fmtInt(v)+'</td>';
  };
  const totalCells=tcols?tcols.map((c,i)=>tcell(c,tdata(rl),i===1)).join('')
    :mets.map(m=>'<td'+(m.key===mainK?' class="lead"':'')+'>'+D.fmtVal(m.key,val(rl,m.key))+'</td>').join('');
  let tbl='<table class="ptable dense tree"><thead><tr><th class="txt"'+
    U.tipAttr({title:'Подразделение',text:'Три уровня вниз от «'+rootNode.name+'».\nГлубже — выберите строку и нажмите значок у её названия.'})+'>Подразделение</th>'+
    (tcols?tcols.map(c=>{const on=tsc===c;return '<th'+(c.val?' class="tsort'+(on?' on':'')+'" data-tsort="'+(on&&tsd<0?c.k+':a':on?'':c.k+':d')+'"':'')+
        U.tipAttr({title:c.name,text:c.tip,note:c.val?(on?(tsd<0?'Сейчас — по убыванию. Клик — по возрастанию.':'Сейчас — по возрастанию. Клик — как в оргдереве.'):'Клик — сортировать по убыванию.'):null})+'>'+
        esc(c.name)+(on?'<span class="ts-ar">'+(tsd<0?'↓':'↑')+'</span>':'')+(c.per?'<span class="th-per">'+esc(c.per)+'</span>':'')+'</th>'}).join('')
    /* 27.10, Антон (вопрос 1): период — в подсказке шапки (метка в самой шапке расширяла таблицу и сжимала правую панель) */
    :mets.map(m=>'<th'+U.tipAttr({title:m.name+(perOf(m.key)?' — '+perOf(m.key):''),text:U.metricText(m,1),note:pt(m.key).head?
      pt(m.key).head+' — как итог под графиком.':null})+'>'+esc(m.short)+
      (D.isDev(m.key)?U.devTag(D.devStage(m.key),true):'')+(perOf(m.key)?'<span class="th-per">'+esc(perOf(m.key))+'</span>':'')+'</th>').join(''))+
    '</tr></thead><tbody>'+
    /* ИТОГО первой строкой: при длинном списке итог не должен уезжать под скролл.
       Каретка у ИТОГО раскрывает и сворачивает ВСЁ дерево разом: раскрывать
       десяток подразделений по одному, чтобы увидеть вторые уровни, — работа,
       которую строка итога может сделать одним кликом. Заодно «ИТОГО» встаёт
       на ту же вертикаль, что и названия подразделений под ним: без каретки
       оно было сдвинуто влево на её ширину. */
    '<tr class="total top"><td class="txt"><span class="row-label">'+
    /* при поиске дерево раскрыто принудительно — общей каретке там делать нечего */
    (expandable.length&&!tq
      ? '<button class="caret-btn"'+(allOpen?' data-open="1"':'')+
        ' data-expall="'+(allOpen?'0':'1')+'" aria-label="'+(allOpen?'Свернуть всё':'Развернуть всё')+'"'+
        U.tipAttr({title:allOpen?'Свернуть всё':'Развернуть всё',
          text:'Все три уровня подразделений разом.'})+'>'+
        (allOpen?'▾':'▸')+'</button>'
      : '<span class="caret-spacer"></span>')+
    '<span class="row-body">ИТОГО</span></span></td>'+totalCells+
    '</tr>';
  rows.forEach(r=>{
    const lp=rowLeaves(r.n.path,S);
    const canExp=!tq&&r.kids>0&&r.depth<TREE_DEPTH, isOpen=expanded.has(r.n.path), isSel=sel===r.n.path;
    /* На границе глубины подразделения ниже не показаны — говорим, сколько их
       и как до них дойти. Число — прямые подразделения, а не все потомки. */
    const below=r.depth===TREE_DEPTH&&r.kids>0?r.kids:0;
    tbl+='<tr class="urow'+(r.depth>1?' lvl'+r.depth:'')+(r.empty?' empty':'')+(isSel?' sel':'')+
      (tq?(r.hit?' hit':' anc'):'')+'" data-node="'+r.n.path+'">'+
      '<td class="txt"><span class="row-label">'+
      (canExp?'<button class="caret-btn"'+(isOpen?' data-open="1"':'')+' data-exp="'+r.n.path+'" aria-label="'+
        (isOpen?'Свернуть':'Раскрыть')+'">'+(isOpen?'▾':'▸')+'</button>':'<span class="caret-spacer"></span>')+
      /* поставка 83: наведение на подразделение — численность, ФИ и логин руководителя */
      '<span class="row-body"'+U.unitTip(r.n.name,D.fmtVal('hc_total',val(lp,'hc_total'))+' чел',r.n.head)+'>'+(tq?U.hlText(r.n.name,tq):esc(r.n.name))+
      /* 31.10 (поставка 82, «перегруз под названием»): без уровня и ФИО — численность и логин руководителя */
      '<span class="unit-sub">'+(r.n.direct?'без подразделения · ':'')+
        D.fmtVal('hc_total',val(lp,'hc_total'))+' чел'+
      (below?' · <span class="below"'+U.tipAttr({title:'Ниже ещё '+below+' '+U.plural(below,['подразделение','подразделения','подразделений']),
          text:'Таблица показывает три уровня вниз.\nГлубже — выберите строку и нажмите значок у её названия.'})+
        '>ниже ещё '+below+'</span>':'')+
      /* руководитель — в той же второй строке: строка таблицы везде в две строки текста (16.10) */
      (U.unitHead(r.n)?' · '+U.unitHead(r.n,tq):'')+'</span></span>'+
      /* переход — только у выбранной строки: клик по строке выбирает, а не уводит */
      /* «Напрямую в «X»» — не юнит, открывать нечего */
      (isSel&&!r.n.direct?U.openUnitBtn(r.n.path,r.n.name):'')+'</span></td>'+
      (tcols?tcols.map((c,i)=>tcell(c,tdata(lp),i===1,1)).join('')
      :mets.map(m=>{const hc=val(lp,'hc_total'), ld=m.key===mainK?'lead':'';
        return '<td'+(m.fmt==='pct'&&isSm(hc)&&!D.directNA(r.n,m.key)?smAttr(hc,ld):ld?' class="lead"':'')+'>'+
        (D.directNA(r.n,m.key)?'—':D.fmtVal(m.key,val(lp,m.key)))+'</td>'}).join(''))+'</tr>';
  });
  /* пустые состояния — строкой в таблице, а не вместо неё: ИТОГО остаётся */
  const ncol=1+(tcols?tcols.length:mets.length);
  if(!rows.length)tbl+='<tr class="tree-empty"><td class="txt" colspan="'+ncol+'">'+
    (tq?'В трёх уровнях вниз нет «'+esc(tq)+'». Другое подразделение компании выберите в «Настрой свой дашборд».'
      :'У «'+esc(rootNode.name)+'» нет подразделений уровнем ниже — все цифры в строке ИТОГО.')+'</td></tr>';
  if(anySm)tbl+='<tr class="tree-note"><td class="txt" colspan="'+ncol+'">Серым — доли подразделений меньше '+SMALL+
    ' человек: они неустойчивые.</td></tr>';
  tbl+='</tbody></table>';
  /* Подсказка о глубине — в подзаголовке панели: три уровня вниз, глубже —
     переходом. Пока взят срез состава, подзаголовок говорит о нём. */
  h+=U.panel({cls:'split-l',title:'Подразделения',
    /* 31.10 (поставка 82): что выбрано — в строке «Выбрано» над карточками, здесь не повторяем */
    subHtml:'три уровня вниз · глубже — значок '+U.icoOpen(),
    tabs:U.searchBox({q:view&&view.tq||'',placeholder:'Название, логин, ФИО'})+U.unitHide(),
    body:tbl,bodyCls:'tbl-wrap'})+U.splitGut(share)+U.unitRail(INS.unitsOf(S).length);

  /* 5b · правая панель — история блока по главам (итерация 32, концепция B).
     Глава = под-вкладка. TPSTORY считает по выбранному узлу вопрос, ответ и
     сигнал каждой главы (степпер), вывод и факты текущей главы и что подписать
     на её графиках (ctx.ann — экраны передают это в опции графиков). */
  const ctx={S,b,sub:S.subTab,lp:rowLeaves(sel,S),rl,bl,rows:baseRows,root,sel,
    mixOpen:mixOpen||new Set(),benchLabel:D.benchmarkLabel(S)};
  const bookC=STY.book(b.key,mod.subTabs,S.subTab,{S,lp:ctx.lp,bl,sel,bench:ctx.benchLabel},
    k=>!!demoNoteFor(b.key,k));
  const ch=bookC.cur;
  ctx.ann=ch.ann||{};ctx.story=ch;
  /* шаг в разработке помечен прямо в степпере — вкладку видно, не открывая */
  bookC.chapters.forEach(c=>{const d=devOf(b.key,c.key);c.dev=d?(d.part?'part':'full'):'';c.devStage=d?d.stage:null});
  const body=U.story({
    steps:U.chapters(bookC.chapters,S.subTab),
    head:U.storyHead(ch.head,ch.lede,ch.act,ch.why,ch.todo),
    main:U.devNote(devOf(b.key,S.subTab))+mod.view(ctx),
    rail:U.storyRail({facts:ch.facts,focus:ch.focus,act:ch.act})});
  /* У выбранной строки переход дублируется в шапке правой панели — рядом
     с её именем, там, куда смотрят, читая её графики. */
  h+=U.panel({cls:'split-r',title:mod.title(S.subTab),
    subHtml:esc(selNode.name)+(sel!==root?'':' · всё подразделение')+
      (bookC.chapters.length>1?' · вкладка '+(bookC.idx+1)+' из '+bookC.chapters.length:'')+
      /* поставка 99: окно чисел вкладки — один раз здесь, а не в каждой строке (у структуры — состояния на сегодня) */
      (b.key==='structure'?'':' · <b>'+esc(D.PER_NAME)+'</b> против того же периода '+D.YEAR_PREV),
    body:body,bodyCls:'st-on',foot:true});

  return h+'</div>';
}

window.TPSCREENS={blocks,renderBlock,currentRoot,rowLeaves,blockMain,pivotRows,
  expandableRows,devOf,blockDev,metricLine,rest,yoyChart,yoyPanels,yoyPair,yearAgo,TREE_DEPTH};
})();
