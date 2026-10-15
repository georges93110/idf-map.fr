import metro1Logo from './assets/img/idf-metro-1.svg';
// Identity follows the selected service, never destination text.
export function idfLinePresentation(state: any) {
  const uid=String(state.selectedLineUid||'');
  const number=String(state.lineNumber||'');
  const route=String(state.routeName||'').split(':')[0].trim();
  const base=import.meta.env.BASE_URL;
  const replacement=uid==='50000'||/bus de remplacement/i.test(number);
  const identity=replacement?route:number;
  if(replacement||/^(RER [AE]|M[eé]tro 1)$/i.test(identity)) {
    const file=/^RER A$/i.test(identity)?'C01849.svg':/^RER E$/i.test(identity)?'C01853.svg':/^M[eé]tro 1$/i.test(identity)?'idf-metro-1.svg':'';
    if(file)return {headerLogo:file==='idf-metro-1.svg'?metro1Logo:base+'lines/'+file,hideMode:true,name:identity};
  }
  if(uid==='10000'||/titus/i.test(number)) {
    const match=route.match(/titus\s*([12])\b/i)||number.match(/titus\s*([12])\b/i);
    return {networkLogo:'/game_manager/images/service-badges/reseau_titus.png',hideMode:true,name:match?match[1]:''};
  }
  if(uid==='10001'||/navette.*nogent/i.test(number))return {headerLogo:'/game_manager/images/service-badges/navette_nogent.png',hideMode:true,name:'Navette de Nogent'};
  if(uid==='30000'||/^scolaire$/i.test(number)||/^scolaire$/i.test(route))return {headerLogo:'/game_manager/images/service-badges/bus_school.png',hideMode:true,name:'Scolaire'};
  if(uid==='40000'||/^Express\s+\d+/i.test(number))return {name:/^Express\s+\d+/i.test(route)?route:number};
  return {};
}
