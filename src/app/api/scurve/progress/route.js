import { api } from '@/lib/http';
const retired=api(async()=>Response.json({error:'Endpoint lama dihentikan. Gunakan BOQ dan /api/boq/actual sebagai sumber realisasi.'},{status:410}));
export const GET=retired;
export const POST=retired;
