import { api } from "@/lib/http";
import { hseFetch, passThrough } from "@/lib/hse-client";
import { requireEmployees } from "@/lib/services/employees";

export const GET = api(async (request, context, user) => {
  requireEmployees(user);
  return passThrough(await hseFetch(user, "/personnel/template", { raw: true }));
});
