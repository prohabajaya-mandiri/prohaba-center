import {api,json} from '@/lib/http';
import {reviewMaterial} from '@/lib/services/purchasing';
export const PATCH=api(async(request,{params},user)=>reviewMaterial((await params).id,await json(request),user));
