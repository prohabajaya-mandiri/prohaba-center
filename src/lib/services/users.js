import bcrypt from "bcryptjs";
import { ROLES, FUEL_ROLE } from "../access.js";
import { object, text, choice, ensure } from "../validation.js";
import { transaction, audit } from "../transactions.js";
export async function saveUser(body, user, id) {
  object(body, ["name", "email", "role", "password", "isActive", "siteProjectId"]);
  const name = text(body.name, "Nama"),
    email = text(body.email, "Email", 254).toLowerCase(),
    role = choice(body.role, ROLES, "Role");
  ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Email tidak valid.");
  // Petugas BBM terikat ke satu site; peran lain tidak memakai site.
  const siteProjectId = role === FUEL_ROLE ? text(body.siteProjectId, "Site petugas BBM") : null;
  ensure(
    body.isActive === undefined || typeof body.isActive === "boolean",
    "Status aktif tidak valid.",
  );
  const password = body.password;
  if (!id || password)
    ensure(
      typeof password === "string" &&
        password.length >= 12 &&
        Buffer.byteLength(password) <= 72,
      "Password harus 12–72 byte.",
    );
  const hash = password ? await bcrypt.hash(password, 12) : undefined;
  return transaction(async (tx) => {
    const old = id ? await tx.user.findUniqueOrThrow({ where: { id } }) : null;
    if (siteProjectId) await tx.project.findUniqueOrThrow({ where: { id: siteProjectId, status: "ACTIVE" } });
    if (
      old?.role === "TOP_MANAGEMENT" &&
      old.isActive &&
      (role !== "TOP_MANAGEMENT" || body.isActive === false)
    ) {
      ensure(
        (await tx.user.count({
          where: { role: "TOP_MANAGEMENT", isActive: true },
        })) > 1,
        "Admin aktif terakhir tidak boleh dinonaktifkan atau diturunkan.",
        409,
      );
    }
    const data = {
      name,
      email,
      role,
      siteProjectId,
      isActive: body.isActive ?? true,
      ...(hash ? { password: hash } : {}),
      ...(id && (hash || body.isActive === false)
        ? { sessionVersion: { increment: 1 } }
        : {}),
    };
    const result = id
      ? await tx.user.update({ where: { id }, data })
      : await tx.user.create({ data });
    await audit(
      tx,
      user,
      "USER_MANAGEMENT",
      id ? "UPDATE" : "CREATE",
      result.id,
      old,
      result,
    );
    return result;
  });
}
