import { api } from '@/lib/http';
import { batchUnits } from '@/lib/services/assets';

export const GET = api(async (request) => batchUnits(new URL(request.url).searchParams.get('batchId')));
