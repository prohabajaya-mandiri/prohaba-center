import {api} from '@/lib/http';
import {prisma} from '@/lib/prisma';
import {transaction,audit} from '@/lib/transactions';
import {privateFile,download} from '@/lib/files';
import {ensure} from '@/lib/validation';
export const GET=api(async(request,{params})=>{const{id}=await params,receipt=await prisma.siteReceipt.findUniqueOrThrow({where:{sitePurchaseId:id}});return download(receipt.data,receipt.fileName);});
export const POST=api(async(request,{params},user)=>{const{id}=await params,form=await request.formData();ensure([...form.keys()].every(k=>k==='file'),'Field tidak diizinkan.');const file=await privateFile(form.get('file'),true);return transaction(async tx=>{const old=await tx.sitePurchase.findUniqueOrThrow({where:{id}});ensure(old.status==='PENDING'&&(old.requestedBy===user.id||user.role==='TOP_MANAGEMENT'),'Bukti hanya dapat diubah pembuat sebelum review.',403);await tx.siteReceipt.upsert({where:{sitePurchaseId:id},create:{sitePurchaseId:id,...file},update:file});const result=await tx.sitePurchase.update({where:{id},data:{receiptUrl:'/api/site-purchase/'+id+'/receipt'}});await audit(tx,user,'SITE_PURCHASE','RECEIPT',id,null,{fileName:file.fileName});return result;});});
