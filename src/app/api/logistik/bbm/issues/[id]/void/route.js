import { api, json } from '@/lib/http';
import { voidIssue } from '@/lib/services/fuel';
export const POST = api(async (request, { params }, user) => voidIssue((await params).id, await json(request), user));
