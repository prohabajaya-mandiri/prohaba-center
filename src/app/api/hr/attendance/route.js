import { api,json } from '@/lib/http';
import { attendance } from '@/lib/services/payroll';
export const POST=api(async(request,context,user)=>attendance(await json(request),user));
