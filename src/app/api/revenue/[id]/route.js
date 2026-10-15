import {api} from '@/lib/http';
import {voidInvoice} from '@/lib/services/revenue';
export const PATCH=api(async()=>Response.json({error:'Catat pembayaran melalui endpoint payments. Status tidak boleh diubah langsung.'},{status:409}));
export const DELETE=api(async(request,{params},user)=>voidInvoice((await params).id,user));
