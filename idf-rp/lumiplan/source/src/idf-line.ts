import metro1Logo from './assets/img/idf-metro-1.svg';
// Identity follows the selected service, never destination text.
function legacyPresentation(state: any) {
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
    return {networkLogo:'/idf-rp/images/service-badges/reseau_titus.png',hideMode:true,name:match?match[1]:''};
  }
  if(uid==='10001'||/navette.*nogent/i.test(number))return {headerLogo:'/idf-rp/images/service-badges/navette_nogent.png',hideMode:true,name:'Navette de Nogent'};
  if(uid==='30000'||/^scolaire$/i.test(number)||/^scolaire$/i.test(route))return {headerLogo:'/idf-rp/images/service-badges/bus_school.png',hideMode:true,name:'Scolaire'};
  if(uid==='40000'||/^Express\s+\d+/i.test(number))return {name:/^Express\s+\d+/i.test(route)?route:number};
  return {};
}

// prefixImage is independent from badgeImage: false removes only the mode icon.
export function idfLinePresentation(state: any) {
  const legacy = legacyPresentation(state);
  const config = state.linePresentation;
  if (!config || typeof config !== 'object') return legacy;
  const result: any = {...legacy};
  if (config.badgeImage) {
    result.headerLogo = config.badge === false ? config.badgeImage : undefined;
    result.networkLogo = config.badge === false ? undefined : config.badgeImage;
  } else {
    result.headerLogo = undefined;
    result.networkLogo = undefined;
  }
  if (config.prefixImage !== undefined) {
    result.hideMode = config.prefixImage === false;
    result.prefixImage = config.prefixImage || undefined;
  }
  return result;
}
