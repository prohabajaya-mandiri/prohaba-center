import { api,json } from '@/lib/http';
import { saveProject,archiveProject } from '@/lib/services/projects';
export const PATCH=api(async(request,{params},user)=>saveProject(await json(request),user,(await params).id));
export const DELETE=api(async(request,{params},user)=>archiveProject((await params).id,user));
