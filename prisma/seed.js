import {prisma} from '../src/lib/prisma.js';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
try {
 if(process.env.VERCEL||process.env.NODE_ENV==='production'||new URL(process.env.DATABASE_URL).searchParams.get('schema')!=='prohaba_dev')throw new Error('Seed hanya untuk database development.');
 const email='admin@prohaba.co.id',existing=await prisma.user.findUnique({where:{email}});
 if(existing)console.log('Admin sudah tersedia. Tidak ada data diubah.');
 else {const password=randomBytes(24).toString('base64url');await prisma.user.create({data:{name:'Direktur Utama',email,password:await bcrypt.hash(password,12),role:'TOP_MANAGEMENT'}});writeFileSync('.env.admin.development.local','ADMIN_EMAIL='+JSON.stringify(email)+'\nADMIN_PASSWORD='+JSON.stringify(password)+'\n');console.log('Admin development dibuat; kredensial disimpan lokal di .env.admin.development.local.');}
} finally {await prisma.$disconnect();}
