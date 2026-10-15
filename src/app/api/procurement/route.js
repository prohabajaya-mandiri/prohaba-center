import {api,json} from '@/lib/http';
import {createPO} from '@/lib/services/purchasing';
export const POST=api(async(request,context,user)=>createPO(await json(request),user));
