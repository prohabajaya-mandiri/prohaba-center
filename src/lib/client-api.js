export async function apiFetch(input, init) {
  const response = await globalThis.fetch(input, init);
  if (!response.ok) {
    let data;
    try {
      data = await response.clone().json();
    } catch {}
    throw new Error(
      data?.error ?? "Permintaan gagal (" + response.status + ").",
    );
  }
  return response;
}
export const businessToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
