import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base='https://prohaba-center.vercel.app',cookies=new Map(),checked=[];
async function request(path,init={}){const response=await fetch(base+path,{...init,redirect:'manual',headers:{cookie:[...cookies].map(([key,value])=>key+'='+value).join('; '),...init.headers}});for(const header of response.headers.getSetCookie()){const entry=header.split(';')[0],at=entry.indexOf('=');cookies.set(entry.slice(0,at),entry.slice(at+1));}return response;}
for(const path of ['/api/documents','/api/scurve','/api/audit-log'])assert.equal((await request(path)).status,401,path);
assert.equal((await request('/finance')).status,307);
const csrf=await(await request('/api/auth/csrf')).json();
await request('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',origin:base},body:new URLSearchParams({csrfToken:csrf.csrfToken,email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD,callbackUrl:base+'/dashboard'})});
const session=await(await request('/api/auth/session')).json();assert.equal(session?.user?.role,'TOP_MANAGEMENT');
for(const path of ['/dashboard','/projects','/documents','/scurve','/finance','/hr','/payroll','/procurement','/material-request','/revenue','/site-purchase','/workshop','/logistik','/master-data','/users','/audit-log']){const response=await request(path);assert.equal(response.status,200,path);const html=await response.text();assert.ok(html.includes('class="sidebar'),path+' sidebar');checked.push(path);}
assert.equal((await request('/api/documents')).status,200);
writeFileSync('.vercel/production-readonly-result.json',JSON.stringify({at:new Date().toISOString(),login:true,anonymousDenied:true,sidebar:true,pages:checked},null,2));
console.log('PASS: production login, anonymous denial, sidebar and',checked.length,'read-only pages. No business mutations performed.');
