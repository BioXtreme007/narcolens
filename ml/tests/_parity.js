
const fs=require('fs'), vm=require('vm');
const ctx={console,Math,JSON,Object,Array,Set,Number,String,parseInt,document:{},unescape,encodeURIComponent};
vm.createContext(ctx);
vm.runInContext('var WELL_MODEL='+fs.readFileSync(process.argv[2],'utf8')+';', ctx);
vm.runInContext(fs.readFileSync(process.argv[3],'utf8')+';this.__f={wellFeatures,predictWell};', ctx);
const cases=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
let maxd=0, mism=0;
for(const c of cases){ const F=ctx.__f.wellFeatures(c.rid,c.well,c.white); F.x.forEach((v,i)=>maxd=Math.max(maxd,Math.abs(v-c.x[i])));
  const P=ctx.__f.predictWell(c.rid,F.x); if(P.label!==c.label) mism++; }
console.log(JSON.stringify({n:cases.length,max_feature_diff:maxd,label_mismatches:mism}));
