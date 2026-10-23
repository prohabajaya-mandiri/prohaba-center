import { api, json } from '@/lib/http';
import { syncFuel } from '@/lib/services/fuel';
// Antrean bisa membawa foto meter (sudah dikompres di HP), jadi batas payload lebih besar.
export const POST = api(async (request, context, user) => syncFuel(await json(request, 2_000_000), user));
