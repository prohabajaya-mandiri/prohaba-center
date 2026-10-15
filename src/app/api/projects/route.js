import { api,json } from '@/lib/http';
import { saveProject } from '@/lib/services/projects';
export const POST=api(async(request,context,user)=>saveProject(await json(request),user));
