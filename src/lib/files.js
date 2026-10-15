import { ensure } from "./validation.js";
export async function privateFile(file, receipt = false) {
  ensure(
    file &&
      typeof file.arrayBuffer === "function" &&
      file.size > 0 &&
      file.size <= 4 * 1024 * 1024,
    "File harus berukuran 1 byte–4 MB.",
  );
  ensure(
    file.name.length <= 200 &&
      (receipt
        ? /\.(pdf|png|jpe?g)$/i
        : /\.(pdf|png|jpe?g|docx?|xlsx?|dwg|dxf)$/i
      ).test(file.name),
    "Jenis file tidak diizinkan.",
  );
  const data = Buffer.from(await file.arrayBuffer());
  ensure(
    !/\.pdf$/i.test(file.name) || data.subarray(0, 5).toString() === "%PDF-",
    "Isi PDF tidak valid.",
  );
  ensure(
    !/\.png$/i.test(file.name) ||
      data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "Isi PNG tidak valid.",
  );
  ensure(
    !/\.jpe?g$/i.test(file.name) ||
      (data[0] === 255 && data[1] === 216 && data[2] === 255),
    "Isi JPEG tidak valid.",
  );
  return { data, fileName: file.name };
}
export function download(data, fileName) {
  return new Response(data, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition":
        "attachment; filename*=UTF-8''" + encodeURIComponent(fileName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
