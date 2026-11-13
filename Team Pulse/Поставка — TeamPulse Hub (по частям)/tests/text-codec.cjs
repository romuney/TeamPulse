'use strict';
const assert=require('assert/strict'), fs=require('fs'), path=require('path'), vm=require('vm');
const codec=require('../src/text-codec.cjs');
const root=path.join(__dirname,'../..');
const dep=require('module').createRequire(path.join(root,'proteus/build.js'));
const acorn=dep('acorn'), min=dep('./min.cjs');
acorn.parse(codec.runtime,{ecmaVersion:5,sourceType:'script'});
const browser={atob:p=>Buffer.from(p,'base64').toString('latin1')};
vm.createContext(browser);vm.runInContext(codec.runtime,browser);
let random=1;
const large=Array.from({length:300000},()=>{
  random=(Math.imul(random,1664525)+1013904223)>>>0;
  return String.fromCharCode(32+(random>>>16)%95);
}).join('');
const texts=['','a','aaaaaa','ababababab','Текучесть · 0% — 🐕',
  '\0\u007f\u0080\u07ff\u0800\uffff',large,
  min.cssMin(fs.readFileSync(path.join(root,'styles.css'),'utf8')),
  fs.readFileSync(path.join(root,'index.html'),'utf8')];
for(const original of texts){
  const packed=codec.pack(original);
  assert.equal(browser.TP_UNPACK(packed),original);
  assert.deepEqual(Buffer.from(browser.TP_UNPACK(packed)),Buffer.from(original));
}
assert.throws(()=>codec.pack('\ud800'),/roundtrip/);
assert.throws(()=>browser.TP_UNPACK('AA=='),/Invalid packed/);
console.log('PASS: ES5 text decoder, UTF-8/emoji, empty/repeated text, full dictionary, exact CSS/HTML bytes');
