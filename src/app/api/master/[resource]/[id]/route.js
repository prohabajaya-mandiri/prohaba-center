import {api,json} from '@/lib/http';
import {saveMaster} from '@/lib/services/master';
export const PUT=api(async(request,{params},user)=>{const{resource,id}=await params;return saveMaster(resource,await json(request),user,id);});
