import * as XLSX from "xlsx";
import { ensure, money, number } from "./validation.js";
export function checkArchive(buffer) {
  ensure(buffer.length <= 4 * 1024 * 1024, "File maksimum 4 MB.");
  if (buffer.readUInt16LE(0) !== 0x4b50) return;
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--)
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  ensure(end >= 0, "Arsip XLSX rusak.");
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16),
    total = 0;
  ensure(count <= 200, "Terlalu banyak file dalam XLSX.");
  for (let i = 0; i < count; i++) {
    ensure(
      at + 46 <= buffer.length && buffer.readUInt32LE(at) === 0x02014b50,
      "Arsip XLSX tidak valid.",
    );
    total += buffer.readUInt32LE(at + 24);
    ensure(
      total <= 16 * 1024 * 1024,
      "Ukuran XLSX setelah ekstraksi terlalu besar.",
    );
    at +=
      46 +
      buffer.readUInt16LE(at + 28) +
      buffer.readUInt16LE(at + 30) +
      buffer.readUInt16LE(at + 32);
  }
}
export function parseBoq(buffer) {
  ensure(buffer.length >= 8, "File kosong/rusak.");
  checkArchive(buffer);
  const book = XLSX.read(buffer, {
    type: "buffer",
    sheets: 0,
    sheetRows: 1015,
    cellStyles: false,
    bookVBA: false,
  });
  const sheet = book.Sheets[book.SheetNames[0]];
  ensure(sheet, "Sheet tidak ditemukan.");
  const range = XLSX.utils.decode_range(
    sheet["!fullref"] || sheet["!ref"] || "A1",
  );
  ensure(
    range.e.r < 1015 && range.e.c < 30,
    "Maksimum 1000 baris BOQ dan 30 kolom.",
  );
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const header = rows.findIndex((row) =>
    row.some((v) => typeof v === "string" && /uraian/i.test(v)),
  );
  ensure(header >= 0, "Header URAIAN tidak ditemukan.");
  const items = [];
  for (const row of rows.slice(header + 1)) {
    const code = String(row[0] ?? "").trim(),
      description = String(row[1] ?? "").trim();
    if (
      !code ||
      !description ||
      /^(sub total|total|grand total)/i.test(code) ||
      !/[a-z]/i.test(description)
    )
      continue;
    if (!/^[A-Za-z0-9]+(?:\.[A-Za-z0-9]+){0,3}$/.test(code)) continue;
    const numeric = (v) => (typeof v === "number" ? v : null);
    const total =
      numeric(row[9]) ?? (numeric(row[7]) || 0) + (numeric(row[8]) || 0);
    items.push({
      code,
      description,
      totalPrice: money(total),
      unit: row[4] ? String(row[4]).slice(0, 30) : null,
      quantity: row[3] == null ? null : number(row[3], "Volume", 0, 1e8),
      costMaterial: row[5] == null ? null : money(row[5]),
      costLabor: row[6] == null ? null : money(row[6]),
      totalMaterial: row[7] == null ? null : money(row[7]),
      totalLabor: row[8] == null ? null : money(row[8]),
    });
  }
  ensure(
    items.length > 0 && items.length <= 1000,
    "Tidak ada item BOQ valid atau jumlah melebihi 1000.",
  );
  return items;
}
