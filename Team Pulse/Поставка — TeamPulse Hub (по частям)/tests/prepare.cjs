'use strict';
const assert=require('assert/strict'), fs=require('fs'), path=require('path'), vm=require('vm');
const {execFileSync}=require('child_process');
const factory=require('../src/data-factory.cjs');
const patches=require('../src/patches.cjs');
const root=path.join(__dirname,'../..');
const realSource=fs.readFileSync(path.join(root,'proteus/real.js'),'utf8');
const ordinarySource=fs.readFileSync(path.join(root,'data.js'),'utf8');
const splitSource=patches.read(root,'data.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const json=x=>JSON.stringify(x,(_,v)=>{
  const tag=Object.prototype.toString.call(v);
  return tag==='[object Set]'||tag==='[object Map]'?Array.from(v):v;
});
const fixtures=JSON.parse(execFileSync(process.env.PYTHON_BIN||'python3',['-c',
  "import importlib.util,json,sys; s=importlib.util.spec_from_file_location('fixture',sys.argv[1]); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(json.dumps([m.dataset('all',[],rich=True),m.dataset('all',[dict(column='unit_f',value=['A'])],rich=True),m.dataset('all',[],rich=True,zero=True)]))",
  path.join(__dirname,'fixture_server.py')],{encoding:'utf8'}));
// Core is a valid complete row envelope with no optional detail payload. It is
// deliberately different from the settled fixture, including stream presence.
const core=clone(fixtures[0]).filter(r=>r.role!=='peer');
core.forEach(r=>{r.mx=''});
const fullParts=Object.freeze({have:Object.freeze({people:true,flow:true,aux:true}),late:Object.freeze([])});
const coreParts=Object.freeze({have:Object.freeze({people:false,flow:false,aux:false}),late:Object.freeze(['aux'])});
const context=()=>{const c={window:{TP_TIMING:{measure:(_,fn)=>fn()}}};vm.createContext(c);vm.runInContext(realSource,c);return c};
function load(c,rows,parts,source,prepare){
  c.window.TP_REAL=c.window.TPREAL.build(clone(rows));c.window.TP_PARTS=parts;
  vm.runInContext(prepare?factory(source):'(function(){\n'+source+'\n})();',c);
  return c.window.TPDATA;
}
function facts(D){
  // Optional APIs may reject an incomplete core; compare that behavior too,
  // without treating a missing optional dataset as a fabricated zero result.
  const probe=fn=>{try{return {value:fn()}}catch(e){return {error:e.name+': '+e.message}}};
  const states=['active','all'].map(hcType=>({...clone(D.DEFAULT_STATE),hcType}));
  return states.map(S=>{
    D.setHcMode(S.hcType);const verdict=D.setVerdictScope(S);
    const lp=D.reportLeaves(S),bl=D.benchmarkLeaves(S);
    return {hc:D.hcMode(),verdict,scope:D.REAL.scopePath,applied:D.REAL.applied,
      metrics:D.METRICS.map(m=>({key:m.key,stub:D.isStub(m.key),
        report:D.periodTotal(lp,m.key),base:D.periodTotal(bl,m.key)})),
      office:probe(()=>D.offDays(lp)),growth:probe(()=>D.rostProfile(lp)),
      weeks:probe(()=>D.aiWeeks(lp)),ai:probe(()=>D.aiUsage(lp)),
      peer:D.REAL.peer,streams:D.MIX_BY_KEY.stream};
  });
}
function snapshot(D){const f=facts(D);return json({facts:f,exports:D})}

// The lexical wrapper itself must be exactly equivalent to executing the same
// module normally, including its exported constants, readiness and closures.
for(const [label,rows,parts] of [
  ['rich',fixtures[0],fullParts],['filtered',fixtures[1],fullParts],
  ['zeros',fixtures[2],fullParts],['incomplete core',core,coreParts],
]){
  const ordinary=context(),candidate=context(),synchronous=context();
  const golden=load(ordinary,rows,null,ordinarySource,false);
  const sync=load(synchronous,rows,parts,splitSource,false);
  const prepared=load(candidate,rows,parts,splitSource,true);
  assert.equal(snapshot(prepared),snapshot(sync),label+': all serializable exports and exercised closures');
  assert.equal(json(facts(prepared)),json(facts(golden)),label+': ordinary golden metric/model semantics');
  assert.equal(json(prepared.partsWait('onepager')),json(sync.partsWait('onepager')));
  assert.equal(json(prepared.partsLate('onepager')),json(sync.partsLate('onepager')));
}

