import { api, json } from '@/lib/http';
import { saveUser } from '@/lib/services/users';
export const PUT = api(async (request, { params }, user) => saveUser(await json(request), user, (await params).id));
