import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import KioskClient from "./KioskClient";

export const metadata = { title: "Kiosk Absensi" };

// Halaman scan layar penuh tanpa sidebar, untuk laptop/tablet di pos absensi.
export default async function AbsenPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccess(session.user.role, "/absen")) redirect("/dashboard");
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, location: true },
    orderBy: { name: "asc" },
    take: 1000,
  });
  return <KioskClient projects={projects} user={session.user} />;
}
