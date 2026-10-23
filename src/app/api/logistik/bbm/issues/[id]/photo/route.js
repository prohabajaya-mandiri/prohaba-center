import { api } from '@/lib/http';
import { issuePhoto } from '@/lib/services/fuel';
export const GET = api(async (request, { params }) => issuePhoto((await params).id));
