import { api, json } from '@/lib/http';
import { cancelDocument } from '@/lib/services/stock';

export const POST = api(async (request, { params }, user) => cancelDocument((await params).id, await json(request), user));
