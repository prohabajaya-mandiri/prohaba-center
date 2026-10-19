import { api } from "@/lib/http";
import { hseFetch } from "@/lib/hse-client";
import { refreshEmployees, requireEmployees } from "@/lib/services/employees";
import { forwardBody } from "@/lib/employee-proxy";

export const POST = api(async (request, context, user) => {
  requireEmployees(user, true);
  const id = encodeURIComponent((await context.params).id);
  const result = await hseFetch(user, "/personnel/" + id + "/status", { method: "POST", ...(await forwardBody(request, "application/json", 10_000)) });
  await refreshEmployees([result.id]);
  return result;
});
