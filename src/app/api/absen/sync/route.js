import { api, json } from '@/lib/http';
import { syncScans } from '@/lib/services/attendance-scan';
export const POST = api(async (request, context, user) => syncScans(await json(request), user));
