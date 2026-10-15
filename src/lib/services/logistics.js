import {
  object,
  text,
  money,
  number,
  date,
  choice,
  ensure,
} from "../validation.js";
import { transaction, audit } from "../transactions.js";
export async function logistics(kind, body, user) {
  let data, model;
  if (kind === "vehicle") {
    object(body, ["code", "name", "type", "plateNumber", "status"]);
    model = "vehicle";
    data = {
      code: text(body.code, "Kode", 100, true),
      name: text(body.name, "Nama"),
      type: choice(body.type, ["ALAT_BERAT", "KENDARAAN", "GENSET"]),
      plateNumber: text(body.plateNumber, "Nomor polisi", 40, true),
      status: choice(body.status ?? "ACTIVE", [
        "ACTIVE",
        "MAINTENANCE",
        "INACTIVE",
      ]),
    };
  } else {
    const common = ["vehicleId", "projectId"];
    if (kind === "fuel") {
      object(body, [
        ...common,
        "fuelType",
        "liters",
        "totalCost",
        "meterValue",
        "operator",
      ]);
      model = "fuelLog";
      data = {
        vehicleId: text(body.vehicleId, "Kendaraan"),
        projectId: text(body.projectId, "Proyek", 200, true),
        date: new Date(),
        fuelType: choice(body.fuelType, [
          "SOLAR",
          "DEXLITE",
          "PERTAMAX",
          "PERTALITE",
          "BIOSOLAR",
          "BENSIN",
        ]),
        liters: number(body.liters, "Liter", 0.001, 1e6),
        totalCost: money(body.totalCost, "Biaya", 0.01),
        meterValue:
          body.meterValue == null ? null : number(body.meterValue, "Meter"),
        operator: text(body.operator, "Operator", 200, true),
        recordedBy: user.id,
      };
    } else {
      object(body, [
        ...common,
        "type",
        "description",
        "cost",
        "meterValue",
        "mechanic",
        "notes",
        "partName",
        "nextServiceMeter",
        "nextServiceDate",
      ]);
      model = "maintenanceLog";
      data = {
        vehicleId: text(body.vehicleId, "Kendaraan"),
        projectId: text(body.projectId, "Proyek", 200, true),
        date: new Date(),
        type: choice(body.type, [
          "SERVICE",
          "GANTI_OLI",
          "SPAREPART",
          "REPAIR",
        ]),
        description: text(body.description, "Uraian", 2000),
        cost: money(body.cost),
        meterValue:
          body.meterValue == null ? null : number(body.meterValue, "Meter"),
        mechanic: text(body.mechanic, "Mekanik", 200, true),
        notes: text(body.notes, "Catatan", 2000, true),
        partName: text(body.partName, "Komponen", 200, true),
        nextServiceMeter:
          body.nextServiceMeter == null
            ? null
            : number(body.nextServiceMeter, "Meter servis berikutnya"),
        nextServiceDate: body.nextServiceDate
          ? date(body.nextServiceDate)
          : null,
        recordedBy: user.id,
      };
      ensure(
        data.nextServiceMeter == null ||
          data.meterValue == null ||
          data.nextServiceMeter > data.meterValue,
        "Meter servis harus di masa depan.",
      );
    }
  }
  return transaction(async (tx) => {
    if (kind !== "vehicle") {
      await tx.vehicle.findUniqueOrThrow({ where: { id: data.vehicleId } });
      if (data.projectId)
        await tx.project.findUniqueOrThrow({
          where: { id: data.projectId, status: { not: "ARCHIVED" } },
        });
    }
    const result = await tx[model].create({ data });
    await audit(tx, user, "LOGISTICS", "CREATE", result.id, null, result);
    return result;
  });
}