const c=context(),active=load(c,core,coreParts,splitSource,true);
active.setHcMode('active');active.setVerdictScope(active.DEFAULT_STATE);
const globals={real:c.window.TP_REAL,data:c.window.TPDATA,parts:c.window.TP_PARTS};
const before=json({real:globals.real,data:active});
const nextReal=c.window.TPREAL.build(clone(fixtures[1]));
const inputBefore=json(nextReal);
const next=c.TP_PREPARE_DATA(nextReal,fullParts);
assert.strictEqual(next.REAL,nextReal,'factory retains only its supplied model');
assert.notStrictEqual(next,active);
assert.equal(json(nextReal),inputBefore,'preparing API does not eagerly mutate supplied model');
assert.strictEqual(c.window.TP_REAL,globals.real);
assert.strictEqual(c.window.TPDATA,globals.data);
assert.strictEqual(c.window.TP_PARTS,globals.parts);
assert.equal(json({real:globals.real,data:active}),before,'active model and API remain untouched');
assert.equal(json(active.partsWait('onepager')),json(['people','flow','aux']));
assert.equal(json(next.partsWait('onepager')),json([]));
next.setHcMode('all');next.setVerdictScope(next.DEFAULT_STATE);
assert.equal(active.hcMode(),'active','candidate settings are isolated from live closures');
assert.equal(json(active.partsLate('onepager')),json(['aux']),'candidate cannot publish readiness');

// Discarded candidates and failed preparation must leave the published API
// usable, even when another candidate is prepared for a different selection.
const discarded=c.TP_PREPARE_DATA(c.window.TPREAL.build(clone(fixtures[2])),fullParts);
assert.notStrictEqual(discarded,next);
assert.strictEqual(c.window.TPDATA,active);
vm.runInContext(factory(splitSource.replace('window.TPDATA={',
  'throw new Error("synthetic preparation failure");\nwindow.TPDATA={'))
  .replace('window.TP_TIMING.measure("data",TP_REBUILD_DATA);',''),c);
assert.throws(()=>c.TP_PREPARE_DATA(nextReal,fullParts),/synthetic preparation failure/);
assert.strictEqual(c.window.TP_REAL,globals.real);
assert.strictEqual(c.window.TPDATA,active);
assert.strictEqual(c.window.TP_PARTS,globals.parts);
assert.equal(active.hcMode(),'active');

// The legacy synchronous entry still initializes/publishes immediately. This
// remains the first-core/new-filter path; scheduling is tested separately.
vm.runInContext(factory(splitSource).replace('window.TP_TIMING.measure("data",TP_REBUILD_DATA);',''),c);
c.window.TP_REAL=nextReal;c.window.TP_PARTS=fullParts;c.TP_REBUILD_DATA();
assert.notStrictEqual(c.window.TPDATA,active);
assert.strictEqual(c.window.TPDATA.REAL,nextReal);
assert.equal(json(c.window.TPDATA.partsWait('onepager')),json([]));
assert.throws(()=>factory('window.TPDATA={}'),/incompatible data factory source/);
// A future shared-module dependency must fail the build instead of silently
// reading undefined from the candidate's private window. The guard parses JS:
// documentation and string content are not executable global dependencies.
for(const added of [
  'window.localStorage;', 'window.TP_ENV;', 'window["TP_REAL"];',
  'window[key];', 'window?.TP_REAL;', 'const alias=window;',
  'const {TP_REAL:alias}=window;', 'consume(window);',
  'globalThis.window.TP_REAL;', 'self["window"].TP_REAL;',
])assert.throws(()=>factory(splitSource+'\n'+added),/unsupported window dependency/,added);
const extraComment='\n// window.localStorage and const alias=window are documentation only.\n';
const extraString='const futureDocumentation="window.TP_ENV, window[key], globalThis.window";\n';
assert.doesNotThrow(()=>factory(splitSource+extraComment+extraString));
// Keep the generated runtime identical: the AST audit is build-time only.
assert.equal(factory(splitSource),'function TP_PREPARE_DATA(real,parts){\n'+
  'const window={TP_REAL:real,TP_PARTS:parts};\n'+splitSource+'\nreturn window.TPDATA;\n}\n'+
  'function TP_REBUILD_DATA(){\nwindow.TPDATA=TP_PREPARE_DATA(window.TP_REAL,window.TP_PARTS);\n}\n'+
  'window.TP_TIMING.measure("data",TP_REBUILD_DATA);');
console.log('PASS: isolated preparation, complete/filtered/zero/core golden semantics, independent settings/readiness, discarded and failed candidates, synchronous initialization');
