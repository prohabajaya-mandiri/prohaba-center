import { api } from "@/lib/http";
import { hseFetch, passThrough } from "@/lib/hse-client";
import { requireEmployees } from "@/lib/services/employees";

export const GET = api(async (request, context, user) => {
  requireEmployees(user);
  const inline = new URL(request.url).searchParams.get("inline") === "1" ? "?inline=1" : "";
  return passThrough(await hseFetch(user, "/personnel/" + encodeURIComponent((await context.params).id) + "/ktp" + inline, { raw: true }));
});
