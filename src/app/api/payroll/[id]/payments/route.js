import {api,json} from '@/lib/http';
import {payPayroll} from '@/lib/services/payroll';
export const POST=api(async(request,{params},user)=>payPayroll((await params).id,await json(request),user));
