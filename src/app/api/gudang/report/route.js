import { api } from '@/lib/http';
import { download } from '@/lib/files';
import { date } from '@/lib/validation';
import { weeklyStockXlsx } from '@/lib/services/stock';

export const GET = api(async (request) => {
  const day = new URL(request.url).searchParams.get('week');
  date(day, 'Minggu');
  const { data, fileName } = await weeklyStockXlsx(day);
  return download(data, fileName);
});
