import {canAccess} from '@/lib/access';
import {auth} from '@/lib/auth';
import {redirect} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import AppLayout from '@/components/AppLayout';
import ListPager from '@/components/ListPager';
import {pageQuery} from '@/lib/page-query';
import RevenueClient from './RevenueClient';
export default async function RevenuePage({searchParams}){const session=await auth();if(!session?.user)redirect('/login');if(!canAccess(session.user.role,'/revenue'))redirect('/dashboard');const p=await pageQuery(searchParams);const [invoices,total,projects,accounts,downPayments]=await Promise.all([prisma.salesInvoice.findMany({skip:p.skip,take:p.take,include:{project:{select:{name:true}}},orderBy:{createdAt:'desc'}}),prisma.salesInvoice.count(),prisma.project.findMany({where:{status:{not:'ARCHIVED'}},select:{id:true,code:true,name:true,client:true},take:1000}),prisma.gLAccount.findMany({where:{accountType:'KAS_BANK',isActive:true},select:{id:true,accountNo:true,name:true},take:500}),prisma.salesInvoice.findMany({where:{category:'DP',status:'PAID'},select:{id:true,invoiceNo:true,projectId:true,subTotal:true,dpUsedAmount:true,totalAmount:true},take:1000})]);return <AppLayout title="Pendapatan" subtitle="Faktur, alokasi uang muka, dan penerimaan" user={session.user}><RevenueClient invoices={invoices} projects={projects} accounts={accounts} downPayments={downPayments.filter(d=>d.dpUsedAmount<d.subTotal)}/><ListPager page={p.page} total={total}/></AppLayout>;}
