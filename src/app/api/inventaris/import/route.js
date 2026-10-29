import { api } from '@/lib/http';
import { choice, ensure } from '@/lib/validation';
import { importRegister } from '@/lib/services/assets';

// Import register lama ±23.000 nomor dalam satu transaksi (±60 dtk dari dev lokal ke Supabase).
export const maxDuration = 300;

export const POST = api(async (request, context, user) => {
  const form = await request.formData();
  ensure([...form.keys()].every((k) => ['file', 'mode'].includes(k)), 'Field upload tidak valid.');
  const file = form.get('file');
  ensure(file && typeof file.arrayBuffer === 'function' && file.size <= 4 * 1024 * 1024 && /\.xlsx$/i.test(file.name), 'File harus Excel (.xlsx) maksimum 4 MB.');
  const mode = choice(form.get('mode') ?? 'preview', ['preview', 'commit'], 'Mode');
  return importRegister(Buffer.from(await file.arrayBuffer()), mode, user);
});
