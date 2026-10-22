import { api } from '@/lib/http';
import { text } from '@/lib/validation';
import { todayScans } from '@/lib/services/attendance-scan';
export const GET = api(async (request) => {
  const params = new URL(request.url).searchParams;
  return todayScans(text(params.get('projectId'), 'Proyek'), params.get('timeZone'));
});
