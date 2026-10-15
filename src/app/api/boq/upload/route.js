import { api } from '@/lib/http';
import { ensure,text } from '@/lib/validation';
import { parseBoq } from '@/lib/boq-import';
import { importItems } from '@/lib/services/boq';
export const POST=api(async(request,context,user)=>{const form=await request.formData();ensure([...form.keys()].every(k=>['projectId','file'].includes(k)),'Field upload tidak valid.');const file=form.get('file');ensure(file&&typeof file.arrayBuffer==='function'&&file.size<=4*1024*1024&&/\.xlsx?$/i.test(file.name),'File harus Excel maksimum 4 MB.');return importItems(text(form.get('projectId'),'Proyek'),parseBoq(Buffer.from(await file.arrayBuffer())),user);});
