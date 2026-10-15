import assert from 'node:assert/strict';
const base = process.argv[2];
const cookies = new Map();
async function request(path, init = {}) {
  const response = await fetch(base + path, { ...init, redirect: 'manual', headers: { cookie: [...cookies].map(([k,v]) => k+'='+v).join('; '), ...init.headers } });
  for (const header of response.headers.getSetCookie()) { const item=header.split(';')[0];const i=item.indexOf('=');cookies.set(item.slice(0,i),item.slice(i+1)); }
  return response;
}
for (const [path, method] of [['/api/projects','POST'],['/api/payroll/approve','POST'],['/api/scurve','GET'],['/api/documents','GET'],['/api/users','POST']]) {
  assert.equal((await request(path,{method})).status,401,path);
}
assert.equal((await request('/api/seed')).status,410);
assert.equal((await request('/finance')).status,307);
const csrf=await (await request('/api/auth/csrf')).json();
const login=await request('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',origin:base},body:new URLSearchParams({csrfToken:csrf.csrfToken,email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD,callbackUrl:base+'/dashboard'})});
assert.ok([200,302,303].includes(login.status),'Login response');
const session=await (await request('/api/auth/session')).json();
assert.equal(session.user?.email,process.env.ADMIN_EMAIL,'Admin login');
assert.equal(session.user?.role,'TOP_MANAGEMENT');
assert.equal((await request('/api/documents')).status,200,'Authenticated database query');
const dashboard=await request('/dashboard');console.log('Dashboard response',dashboard.status,dashboard.headers.get('location'));assert.equal(dashboard.status,200,'Dashboard');
assert.equal((await request('/api/projects',{method:'POST',headers:{origin:'https://attacker.invalid','Content-Type':'application/json'},body:'{}'})).status,403,'Cross-origin write blocked');
console.log('PASS: anonymous API denial, protected page redirect, seed disabled, admin login, database query, dashboard, cross-origin write denial.');
