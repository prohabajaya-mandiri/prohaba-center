import { api, json } from '@/lib/http';
import { cancelShipment } from '@/lib/services/fuel';
export const POST = api(async (request, { params }, user) => cancelShipment((await params).id, await json(request), user));
