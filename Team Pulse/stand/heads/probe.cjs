/* значения отчёта по хост-страницам чарта (для stand/heads/check_heads.py): node probe.cjs <список.json> → JSON на stdout */
const {chromium}=require('playwright');
const fs=require('fs');
const PROBE=fs.readFileSync(process.argv[3],'utf8');
(async()=>{
  const list=JSON.parse(fs.readFileSync(process.argv[2],'utf8')), out={};
  const b=await chromium.launch(), p=await b.newPage();
  for(const it of list){
    await p.goto('file://'+it.path);
    await p.waitForFunction(()=>window.TPDATA&&window.TPDATA.REAL,null,{timeout:20000});
    out[it.key]=await p.evaluate("("+PROBE+")()");
  }
  await b.close();
  process.stdout.write(JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(2)});
