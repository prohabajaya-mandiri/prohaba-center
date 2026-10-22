import { api, json } from '@/lib/http';
import { scan } from '@/lib/services/attendance-scan';
export const POST = api(async (request, context, user) => scan(await json(request), user));
