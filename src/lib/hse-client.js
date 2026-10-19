// Klien server-ke-server ke E-HSE (sumber data master karyawan). Hanya dipakai di server:
// secret tidak pernah dikirim ke browser. Setiap permintaan ditandatangani HMAC (lib/integration-signature.js)
// dan membawa identitas pengguna ERP agar E-HSE dapat menerapkan hak akses & mencatat audit log.
import { signedHeaders } from "./integration-signature.js";
import { InputError } from "./validation.js";

const CLIENT = "center";
export const SYSTEM_ACTOR = { id: "system", name: "Sinkronisasi otomatis", role: "SYSTEM" };

export function hseConfigured() {
  return Boolean(process.env.HSE_API_URL && (process.env.HSE_INTEGRATION_SECRET ?? "").length >= 32);
}

/** URL publik E-HSE untuk tautan "buka di E-HSE" (tanpa data rahasia). */
export const hsePublicUrl = () => (process.env.HSE_API_URL ? new URL(process.env.HSE_API_URL).origin : null);

/**
 * Panggil endpoint /api/integration/v1{path}. `body`: object (dikirim JSON), string atau Buffer (dikirim apa adanya
 * dengan `contentType`). `raw` = kembalikan Response mentah (file/xlsx). Galat E-HSE diteruskan sebagai InputError.
 */
export async function hseFetch(user, path, { method = "GET", body, contentType, raw = false, timeout = 20000 } = {}) {
  if (!hseConfigured())
    throw new InputError("Integrasi E-HSE belum dikonfigurasi (HSE_API_URL dan HSE_INTEGRATION_SECRET).", 503);
  const url = new URL("/api/integration/v1" + path, process.env.HSE_API_URL);
  let payload = body;
  if (body !== undefined && typeof body !== "string" && !(body instanceof Uint8Array)) {
    payload = JSON.stringify(body);
    contentType = "application/json";
  }
  const headers = signedHeaders(process.env.HSE_INTEGRATION_SECRET, {
    client: CLIENT,
    method,
    path: url.pathname + url.search,
    body: payload ?? "",
    actor: { id: String(user.id), name: String(user.name ?? "Pengguna ERP"), role: String(user.role) },
  });
  if (contentType) headers["content-type"] = contentType;
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeout) });
  } catch {
    throw new InputError("E-HSE tidak dapat dihubungi. Coba lagi beberapa saat.", 503);
  }
  if (res.ok && raw) return res;
  const data = res.headers.get("content-type")?.includes("json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401) throw new InputError("Koneksi ke E-HSE ditolak: kredensial integrasi tidak cocok.", 502);
    throw new InputError(data?.error ?? "E-HSE mengembalikan galat " + res.status + ".", res.status >= 500 ? 502 : res.status);
  }
  return data;
}

/** Teruskan Response file dari E-HSE ke browser dengan header yang aman. */
export function passThrough(res) {
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  for (const key of ["content-type", "content-disposition", "content-security-policy"]) {
    const v = res.headers.get(key);
    if (v) headers.set(key, v);
  }
  return new Response(res.body, { status: res.status, headers });
}
