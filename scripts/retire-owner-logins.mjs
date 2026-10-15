import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
const ready=JSON.parse(readFileSync('.vercel/remediation-ready.json','utf8')),probe=JSON.parse(readFileSync('.vercel/production-readonly-result.json','utf8'));
if(ready.state!=='READY'||!probe.login||!probe.sidebar||probe.pages.length<16||new Date(probe.at)<new Date(ready.at))throw new Error('Verify the replacement production release before retiring old logins.');
const management=parseEnv(readFileSync('.env.management.local','utf8')),q=value=>"'"+value.replaceAll("'","''")+"'",pending=[];
let query='BEGIN;';
for(const [environment,owner,role]of [['production','prohaba_app','prohaba_migrate'],['development','prohaba_dev','prohaba_migrate_dev']]){
 const file='.env.migrations.'+environment+'.local',env=parseEnv(readFileSync(file,'utf8')),password=randomBytes(36).toString('hex');
 query+=`DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=${q(role)}) THEN CREATE ROLE ${role} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; END IF; END $$; ALTER ROLE ${role} PASSWORD ${q(password)}; GRANT ${owner} TO ${role}; ALTER ROLE ${role} SET search_path TO ${environment==='production'?'public':'prohaba_dev'}; ALTER ROLE ${owner} NOLOGIN;`;
 for(const key of ['DATABASE_URL','DIRECT_URL']){const url=new URL(env[key]);url.username=role+'.kdkoyvcdmwkrooywirzp';url.password=password;env[key]=url.toString();}
 const temporary=file+'.pending.local';writeFileSync(temporary,Object.entries(env).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n');pending.push([temporary,file]);
}
query+="COMMIT; SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename IN ('prohaba_app','prohaba_dev') AND pid<>pg_backend_pid();";
const response=await fetch('https://api.supabase.com/v1/projects/kdkoyvcdmwkrooywirzp/database/query',{method:'POST',headers:{Authorization:'Bearer '+management.SUPABASE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});if(!response.ok){writeFileSync('.vercel/retire-error.txt',await response.text());throw new Error('Owner login retirement failed: '+response.status);}
for(const [temporary,file]of pending)renameSync(temporary,file);
console.log('Old owner logins disabled; dedicated migration credentials saved locally.');
