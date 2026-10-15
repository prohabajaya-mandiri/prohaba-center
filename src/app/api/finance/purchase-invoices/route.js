import {api,json} from '@/lib/http';
import {purchaseInvoice} from '@/lib/services/purchasing';
export const POST=api(async(request,context,user)=>purchaseInvoice(await json(request),user));
