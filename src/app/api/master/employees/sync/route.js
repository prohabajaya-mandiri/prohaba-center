import { api, json } from "@/lib/http";
import { linkLegacyByNik, requireEmployees, syncEmployees } from "@/lib/services/employees";
import { choice, object } from "@/lib/validation";

// { action: "sync" } tarik perubahan E-HSE; { action: "link" } tautkan data pegawai lama berdasarkan NIK.
export const POST = api(async (request, context, user) => {
  requireEmployees(user, true);
  const body = object(await json(request), ["action"]);
  return choice(body.action, ["sync", "link"], "Aksi") === "link" ? linkLegacyByNik(user) : syncEmployees();
});
