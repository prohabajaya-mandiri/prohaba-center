import { prisma } from "./prisma.js";
export async function transaction(work) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
        maxWait: 10000,
        timeout: 20000,
      });
    } catch (error) {
      if (error.code !== "P2034" || attempt >= 2) throw error;
    }
  }
}
export async function audit(
  tx,
  user,
  module,
  action,
  recordId,
  oldValue,
  newValue,
) {
  const clean = (value) =>
    value == null
      ? null
      : JSON.stringify(value, (key, v) =>
          /password|secret|token/i.test(key) ? undefined : v,
        );
  await tx.auditLog.create({
    data: {
      userId: user.id,
      module,
      action,
      recordId,
      oldValue: clean(oldValue),
      newValue: clean(newValue),
    },
  });
}
export async function nextNumber(tx, prefix) {
  const year = new Date().getUTCFullYear(),
    key = prefix + "-" + year;
  const sequence = await tx.documentSequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return key + "-" + String(sequence.value).padStart(6, "0");
}
