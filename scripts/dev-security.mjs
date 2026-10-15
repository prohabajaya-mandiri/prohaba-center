import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
assert.equal(new URL(process.env.DATABASE_URL).searchParams.get('schema'), 'prohaba_dev', 'Only run against development');
const base=process.argv[2] ?? 'http://localhost:3000';const cookies=new Map();
async function req(path,init={}){const r=await fetch(base+path,{...init,redirect:'manual',headers:{cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...init.headers}});for(const h of r.headers.getSetCookie()){const item=h.split(';')[0],i=item.indexOf('=');cookies.set(item.slice(0,i),item.slice(i+1))}return r;}
const id=randomUUID();let project;
try{
 await prisma.user.create({data:{id,name:'Security smoke test',email:id+'@example.invalid',password:await bcrypt.hash('Temporary-test-'+id,10),role:'WORKSHOP'}});
 const csrf=await(await req('/api/auth/csrf')).json();await req('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',origin:base},body:new URLSearchParams({csrfToken:csrf.csrfToken,email:id+'@example.invalid',password:'Temporary-test-'+id})});
 assert.equal((await req('/api/users',{method:'POST'})).status,403);
 assert.equal((await req('/api/payroll/approve',{method:'POST'})).status,403);
 await prisma.user.update({where:{id},data:{isActive:false}});assert.equal((await req('/api/documents')).status,401);
 await prisma.user.update({where:{id},data:{isActive:true,role:'ENGINEERING'}});
 const csrf2=await(await req('/api/auth/csrf')).json();await req('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',origin:base},body:new URLSearchParams({csrfToken:csrf2.csrfToken,email:id+'@example.invalid',password:'Temporary-test-'+id})});
 project=await prisma.project.create({data:{code:'SMOKE-'+id,name:'Temporary security test',client:'test',location:'test',contractValue:0,startDate:new Date(),endDate:new Date()}});
 const form=new FormData();form.set('projectId',project.id);form.set('title','Private file test');form.set('docNumber',id);form.set('category','REPORT');form.set('file',new Blob(['%PDF-1.4\nSecurity smoke test']), 'test.pdf');
 console.log('Current role:',(await(await req('/api/auth/session')).json()).user?.role);const upload=await req('/api/documents',{method:'POST',headers:{origin:base},body:form});assert.equal(upload.status,201,'Private upload');const doc=await upload.json();
 assert.equal((await req(doc.fileUrl)).status,200,'Authorized download');assert.equal((await fetch(base+doc.fileUrl)).status,401,'Anonymous download denied');assert.equal((await req('/api/documents/'+doc.id,{method:'DELETE',headers:{origin:base}})).status,200,'Document delete');
 assert.equal(await prisma.documentContent.count({where:{documentId:doc.id}}),0,'File removed with document');
 console.log('PASS: role escalation blocked; disabled sessions revoked; private document upload/download/delete; anonymous download blocked.');
}finally{if(project)await prisma.project.delete({where:{id:project.id}});await prisma.auditLog.deleteMany({where:{userId:id}});await prisma.user.deleteMany({where:{id}});await prisma.$disconnect();}

