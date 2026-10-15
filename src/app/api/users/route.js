import { api, json } from '@/lib/http';
import { saveUser } from '@/lib/services/users';
export const POST = api(async (request, context, user) => saveUser(await json(request), user));
