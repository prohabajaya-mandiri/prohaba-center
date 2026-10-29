import { hseIntegrationApi } from "@/lib/hse-integration";
import { equipmentForSite } from "@/lib/services/hse-operational";
// Daftar alat/unit di site & status pemeliharaan (bukti CSMS U14.02/U14.06 di E-HSE).
export const GET = hseIntegrationApi(async (request) => equipmentForSite(new URL(request.url).searchParams));
