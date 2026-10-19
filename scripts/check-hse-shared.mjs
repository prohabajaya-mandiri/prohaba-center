// Pastikan berkas yang disalin dari E-HSE tetap identik (form & aturan karyawan sama di kedua aplikasi).
// Jalankan dari prohaba-center dengan repo prohaba-hse berdampingan: node scripts/check-hse-shared.mjs [path-hse]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SHARED = [
  ["src/lib/integration-signature.js", "src/lib/integration-signature.js"],
  ["src/lib/domain/personnel.js", "src/lib/hse/personnel.js"],
  ["src/lib/domain/permit.js", "src/lib/hse/permit.js"],
  ["src/lib/labels.js", "src/lib/hse/labels.js"],
  ["src/lib/dates.js", "src/lib/hse/dates.js"],
];

// Salinan diberi satu baris keterangan di atas dan path impor relatif disesuaikan.
export const normalize = (text) =>
  text.replace(/\r\n/g, "\n").replace(/^\/\/ SALINAN dari .*\n/, "").replaceAll("from '../dates.js'", "from './dates.js'");

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const hse = resolve(process.argv[2] ?? "../prohaba-hse");
  const write = process.argv.includes("--write");
  if (!existsSync(hse + "/src/lib/domain/personnel.js")) {
    console.error("Repo E-HSE tidak ditemukan di " + hse);
    process.exit(2);
  }
  let drift = 0;
  for (const [from, to] of SHARED) {
    const source = readFileSync(hse + "/" + from, "utf8");
    const copy = readFileSync(to, "utf8");
    if (normalize(source) === normalize(copy)) continue;
    drift++;
    if (write) {
      const header = to === from ? "" : `// SALINAN dari prohaba-hse/${from} — jangan diubah di sini; ubah di E-HSE lalu salin ulang (scripts/check-hse-shared.mjs).\n`;
      writeFileSync(to, header + source.replace(/\r\n/g, "\n").replaceAll("from '../dates.js'", "from './dates.js'"));
      console.log("diperbarui: " + to);
    } else console.error("BERBEDA: " + to + " ≠ prohaba-hse/" + from);
  }
  if (drift && !write) {
    console.error("Jalankan: node scripts/check-hse-shared.mjs --write");
    process.exit(1);
  }
  console.log(drift ? `${drift} berkas disalin ulang.` : "Berkas bersama E-HSE identik.");
}
