import { api, json } from '@/lib/http';
import { createLocation } from '@/lib/services/stock';

export const POST = api(async (request, context, user) => createLocation(await json(request), user));
