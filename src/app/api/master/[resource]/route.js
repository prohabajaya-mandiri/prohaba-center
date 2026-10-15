import {api,json} from '@/lib/http';
import {listMaster,saveMaster} from '@/lib/services/master';
import {pagination} from '@/lib/validation';
export const GET=api(async(request,{params},user)=>{const{skip,take}=pagination(new URL(request.url).searchParams);return listMaster((await params).resource,user,{skip,take});});
export const POST=api(async(request,{params},user)=>saveMaster((await params).resource,await json(request),user));
