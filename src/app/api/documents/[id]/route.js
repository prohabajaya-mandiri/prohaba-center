import {api} from '@/lib/http';
import {transaction,audit} from '@/lib/transactions';
export const DELETE=api(async(request,{params},user)=>transaction(async tx=>{const{id}=await params,old=await tx.document.findUniqueOrThrow({where:{id}});await tx.document.delete({where:{id}});await audit(tx,user,'ENGINEERING_DOC','DELETE',id,old,null);return{success:true};}));
