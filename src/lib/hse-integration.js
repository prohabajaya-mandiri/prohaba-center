// Endpoint ERP yang dibaca E-HSE (arah E-HSE → ERP), ditandatangani HMAC dengan secret bersama
// HSE_INTEGRATION_SECRET (= INTEGRATION_CENTER_SECRET di E-HSE). Klien "hse" hanya boleh membaca (GET).
// Kanonik tanda tangan memuat kode klien, sehingga permintaan ERP→E-HSE (klien "center") tidak dapat dipakai ulang di sini.
import { decodeActor, HEADERS, verify } from "./integration-signature.js";
import { InputError } from "./validation.js";
import { serialize } from "./serialization.js";

export const HSE_CLIENT = "hse";
// Peran E-HSE yang boleh membaca data operasional ERP untuk bukti CSMS & HSE Performance.
export const HSE_READER_ROLES = ["HO_HSE", "HSE_SITE", "PJO", "PM", "DIREKSI"];

/** Pelaku E-HSE yang sah, atau null bila tanda tangan/peran tidak valid. */
export function authenticateHse(request, now = Date.now()) {
  const secret = process.env.HSE_INTEGRATION_SECRET ?? "";
  if (secret.length < 32 || request.headers.get(HEADERS.client) !== HSE_CLIENT) return null;
  const url = new URL(request.url);
  const actorHeader = request.headers.get(HEADERS.actor) ?? "";
  const ok = verify(secret, {
    client: HSE_CLIENT,
    timestamp: request.headers.get(HEADERS.timestamp),
    method: request.method,
    path: url.pathname + url.search,
    body: "",
    actor: actorHeader,
  }, request.headers.get(HEADERS.signature), now);
  const actor = ok ? decodeActor(actorHeader) : null;
  return actor && HSE_READER_ROLES.includes(actor.role) ? actor : null;
}

/** Pembungkus route integrasi E-HSE (pengganti api() berbasis sesi). Hanya GET. */
export function hseIntegrationApi(handler) {
  return async (request, context) => {
    try {
      if (request.method !== "GET") return Response.json({ error: "Method Not Allowed" }, { status: 405 });
      const actor = authenticateHse(request);
      if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const result = await handler(request, context, actor);
      return Response.json(serialize(result), { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      console.error("HSE integration failure", error.code ?? error.name);
      return Response.json({ error: "Permintaan gagal." }, { status: 500 });
    }
  };
}
