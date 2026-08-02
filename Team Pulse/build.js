/* ============================================================================
   build.js — сборка всего отчёта в ОДИН self-contained HTML: node build.js

   Зачем: разработка идёт по файлам (правишь один экран — читаешь 3 КБ, а не
   40 КБ), а конечному инструменту нужен единый файл без внешних зависимостей.

   Что делает:
     1. читает index.html, находит все <link rel=stylesheet> и <script src>;
     2. подставляет содержимое файлов внутрь <style> и <script>;
     3. внешние CDN-ссылки НЕ инлайнит, а вырезает и сообщает об этом —
        единый файл не должен зависеть от сети. Шрифт Inter деградирует до
        Helvetica/Arial, это заложено в стек font-family.

   Результат: index.standalone.html рядом — файл, который уходит заказчику.
   Плюс копия в корне репозитория как index.html — точка входа GitHub Pages.
   Зависимостей у скрипта нет.
   ========================================================================== */
const fs=require('fs'), path=require('path'), dir=__dirname;

const OUT='index.standalone.html';
let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const dropped=[], inlined=[];

function read(rel){return fs.readFileSync(path.join(dir,rel),'utf8')}
/* Внутри <script>/<style> последовательность "</" закрыла бы тег раньше времени.
   В нашем коде её нет, но подстраховаться дешевле, чем потом искать причину. */
function safe(code){return code.replace(/<\/(script|style)/gi,'<\\/$1')}

/* ---------- стили ---------- */
html=html.replace(/[ \t]*<link[^>]*rel="stylesheet"[^>]*>\s*\n?/gi,m=>{
  const src=(m.match(/href="([^"]+)"/)||[])[1]||'';
  if(/^https?:/i.test(src)){dropped.push(src);return''}
  inlined.push(src);
  return '<style>\n'+safe(read(src))+'\n</style>\n';
});
/* preconnect к CDN шрифтов в автономном файле бессмыслен */
html=html.replace(/[ \t]*<link[^>]*rel="preconnect"[^>]*>\s*\n?/gi,'');

/* ---------- скрипты ---------- */
html=html.replace(/[ \t]*<script[^>]*src="([^"]+)"[^>]*>\s*<\/script>\s*\n?/gi,(m,src)=>{
  if(/^https?:/i.test(src)){dropped.push(src);return''}
  inlined.push(src);
  return '<script>\n'+safe(read(src))+'\n</script>\n';
});

fs.writeFileSync(path.join(dir,OUT),html);

/* ---------- точка входа GitHub Pages ----------
   Тот же самый файл, положенный в корень репозитория как index.html.
   Без него короткий адрес вида <user>.github.io/<repo>/ отдаёт 404: в корне
   нет index.html, а отчёт лежит в подпапке, да ещё и с пробелом в имени —
   ссылку с %20 неудобно пересылать.

   Копия, а не редирект: редирект показывает вспышку и уводит адресную строку
   обратно на длинный путь. Копии не разъедутся, потому что пишет их одна
   сборка — правится только исходник, обе цели обновляются вместе. */
const ROOT_OUT=path.join(dir,'..','index.html');
fs.writeFileSync(ROOT_OUT,html);

const kb=n=>(n/1024).toFixed(1)+' КБ';
console.log('Собрано: '+OUT+'  '+kb(html.length));
console.log('Точка входа Pages: ../index.html  '+kb(html.length));
console.log('Встроено файлов: '+inlined.length);
inlined.forEach(f=>console.log('  + '+f.padEnd(26)+kb(read(f).length)));
if(dropped.length){
  console.log('\nВырезаны внешние ссылки (единый файл не должен зависеть от сети):');
  dropped.forEach(d=>console.log('  − '+d));
}
if(/src="(?!data:)[^"]+"|href="(?!#|data:)[^"]*\.(css|js)"/i.test(html)){
  console.log('\nВНИМАНИЕ: в результате остались внешние ссылки — проверь index.html');
  process.exit(1);
}
console.log('\nВнешних зависимостей не осталось.');
