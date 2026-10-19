import { InputError } from "@/lib/validation";

const LIST_PARAMS = ["q", "siteId", "category", "workStatus", "employmentType", "former", "page", "picker"];

/** Hanya parameter filter yang dikenal yang diteruskan ke E-HSE. */
export function listQuery(searchParams) {
  const out = new URLSearchParams();
  for (const key of LIST_PARAMS) {
    const v = searchParams.get(key);
    if (v) out.set(key, v.slice(0, 100));
  }
  return out.toString();
}

/** Body asli (byte demi byte) beserta Content-Type, agar boundary multipart & tanda tangan tetap cocok. */
export async function forwardBody(request, expected, max = 6_000_000) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith(expected)) throw new InputError("Content-Type harus " + expected + ".", 415);
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > max) throw new InputError("Payload terlalu besar.", 413);
  return { body, contentType };
}
