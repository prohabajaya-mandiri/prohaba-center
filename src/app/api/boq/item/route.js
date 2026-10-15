import { api,json } from '@/lib/http';
import { saveItem } from '@/lib/services/boq';
export const POST=api(async(request,context,user)=>saveItem(await json(request),user));
