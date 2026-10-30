import { api, json } from '@/lib/http';
import { postDocument } from '@/lib/services/stock';

export const POST = api(async (request, context, user) => postDocument(await json(request), user));
