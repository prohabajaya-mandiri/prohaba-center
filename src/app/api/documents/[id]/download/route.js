import {api} from '@/lib/http';
import {prisma} from '@/lib/prisma';
import {download} from '@/lib/files';
import {ensure} from '@/lib/validation';
export const GET=api(async(request,{params})=>{const{id}=await params,doc=await prisma.document.findUniqueOrThrow({where:{id},include:{content:true}});ensure(doc.content,'File tidak tersedia.',404);return download(doc.content.data,doc.fileName);});
