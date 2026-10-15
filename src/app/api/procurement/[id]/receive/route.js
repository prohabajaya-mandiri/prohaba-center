import {api,json} from '@/lib/http';
import {receivePO} from '@/lib/services/purchasing';
export const POST=api(async(request,{params},user)=>receivePO((await params).id,await json(request),user));
