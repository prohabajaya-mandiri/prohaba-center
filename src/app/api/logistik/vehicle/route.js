import {api,json} from '@/lib/http';
import {logistics} from '@/lib/services/logistics';
export const POST=api(async(request,context,user)=>logistics('vehicle',await json(request),user));
