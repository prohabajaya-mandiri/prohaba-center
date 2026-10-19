import { api } from "@/lib/http";
import { hseFetch, passThrough } from "@/lib/hse-client";
import { requireEmployees } from "@/lib/services/employees";
import { listQuery } from "@/lib/employee-proxy";

export const GET = api(async (request, context, user) => {
  requireEmployees(user);
  return passThrough(await hseFetch(user, "/personnel/export?" + listQuery(new URL(request.url).searchParams), { raw: true, timeout: 60000 }));
});
