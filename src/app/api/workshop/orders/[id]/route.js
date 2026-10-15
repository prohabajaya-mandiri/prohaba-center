import { api, json } from '@/lib/http';
import { changeOrder, deleteOrder } from '@/lib/services/workshop';
export const PATCH=api(async(request,{params},user)=>changeOrder((await params).id,await json(request),user));
export const DELETE=api(async(request,{params},user)=>deleteOrder((await params).id,user));
