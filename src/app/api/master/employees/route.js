import { api } from "@/lib/http";
import { hseFetch } from "@/lib/hse-client";
import { linkLegacyToPersonnel, refreshEmployees, requireEmployees } from "@/lib/services/employees";
import { forwardBody, listQuery } from "@/lib/employee-proxy";

// Daftar & pencarian langsung dari E-HSE (sumber data). ?picker=1 untuk pemilih mandor.
export const GET = api(async (request, context, user) => {
  requireEmployees(user);
  return hseFetch(user, "/personnel?" + listQuery(new URL(request.url).searchParams));
});

// multipart (data = JSON karyawan, ktp = file) diteruskan utuh ke E-HSE. ?legacy=<id> = daftarkan data pegawai lama.
export const POST = api(async (request, context, user) => {
  requireEmployees(user, true);
  const legacy = new URL(request.url).searchParams.get("legacy");
  const created = await hseFetch(user, "/personnel", { method: "POST", ...(await forwardBody(request, "multipart/form-data")), timeout: 30000 });
  if (legacy) await linkLegacyToPersonnel(user, legacy, created.id);
  else await refreshEmployees([created.id]);
  return created;
});
