import QRCode from "qrcode";
import { prisma } from "./prisma.js";
import { encodeAttendanceQr } from "./attendance-qr.js";

/**
 * Kartu QR absensi untuk semua karyawan aktif (staff, harian kantor, manpower), opsional per proyek
 * penugasan, kategori, atau pencarian nama/NIP. Kartu menampilkan nama; QR berisi kode internal yang
 * tetap dan unik (nama bisa sama dan NIP hanya dimiliki staff), lalu ditandatangani.
 */
export async function attendanceCards({ projectId, category, q }) {
  const scope = {
    isActive: true,
    ...(projectId ? { projects: { some: { projectId, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] } } } : {}),
  };
  const employees = await prisma.employee.findMany({
    where: {
      ...scope,
      ...(category ? { category } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { nip: { contains: q, mode: "insensitive" } }] } : {}),
    },
    select: { id: true, name: true, employeeNo: true, nip: true, category: true, position: true, siteName: true },
    orderBy: { name: "asc" },
    take: 500,
  });
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
  return cards;
}
