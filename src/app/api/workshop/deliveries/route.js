import { api, json } from '@/lib/http';
import { shipOrder } from '@/lib/services/workshop';
export const POST=api(async(request,context,user)=>shipOrder(await json(request),user));
