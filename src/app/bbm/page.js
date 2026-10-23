import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/access";
import BbmClient from "./BbmClient";

export const metadata = { title: "BBM Site", manifest: "/bbm.webmanifest" };

// Web BBM untuk HP petugas BBM site: terima kiriman, keluarkan BBM, opname, ajukan drum. Bisa offline.
export default async function BbmPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccess(session.user.role, "/bbm")) redirect("/dashboard");
  return <BbmClient user={{ id: session.user.id, name: session.user.name }} />;
}
