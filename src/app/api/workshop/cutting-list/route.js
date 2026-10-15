import { api, json } from '@/lib/http';
import { addCutting } from '@/lib/services/workshop';
export const POST=api(async(request,context,user)=>addCutting(await json(request),user));
