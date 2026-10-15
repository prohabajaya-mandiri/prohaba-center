import { api,json } from '@/lib/http';
import { saveItem,deleteItem } from '@/lib/services/boq';
export const PUT=api(async(request,{params},user)=>saveItem((await json(request)),user,(await params).id));
export const DELETE=api(async(request,{params},user)=>deleteItem((await params).id,user));
