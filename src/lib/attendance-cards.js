import QRCode from "qrcode";
import { prisma } from "./prisma.js";
import { encodeAttendanceQr } from "./attendance-qr.js";

const HAS_NIP = { AND: [{ nip: { not: null } }, { nip: { not: "" } }] };

/**
 * Kartu QR absensi untuk karyawan aktif yang sudah ber-NIP, opsional per proyek penugasan / pencarian.
 * Kartu menampilkan NIP; QR berisi kode internal yang tetap (NIP masih bisa diubah HRD) dan ditandatangani.
 */
export async function attendanceCards({ projectId, q }) {
  const scope = {
    isActive: true,
    ...(projectId ? { projects: { some: { projectId, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] } } } : {}),
  };
  const [employees, withoutNip] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...scope,
        ...HAS_NIP,
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { nip: { contains: q, mode: "insensitive" } }] } : {}),
      },
      select: { id: true, name: true, employeeNo: true, nip: true, position: true, siteName: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.employee.count({ where: { ...scope, NOT: HAS_NIP } }),
  ]);
  const cards = await Promise.all(
    employees.map(async ({ employeeNo, ...e }) => ({
      ...e,
      qr: await QRCode.toString(encodeAttendanceQr(employeeNo), {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
      }),
    })),
  );
  return { cards, withoutNip };
}
