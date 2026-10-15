import {api,json} from '@/lib/http';
import {reviewSite} from '@/lib/services/purchasing';
export const PATCH=api(async(request,{params},user)=>reviewSite((await params).id,await json(request),user));
