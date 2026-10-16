import { prisma } from "../prisma.js";
import { transaction, audit } from "../transactions.js";
import {
  object,
  text,
  number,
  money,
  date,
  choice,
  ensure,
} from "../validation.js";
import { STANDARD_ACCOUNTS } from "./ledger.js";
import { MASTER_ROLES } from "../module-tabs.js";
// Satu sumber aturan dengan sub-menu Master Data di sidebar.
export const masterRoles = MASTER_ROLES;
const models = {
  employees: "employee",
  assignments: "employeeProject",
  vendors: "vendor",
  prices: "priceReference",
  accounts: "gLAccount",
};
export function masterAllowed(resource, user) {
  ensure(
    Object.hasOwn(masterRoles, resource) &&
      masterRoles[resource].includes(user.role),
    "Master data tidak diizinkan.",
    403,
  );
}
export async function listMaster(
  resource,
  user,
  paging = { skip: 0, take: 50 },
) {
  masterAllowed(resource, user);
  return {
    rows: await prisma[models[resource]].findMany({
      ...paging,
      orderBy: { id: "asc" },
      ...(resource === "assignments"
        ? {
            include: {
              employee: { select: { name: true } },
              project: { select: { name: true, code: true } },
            },
          }
        : {}),
    }),
    total: await prisma[models[resource]].count(),
  };
}
export async function saveMaster(resource, body, user, id) {
  masterAllowed(resource, user);
  let data;
  if (resource === "employees") {
    object(body, [
      "employeeNo",
      "name",
      "nik",
      "position",
      "department",
      "employeeType",
      "baseSalary",
      "joinDate",
      "isActive",
      "bankAccount",
      "bankName",
      "npwp",
      "bpjsKesehatan",
      "bpjsKetenagakerjaan",
    ]);
    data = {
      employeeNo: text(body.employeeNo, "Nomor pegawai"),
      name: text(body.name, "Nama"),
      nik: text(body.nik, "NIK", 30),
      position: text(body.position, "Posisi"),
      department: text(body.department, "Departemen"),
      employeeType: choice(body.employeeType, ["STAFF", "HARIAN", "BORONGAN"]),
      baseSalary: money(body.baseSalary ?? 0),
      joinDate: date(body.joinDate),
      isActive: body.isActive ?? true,
    };
    for (const key of [
      "bankAccount",
      "bankName",
      "npwp",
      "bpjsKesehatan",
      "bpjsKetenagakerjaan",
    ])
      if (body[key] !== undefined) data[key] = text(body[key], key, 100, true);
  }
  if (resource === "assignments") {
    object(body, [
      "employeeId",
      "projectId",
      "role",
      "startDate",
      "endDate",
      "payType",
      "dailyRate",
      "monthlyRate",
      "overtimeRate",
    ]);
    const payType = choice(body.payType, ["DAILY", "MONTHLY"]);
    data = {
      employeeId: text(body.employeeId, "Pegawai"),
      projectId: text(body.projectId, "Proyek"),
      role: text(body.role, "Posisi penugasan"),
      startDate: date(body.startDate),
      endDate: body.endDate ? date(body.endDate) : null,
      payType,
      dailyRate:
        payType === "DAILY"
          ? money(body.dailyRate, "Tarif harian", 0.01)
          : null,
      monthlyRate:
        payType === "MONTHLY"
          ? money(body.monthlyRate, "Alokasi bulanan", 0.01)
          : null,
      overtimeRate: money(body.overtimeRate, "Tarif lembur"),
    };
    ensure(
      !data.endDate || data.endDate >= data.startDate,
      "Rentang penugasan terbalik.",
    );
  }
  if (resource === "vendors") {
    object(body, [
      "code",
      "name",
      "contact",
      "phone",
      "email",
      "address",
      "npwp",
      "isActive",
    ]);
    data = {
      code: text(body.code, "Kode"),
      name: text(body.name, "Nama"),
      isActive: body.isActive ?? true,
    };
    for (const key of ["contact", "phone", "email", "address", "npwp"])
      if (body[key] !== undefined) data[key] = text(body[key], key, 500, true);
  }
  if (resource === "prices") {
    object(body, ["itemCode", "description", "unit", "refPrice"]);
    data = {
      itemCode: text(body.itemCode, "Kode barang"),
      description: text(body.description, "Uraian", 500),
      unit: text(body.unit, "Satuan", 30),
      refPrice: money(body.refPrice, "Referensi", 0.01),
    };
  }
  if (resource === "accounts") {
    object(body, [
      "accountNo",
      "name",
      "accountType",
      "purpose",
      "balance",
      "isActive",
    ]);
    data = {
      accountNo: text(body.accountNo, "Nomor akun"),
      name: text(body.name, "Nama akun"),
      accountType: choice(body.accountType, [
        "KAS_BANK",
        "PIUTANG",
        "PERSEDIAAN",
        "AKTIVA_LANCAR_LAINNYA",
        "AKTIVA_TETAP",
        "AKUMULASI_PENYUSUTAN",
        "HUTANG",
        "KEWAJIBAN_JANGKA_PANJANG",
        "EKUITAS",
        "PENDAPATAN",
        "HARGA_POKOK_PENJUALAN",
        "BEBAN",
        "BEBAN_LAIN_LAIN",
        "PENDAPATAN_LAIN_LAIN",
      ]),
      purpose: body.purpose
        ? choice(
            body.purpose,
            STANDARD_ACCOUNTS.map((a) => a[3]),
          )
        : null,
      balance: money(body.balance ?? 0, "Saldo awal", -1e12),
      isActive: body.isActive ?? true,
    };
    if (data.purpose)
      ensure(
        STANDARD_ACCOUNTS.find((a) => a[3] === data.purpose)[2] ===
          data.accountType,
        "Tipe akun tidak sesuai mapping.",
      );
  }
  if (data?.isActive !== undefined)
    ensure(typeof data.isActive === "boolean", "Status aktif harus boolean.");
  return transaction(async (tx) => {
    const model = models[resource],
      old = id ? await tx[model].findUniqueOrThrow({ where: { id } }) : null;
    if (
      resource === "accounts" &&
      old &&
      (await tx.journalVoucherItem.count({ where: { glAccountId: id } })) > 0
    )
      ensure(
        old.balance === data.balance &&
          old.accountType === data.accountType &&
          old.purpose === data.purpose,
        "Saldo awal, tipe, dan mapping akun yang sudah dipakai dikunci.",
        409,
      );
    const result = id
      ? await tx[model].update({ where: { id }, data })
      : await tx[model].create({ data });
    await audit(
      tx,
      user,
      "MASTER_" + resource.toUpperCase(),
      id ? "UPDATE" : "CREATE",
      result.id,
      old,
      result,
    );
    return result;
  });
}
export async function bootstrapAccounts(user) {
  ensure(
    ["TOP_MANAGEMENT", "FINANCE"].includes(user.role),
    "Tidak diizinkan.",
    403,
  );
  return transaction(async (tx) => {
    let created = 0;
    for (const [accountNo, name, accountType, purpose] of STANDARD_ACCOUNTS) {
      const existing = await tx.gLAccount.findUnique({ where: { purpose } });
      if (!existing) {
        const row = await tx.gLAccount.create({
          data: { accountNo, name, accountType, purpose },
        });
        await audit(tx, user, "MASTER_ACCOUNTS", "CREATE", row.id, null, row);
        created++;
      }
    }
    return { created };
  });
}
