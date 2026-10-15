import {api,json} from '@/lib/http';
import {receivePayment} from '@/lib/services/revenue';
export const POST=api(async(request,{params},user)=>receivePayment((await params).id,await json(request),user));
