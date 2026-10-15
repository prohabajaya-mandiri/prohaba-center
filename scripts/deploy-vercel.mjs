import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
const project='prj_HY4hyQqRAZNC74hCzLdQ2RBcfc4O',team='team_FZcdU7toXUA6qTBVJ0poIPx4',root='https://api.vercel.com',suffix='?teamId='+team;
const management=parseEnv(readFileSync('.env.management.local','utf8')),production=parseEnv(readFileSync('.env.production.local','utf8')),development=parseEnv(readFileSync('.env','utf8'));
async function api(path,method='GET',body){const response=await fetch(root+path+(path.includes('?')?'&teamId='+team:suffix),{method,headers:{Authorization:'Bearer '+management.VERCEL_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok){const details=await response.text();writeFileSync('.vercel/deploy-error.txt',details);throw new Error('Vercel '+method+' failed: '+response.status);}const raw=await response.text();return raw?JSON.parse(raw):{};}
mkdirSync('.vercel',{recursive:true});
const {envs}=await api('/v9/projects/'+project+'/env');
for(const entry of envs)if(['DIRECT_URL','SUPABASE_TOKEN','VERCEL_TOKEN'].includes(entry.key))await api('/v9/projects/'+project+'/env/'+entry.id,'DELETE');
for(const [target,env]of [[['production'],production],[['development','preview'],development]])for(const key of ['DATABASE_URL','AUTH_SECRET'])await api('/v10/projects/'+project+'/env?upsert=true','POST',{key,value:env[key],type:'encrypted',target});
await api('/v10/projects/'+project+'/env?upsert=true','POST',{key:'AUTH_URL',value:production.AUTH_URL,type:'encrypted',target:['production']});
await api('/v9/projects/'+project,'PATCH',{nodeVersion:'22.x',buildCommand:'npm run verify',installCommand:'npm ci'});
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(dir+'/'+entry.name):[dir+'/'+entry.name]);
const names=[...['src','public','prisma','scripts','tests','docs','.github'].flatMap(walk),'package.json','package-lock.json','next.config.mjs','prisma.config.ts','eslint.config.mjs','jsconfig.json','README.md'];
const secrets=readdirSync('.').filter(name=>name.startsWith('.env')&&name!=='.env.example').flatMap(name=>Object.entries(parseEnv(readFileSync(name,'utf8'))).filter(([key])=>/TOKEN|SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|KEY/.test(key)).map(([,value])=>value)).filter(value=>value.length>=16);
const files=names.map(file=>{if(/(^|\/)\.env|\.bak\./.test(file))throw new Error('Unexpected deployment file');const buffer=readFileSync(file);for(const secret of secrets)if(buffer.includes(Buffer.from(secret)))throw new Error('Secret detected in '+file);return {file,data:buffer.toString('base64'),encoding:'base64'};});
const deployment=await api('/v13/deployments','POST',{name:'prohaba-center',project,target:'production',files,projectSettings:{framework:'nextjs',nodeVersion:'22.x',buildCommand:'npm run verify',installCommand:'npm ci'}});
writeFileSync('.vercel/remediation-deployment.json',JSON.stringify({id:deployment.id,url:deployment.url,state:deployment.readyState,files:files.length,at:new Date().toISOString()},null,2));
console.log(JSON.stringify({id:deployment.id,state:deployment.readyState,files:files.length}));
