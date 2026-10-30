import { api } from '@/lib/http';
import { choice, ensure } from '@/lib/validation';
import { importOpname } from '@/lib/services/stock';

export const maxDuration = 60;

export const POST = api(async (request, context, user) => {
  const form = await request.formData();
  ensure([...form.keys()].every((k) => ['file', 'mode', 'docDate'].includes(k)), 'Field upload tidak valid.');
  const file = form.get('file');
  ensure(file && typeof file.arrayBuffer === 'function' && file.size <= 4 * 1024 * 1024 && /\.xlsx$/i.test(file.name), 'File harus Excel (.xlsx) maksimum 4 MB.');
  const mode = choice(form.get('mode') ?? 'preview', ['preview', 'commit'], 'Mode');
  return importOpname(Buffer.from(await file.arrayBuffer()), mode, form.get('docDate'), user);
});
