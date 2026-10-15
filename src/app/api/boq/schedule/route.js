import { api,json } from '@/lib/http';
import { saveSchedule,getCurve } from '@/lib/services/boq';
import { text } from '@/lib/validation';
export const GET=api(async request=>(await getCurve(text(new URL(request.url).searchParams.get('projectId'),'Proyek'))).boqItems);
export const PUT=api(async(request,context,user)=>saveSchedule(await json(request),user));
