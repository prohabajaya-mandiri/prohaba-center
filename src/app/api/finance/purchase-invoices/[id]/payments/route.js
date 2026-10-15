import {api,json} from '@/lib/http';
import {payPurchase} from '@/lib/services/purchasing';
export const POST=api(async(request,{params},user)=>payPurchase((await params).id,await json(request),user));
