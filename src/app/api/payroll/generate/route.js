import { api,json } from '@/lib/http';
import { generate } from '@/lib/services/payroll';
export const POST=api(async(request,context,user)=>generate(await json(request),user));
