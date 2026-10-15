import {api,json} from '@/lib/http';
import {requestMaterial} from '@/lib/services/purchasing';
export const POST=api(async(request,context,user)=>requestMaterial(await json(request),user));
