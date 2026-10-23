import { api, json } from '@/lib/http';
import { createShipment } from '@/lib/services/fuel';
export const POST = api(async (request, context, user) => createShipment(await json(request), user));
