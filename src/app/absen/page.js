import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/access";
import AbsenClient from "./AbsenClient";

export const metadata = { title: "Absensi Lapangan", manifest: "/absen.webmanifest" };

// Web absensi untuk HP PIC lapangan: scan kamera, antrean offline, tanpa menu ERP.
export default async function AbsenPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccess(session.user.role, "/absen")) redirect("/dashboard");
  return <AbsenClient user={{ id: session.user.id, name: session.user.name }} />;
}
