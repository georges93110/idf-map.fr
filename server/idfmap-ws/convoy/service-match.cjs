'use strict';
// Only five nearby triplets travel over the wire. Absolute route ordinals may
// differ (short workings, different lines); the ordered physical stops align them.
function validSegment(segment,index,last,validToken){
 if(!segment||segment.first!==Math.max(0,index-2)||!Array.isArray(segment.tokens)||
    segment.tokens.length!==Math.min(last,index+2)-segment.first+1)return false;
 return segment.tokens.every((token,i)=>{
  const at=segment.first+i;
  if(at===0||at===last)return token===null; // Missing neighbour is not a match.
  return token===null||validToken(token);
 });
}
function uniqueIndex(segment,token){
 if(!segment||!token)return -1;
 const first=segment.tokens.indexOf(token);
 return first<0||segment.tokens.lastIndexOf(token)!==first?-1:segment.first+first;
}
function serviceGap(a,b){
 if(a.service===b.service)return Math.abs(a.index-b.index); // Legacy exact service.
 const x=a.segment,y=b.segment;
 if(!x||!y)return Infinity;
 const here=x.tokens[a.index-x.first],there=y.tokens[b.index-y.first];
 const aInB=uniqueIndex(y,here),bInA=uniqueIndex(x,there);
 if(aInB<0||bInA<0)return Infinity;
 const delta=b.index-aInB;
 // Both current stops must be on the same ordered portion. A shared stop
 // before a split does not turn the entire remaining routes into one service.
 return bInA-a.index===delta?Math.abs(delta):Infinity;
}
function routeReference(plan){
 return {service:plan.service,index:plan.index,last:plan.last,
  ...(plan.segment?{segment:{first:plan.segment.first,tokens:plan.segment.tokens.slice()}}:{})};
}
module.exports={validSegment,serviceGap,routeReference};
