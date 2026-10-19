import { api, json } from '@/lib/http';
import { generate } from '@/lib/services/payroll';
import { ensureFreshEmployees } from '@/lib/services/employees';
// Status aktif karyawan (resign/nonaktif di E-HSE) disegarkan dahulu agar payroll memakai data terbaru.
export const POST = api(async (request, context, user) => {
  const body = await json(request);
  await ensureFreshEmployees(60 * 1000);
  return generate(body, user);
});
