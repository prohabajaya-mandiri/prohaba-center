import { api } from '@/lib/http';
import { stockDocument } from '@/lib/services/stock';

export const GET = api(async (request, { params }) => stockDocument((await params).id));
