import { api, json } from '@/lib/http';
import { receiveDelivery } from '@/lib/services/workshop';
export const PATCH=api(async(request,{params},user)=>receiveDelivery((await params).id,await json(request),user));
