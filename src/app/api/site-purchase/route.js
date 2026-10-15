import {api,json} from '@/lib/http';
import {sitePurchase} from '@/lib/services/purchasing';
import {privateFile} from '@/lib/files';
import {ensure} from '@/lib/validation';
export const POST=api(async(request,context,user)=>{if(request.headers.get('content-type')?.startsWith('multipart/form-data')){const form=await request.formData();ensure([...form.keys()].every(k=>['payload','file'].includes(k)),'Field tidak diizinkan.');return sitePurchase(JSON.parse(form.get('payload')),user,await privateFile(form.get('file'),true));}return sitePurchase(await json(request),user);});
