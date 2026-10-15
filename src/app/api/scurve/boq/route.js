export { GET } from '../../boq/schedule/route';
import { api } from '@/lib/http';
export const POST=api(async()=>Response.json({error:'Gunakan /api/boq/upload atau /api/boq/item.'},{status:410}));
