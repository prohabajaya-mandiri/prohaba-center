import { api, json } from '@/lib/http';
import { createOrder, listOrders } from '@/lib/services/workshop';
import { pagination } from '@/lib/validation';
export const GET=api(async request=>{const {skip,take}=pagination(new URL(request.url).searchParams);return listOrders({skip,take});});
export const POST=api(async(request,context,user)=>createOrder(await json(request),user));
