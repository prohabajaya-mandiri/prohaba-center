import {api,json} from '@/lib/http';
import {createInvoice} from '@/lib/services/revenue';
import {prisma} from '@/lib/prisma';
import {pagination} from '@/lib/validation';
export const GET=api(async request=>{const{skip,take}=pagination(new URL(request.url).searchParams);return prisma.salesInvoice.findMany({skip,take,include:{project:true},orderBy:{createdAt:'desc'}});});
export const POST=api(async(request,context,user)=>createInvoice(await json(request),user));
