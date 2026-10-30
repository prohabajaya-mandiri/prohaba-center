import { api, json } from '@/lib/http';
import { updateItem } from '@/lib/services/stock';

export const PATCH = api(async (request, { params }, user) => updateItem((await params).id, await json(request), user));
