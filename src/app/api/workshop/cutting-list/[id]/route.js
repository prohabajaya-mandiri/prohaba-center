import { api, json } from '@/lib/http';
import { changeCutting } from '@/lib/services/workshop';
export const PATCH=api(async(request,{params},user)=>changeCutting((await params).id,await json(request),user));
export const DELETE=api(async(request,{params},user)=>changeCutting((await params).id,{},user,true));
