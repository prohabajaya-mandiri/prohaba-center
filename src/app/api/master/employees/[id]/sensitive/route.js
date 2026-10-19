import { api } from "@/lib/http";
import { hseFetch } from "@/lib/hse-client";
import { requireEmployees } from "@/lib/services/employees";

// Membuka NIK/rekening utuh: diperiksa & dicatat VIEW_SENSITIVE di audit log E-HSE atas nama pengguna ERP.
export const GET = api(async (request, context, user) => {
  requireEmployees(user);
  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  return hseFetch(user, "/personnel/" + encodeURIComponent((await context.params).id) + "/sensitive?" + new URLSearchParams({ kind: kind.slice(0, 10) }));
});
