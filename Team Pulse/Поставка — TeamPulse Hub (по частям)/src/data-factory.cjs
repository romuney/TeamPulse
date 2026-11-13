'use strict';
const path=require('path');
const dep=require('module').createRequire(path.join(__dirname,'../../proteus/build.js'));
const acorn=dep('acorn');

function checkWindowAccess(code){
  const tree=acorn.parse(code,{ecmaVersion:'latest',sourceType:'script'});
  const allowed=new Set(['TP_REAL','TP_PARTS','TPDATA']);
  function fail(){throw new Error('Split build: data factory has an unsupported window dependency')}
  function visit(node,parent){
    if(!node||typeof node.type!=='string')return;
    if(node.type==='Identifier'&&node.name==='window'){
      const direct=parent&&parent.type==='MemberExpression'&&parent.object===node&&
        !parent.computed&&!parent.optional&&allowed.has(parent.property.name);
      const existence=parent&&parent.type==='UnaryExpression'&&parent.operator==='typeof'&&parent.argument===node;
      if(!direct&&!existence)fail();
    }
    // An explicit global alias bypasses the private lexical window just as a
    // bare alias would. Treat either spelling as an incompatible dependency.
    if(node.type==='MemberExpression'&&node.object.type==='Identifier'&&
      ['globalThis','self','top','parent'].includes(node.object.name)&&
      ((!node.computed&&node.property.name==='window')||
       (node.computed&&node.property.type==='Literal'&&node.property.value==='window')))fail();
    for(const key of Object.keys(node)){
      const value=node[key];
      if(Array.isArray(value))value.forEach(child=>visit(child,node));
      else if(value&&typeof value==='object')visit(value,node);
    }
  }
  visit(tree,null);
}

// Run the unchanged data module against a private window-shaped input. Its
// closures retain this candidate model and readiness snapshot. Publishing the
// returned API belongs to the synchronous model + DOM commit in refresh.js.
module.exports=function dataFactory(code){
  checkWindowAccess(code);
  if(!code.includes('window.TPDATA={')||!code.includes('window.TP_REAL')||!code.includes('window.TP_PARTS')){
    throw new Error('Split build: incompatible data factory source');
  }
  return 'function TP_PREPARE_DATA(real,parts){\n'+
    'const window={TP_REAL:real,TP_PARTS:parts};\n'+code+'\nreturn window.TPDATA;\n}\n'+
    'function TP_REBUILD_DATA(){\nwindow.TPDATA=TP_PREPARE_DATA(window.TP_REAL,window.TP_PARTS);\n}\n'+
    'window.TP_TIMING.measure("data",TP_REBUILD_DATA);';
};
