// Read-only Geoapify autocomplete comparison for Issue #465. No app/DB writes.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const key=process.env.GEOAPIFY_DIAGNOSTIC_KEY?.trim();
if(!key) throw Error("STAGING_GEOAPIFY_API_KEY missing; zero provider requests.");
const centers={
  Stockholm:{lon:18.0710935,lat:59.3251172},
  Göteborg:{lon:11.97456,lat:57.70887},
};
const cases=[
  ["Stockholm","Falloumi"],["Stockholm","Gamla Enskede matbod"],
  ["Stockholm","Ox Lan"],["Stockholm","Pelikan"],
  ["Stockholm","Pasta r"],["Stockholm","Knife"],
  ["Stockholm","The Border"],["Stockholm","Pizza"],
  ["Göteborg","Falloumi"],["Göteborg","Pasta r"],
  ["Göteborg","Pizza"],
];
const radii=[null,25,50,100];
const observations=[],errors=[];
let requestCount=0,reservedCredits=0,lastStart=0,stop=false;
function normalize(s){return String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("sv-SE").trim();}
function distanceKm(a,b){
  if(!Number.isFinite(b?.lat)||!Number.isFinite(b?.lon))return null;
  const r=Math.PI/180,x=(b.lat-a.lat)*r,y=(b.lon-a.lon)*r;
  const v=Math.sin(x/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(y/2)**2;
  return Math.round(6371*2*Math.asin(Math.min(1,Math.sqrt(v)))*10)/10;
}
function safe(x){return String(x??"").replaceAll("|","/").replaceAll("\n"," ").slice(0,160);}
async function probe([city,text],radius){
  if(requestCount>=64||reservedCredits>=100)throw Error("Diagnostic request/credit limit reached");
  requestCount++;reservedCredits++;
  const point=centers[city],url=new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.searchParams.set("text",text);
  url.searchParams.set("type","amenity");
  url.searchParams.set("format","geojson");
  url.searchParams.set("lang","sv");
  url.searchParams.set("limit","10");
  url.searchParams.set("bias","proximity:"+point.lon+","+point.lat);
  if(radius!==null)url.searchParams.set("filter","circle:"+point.lon+","+point.lat+","+(radius*1000));
  url.searchParams.set("apiKey",key);
  const delay=Math.max(0,lastStart+550-Date.now());
  if(delay)await new Promise(r=>setTimeout(r,delay));
  lastStart=Date.now();
  const started=performance.now();
  const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error("HTTP "+response.status+" / "+city+" / "+text+" / "+radius);
  const data=await response.json();
  if(!Array.isArray(data?.features))throw Error("Unexpected provider result / "+city+" / "+text);
  const results=data.features.map(f=>{
    const p=f?.properties||{};
    const name=typeof p.name==="string"?p.name:"";
    return {name,city:p.city||p.county||"",country:p.country_code||"",
      distanceKm:distanceKm(point,p),
      key:String(p.place_id||"")+":"+normalize(name)};
  });
  const row={center:city,query:text,radiusKm:radius,ms:Math.round(performance.now()-started),
    total:results.length,results,
    over100:results.filter(x=>x.distanceKm!==null&&x.distanceKm>100).length,
    international:[...new Set(results.map(x=>x.country).filter(x=>x&&x!=="se"))],
    within5:results.filter(x=>x.distanceKm!==null&&x.distanceKm<=5).length,
    matchedName:results.filter(x=>normalize(x.name).includes(normalize(text))).length};
  observations.push(row);
  return row;
}
function report(){
  const out=resolve(process.env.DIAGNOSTIC_OUTPUT_DIR||"search-diagnostic");
  mkdirSync(out,{recursive:true});
  const comparisons=[];
  for(const [city,text] of cases){
    const group=observations.filter(o=>o.center===city&&o.query===text);
    const base=group.find(x=>x.radiusKm===null);
    for(const radius of [25,50,100]){
      const filtered=group.find(x=>x.radiusKm===radius);
      if(!base||!filtered)continue;
      const lostLocal=base.results.filter(x=>x.distanceKm!==null&&x.distanceKm<=radius &&
        !filtered.results.some(y=>y.key===x.key)).map(x=>({name:x.name,distanceKm:x.distanceKm}));
      comparisons.push({center:city,query:text,radiusKm:radius,lostLocal,
        removedInternational:base.results.filter(x=>x.country&&x.country!=="se").length-
          filtered.results.filter(x=>x.country&&x.country!=="se").length,
        newlyVisible:filtered.results.filter(x=>!base.results.some(y=>y.key===x.key))
          .map(x=>({name:x.name,distanceKm:x.distanceKm})),
      });
    }
  }
  const multis=[];
  for(const text of ["Falloumi","Pasta r","Pizza"]){
    for(const radius of radii){
      const rows=observations.filter(o=>o.query===text&&o.radiusKm===radius);
      if(rows.length===2)multis.push({query:text,radiusKm:radius,
        perCenter:rows.map(x=>({center:x.center,results:x.total})),
        unionCount:new Set(rows.flatMap(x=>x.results.map(y=>y.key))).size});
    }
  }
  const obj={commit:process.env.GITHUB_SHA||"local",readOnly:true,requests:requestCount,
    conservativeReservedCredits:reservedCredits,samples:cases.length,
    observations,comparisons,multipleCentres:multis,errors,
    caveats:["One request per setting; provider can vary over time.",
      "Only top 10 per provider call; filtering can introduce unseen local results.",
      "Circle filter may hide a specifically named distant venue; compare with bias-only results.",
      "Saved areas remain unconstrained search origins, not access boundaries.",
      "No authenticated browser/Supabase/identity verification in this experiment."]};
  writeFileSync(resolve(out,"geo-filter-results.json"),JSON.stringify(obj,null,2));
  const lines=["# Geoapify Autocomplete: bias kontra geografiskt filter","",
    "Read-only verkliga staging-provideranrop; inga databas- eller appändringar.",
    "Anrop: "+requestCount+". Konservativt reserverade krediter: "+reservedCredits+".",
    "","| Centrum | Text | Filter | Tid ms | Träffar | Inom 5 km | Över 100 km | Utländska koder | Exempel (km) |",
    "|---|---|---|---:|---:|---:|---:|---|---|"];
  for(const o of observations)lines.push("| "+[o.center,o.query,o.radiusKm===null?"endast bias":o.radiusKm+" km",o.ms,o.total,o.within5,o.over100,o.international.join(", "),o.results.slice(0,3).map(x=>x.name+" "+(x.distanceKm??"?")).join("; ")].map(safe).join(" | ")+" |");
  lines.push("","## Lokala träffar från bias-baseline som saknas med filter");
  const lost=comparisons.filter(x=>x.lostLocal.length);
  lines.push(...(lost.length?lost.map(x=>"- "+x.center+" / "+x.query+" / "+x.radiusKm+" km: "+x.lostLocal.map(p=>safe(p.name)+" ("+p.distanceKm+" km)").join(", ")):["- Inga bland testens tio baseline-förslag."]));
  lines.push("","## Union av separata sökcentrum");
  lines.push(...multis.map(x=>"- "+x.query+" / "+(x.radiusKm??"bias")+" km: "+x.perCenter.map(y=>y.center+"="+y.results).join(", ")+", union="+x.unionCount));
  lines.push("","## Eventuella HTTP-fel",...(errors.length?errors.map(x=>"- "+safe(x)):["- Inga"]));
  const summary=lines.join("\n")+"\n";
  writeFileSync(resolve(out,"geo-filter-summary.md"),summary);
  console.log(summary);
}
try{
  for(const sample of cases)for(const radius of radii){
    if(stop)break;
    try{await probe(sample,radius);}
    catch(e){errors.push(String(e?.message||e));if(/HTTP (401|403|429)|limit reached/.test(String(e?.message)))stop=true;}
  }
}finally{report();}
if(errors.length)throw Error("Geofilter diagnostic failed in "+errors.length+" cases; inspect artifact.");
if(observations.length!==cases.length*radii.length)throw Error("Incomplete Geoapify diagnostic.");
