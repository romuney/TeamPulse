'use strict';
const assert=require('assert/strict'), fs=require('fs'), path=require('path'), vm=require('vm');
const {execFileSync}=require('child_process');
const {patch}=require('../src/dict-cache.cjs');
const root=path.join(__dirname,'../..');
const original=fs.readFileSync(path.join(root,'proteus/real.js'),'utf8');
const replace=(src,from,to)=>{assert.equal(src.split(from).length,2,'unique patch anchor');return src.replace(from,to)};
const patched=patch(original,replace);
const make=source=>{const context={window:{__pvtState:{tp:{preserved:true}}}};vm.createContext(context);
  vm.runInContext(source.replace('function unarm(s){',
    'function unarm(s){window.decodeCalls=(window.decodeCalls||0)+1;'),context);return context};
const golden=make(original), candidate=make(patched);
// The existing fixture contains synthetic production-shaped optional metrics,
// details and peers. Python uses only its standard library for this generator.
const fixture=JSON.parse(execFileSync(process.env.PYTHON_BIN||'python3',['-c',
  "import importlib.util,json,sys; s=importlib.util.spec_from_file_location('fixture',sys.argv[1]); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(json.dumps(m.dataset('all',[],rich=True)))",
  path.join(__dirname,'fixture_server.py')],{encoding:'utf8'}));
const clone=x=>JSON.parse(JSON.stringify(x));
const ascii='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=~?@_'.replace('~','>');
const cyr='абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const arm=s=>Array.from(s).map(c=>cyr.includes(c)?ascii[cyr.indexOf(c)]:(ascii.includes(c)||c==='^'?'^'+c:c)).join('');
function encoded(rows){rows=clone(rows);const meta=rows.find(r=>r.role==='meta');
  meta.j=JSON.stringify({...JSON.parse(meta.j),enc:'a1'});
  rows.forEach(r=>{if(r.role!=='meta')for(const k of ['nm','j','mx'])if(r[k])r[k]=arm(r[k])});return rows}
function snapshot(m){
  const paths=[...m.nodes.map(n=>n.path),'BASE'];
  const keys=['hc_total','hire','attrition','transfer_in','transfer_out','vac_open','vac_closed','wday','ovis'];
  return JSON.stringify({model:m,optional:golden.window.TPREAL.OPT.map(k=>[k,m.has(k)]),
    rows:paths.map(p=>({p,series:keys.map(k=>[k,m.series(p,k)]),mix:m.mix(p),nodeMix:m.nodeMix(p),
      prof:m.prof(p),headcount:m.lastHc(p),id:m.idOf(p)}))},
    (_,v)=>Object.prototype.toString.call(v)==='[object Set]'?Array.from(v):v);
}
function compare(rows,label){const a=clone(rows),b=clone(rows);
  const ga=golden.window.TPREAL.build(a),cb=candidate.window.TPREAL.build(b);
  assert.equal(snapshot(cb),snapshot(ga),label+' model');
  assert.equal(JSON.stringify(b),JSON.stringify(a),label+' input mutations');return {a,b};}

const originalEncoded=encoded(fixture);
compare(originalEncoded,'first a1 decode');
const firstMemo=candidate.window.__pvtState.tp.dictDecoded;
const start=candidate.window.decodeCalls;
compare(originalEncoded,'same encoded dict with new row objects');
const secondCost=candidate.window.decodeCalls-start;
assert.strictEqual(candidate.window.__pvtState.tp.dictDecoded,firstMemo,'exact text cache hit');
const beforeGolden=golden.window.decodeCalls;compare(originalEncoded,'third same dict');
assert.equal(golden.window.decodeCalls-beforeGolden,secondCost+1,'only dict decoding is skipped');

const changed=clone(fixture);
changed.find(r=>r.role==='dict').j+='\nZ\tR\t2\t0\tЁж ^ ASCII[] !<>= 🐕\t\t0:0\tТест';
compare(encoded(changed),'changed dictionary and escaped text');
assert.notStrictEqual(candidate.window.__pvtState.tp.dictDecoded,firstMemo);
assert.deepEqual(Object.keys(candidate.window.__pvtState.tp.dictDecoded).sort(),['raw','text']);

// Decode reuse must survive module reload, just as TP_RUN redefines TPREAL.
vm.runInContext(patched,candidate);compare(encoded(changed),'module recreated with persistent store');
compare(fixture,'unencoded response after a1');
const otherScope=clone(fixture),meta=otherScope.find(r=>r.role==='meta');
meta.j=JSON.stringify({...JSON.parse(meta.j),scope:'A',req:['A'],paint:['Hq'],ok:0,as:'synthetic-scope'});
compare(encoded(otherScope),'changed scope/filter/access still rebuilt by golden parser');
compare(originalEncoded,'original raw dictionary replaces previous entry');
const missing=clone(originalEncoded).filter(r=>r.role!=='dict');compare(missing,'dictionary absent');

// The golden parser mutates rows. Reusing an already-mutated array must still
// behave identically, including redecoding, rather than assume input is fresh.
let {a,b}=compare(originalEncoded,'input before deliberate repeated use');
assert.equal(snapshot(candidate.window.TPREAL.build(b)),snapshot(golden.window.TPREAL.build(a)));
assert.equal(JSON.stringify(b),JSON.stringify(a),'reused mutated arrays remain exactly golden');
assert.equal(candidate.window.__pvtState.tp.preserved,true);
console.log('PASS: exact raw dict memo, golden model + input mutation parity, Unicode/escapes, scope/access/encoding, module reload, one-entry replacement');
