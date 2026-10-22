import { api } from '@/lib/http';
import { scanRoster } from '@/lib/services/attendance-scan';
export const GET = api(async () => scanRoster());
