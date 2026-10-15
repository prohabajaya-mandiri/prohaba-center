import { api,json } from '@/lib/http';
import { approve } from '@/lib/services/payroll';
export const POST=api(async(request,context,user)=>approve(await json(request),user));
