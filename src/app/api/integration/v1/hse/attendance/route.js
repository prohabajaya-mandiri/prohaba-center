import { hseIntegrationApi } from "@/lib/hse-integration";
import { attendanceForSite } from "@/lib/services/hse-operational";
// Rekap hadir harian per site (nilai awal manpower HSE Performance di E-HSE).
export const GET = hseIntegrationApi(async (request) => attendanceForSite(new URL(request.url).searchParams));
