import { api } from "@/lib/http";
import { hseFetch } from "@/lib/hse-client";
import { refreshEmployees, requireEmployees } from "@/lib/services/employees";
import { forwardBody } from "@/lib/employee-proxy";

const ref = async (context) => encodeURIComponent((await context.params).id);

export const GET = api(async (request, context, user) => {
  requireEmployees(user);
  return hseFetch(user, "/personnel/" + (await ref(context)));
});

export const PUT = api(async (request, context, user) => {
  requireEmployees(user, true);
  const id = await ref(context);
  const result = await hseFetch(user, "/personnel/" + id, { method: "PUT", ...(await forwardBody(request, "multipart/form-data")), timeout: 30000 });
  await refreshEmployees([result.id]);
  return result;
});
