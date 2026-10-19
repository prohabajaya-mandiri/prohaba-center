import { api } from "@/lib/http";
import { hseFetch } from "@/lib/hse-client";
import { requireEmployees, syncEmployees } from "@/lib/services/employees";
import { forwardBody } from "@/lib/employee-proxy";

// { mode: preview|commit, rows } — validasi & penyimpanan dilakukan E-HSE.
export const POST = api(async (request, context, user) => {
  requireEmployees(user, true);
  const forwarded = await forwardBody(request, "application/json", 4_000_000);
  const result = await hseFetch(user, "/personnel/import", { method: "POST", ...forwarded, timeout: 120000 });
  if (result?.created) await syncEmployees();
  return result;
});
