import QRCode from "qrcode";
import { prisma } from "./prisma.js";
import { encodeAttendanceQr } from "./attendance-qr.js";

/** Data kartu QR absensi untuk karyawan aktif, opsional per proyek penugasan / pencarian. */
export async function attendanceCards({ projectId, q }) {
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(projectId ? { projects: { some: { projectId, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] } } } : {}),
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { employeeNo: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    select: { id: true, name: true, employeeNo: true, position: true, siteName: true },
    orderBy: { name: "asc" },
    take: 500,
  });
  return Promise.all(
    employees.map(async (e) => ({
      ...e,
      qr: await QRCode.toString(encodeAttendanceQr(e.employeeNo), {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
      }),
    })),
  );
}
