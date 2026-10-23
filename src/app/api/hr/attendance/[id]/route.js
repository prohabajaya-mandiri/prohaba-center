import { api, json } from '@/lib/http';
import { correctAttendance } from '@/lib/services/payroll';
export const PATCH = api(async (request, { params }, user) => correctAttendance((await params).id, await json(request), user));
