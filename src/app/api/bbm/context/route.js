import { api } from '@/lib/http';
import { fuelContext } from '@/lib/services/fuel';
export const GET = api(async (request, context, user) => fuelContext(user));
