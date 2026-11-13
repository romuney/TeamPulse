/* Memoize only a pure text decoding result. No parsed nodes, access decision,
   filters or numerical model are cached. One exact raw string replaces the
   previous entry, so memory cannot grow with the number of visited units. */
'use strict';

function patch(src, replace) {
  const helper = `function unarmDict(s){
  const state=window.__pvtState||(window.__pvtState={});
  const store=state.tp||(state.tp={});
  const memo=store.dictDecoded;
  if(memo&&memo.raw===s)return memo.text;
  const text=unarm(s);
  store.dictDecoded={raw:s,text:text};
  return text;
}
`;
  src=replace(src,'function unarm(s){',helper+'function unarm(s){');
  // This call remains inside the golden parser's meta.enc === 'a1' branch.
  // Other row types, other fields and unencoded responses retain the same path.
  return replace(src,'if(r.j)r.j=unarm(str(r.j));',
    "if(r.j)r.j=str(r.role)==='dict'?unarmDict(str(r.j)):unarm(str(r.j));");
}

module.exports={patch};
