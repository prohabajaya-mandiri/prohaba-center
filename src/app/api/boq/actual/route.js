import { api,json } from '@/lib/http';
import { saveActual } from '@/lib/services/boq';
import { prisma } from '@/lib/prisma';
import { text,month } from '@/lib/validation';
export const GET=api(async request=>{const q=new URL(request.url).searchParams;return prisma.boqActual.findMany({where:{projectId:text(q.get('projectId'),'Proyek'),...(q.get('month')?{month:month(q.get('month'))}:{})},take:1000});});
export const POST=api(async(request,context,user)=>saveActual(await json(request),user));
