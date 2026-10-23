import { api, json } from '@/lib/http';
import { decideRequest } from '@/lib/services/fuel';
export const POST = api(async (request, { params }, user) => decideRequest((await params).id, await json(request), user));
