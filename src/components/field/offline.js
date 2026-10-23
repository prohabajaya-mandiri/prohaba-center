"use client";
// Bagian bersama web lapangan di HP (absensi, BBM): penyimpanan di HP, umpan balik scan,
// layar tetap menyala, scanner fisik, dan penyimpanan halaman untuk dibuka tanpa sinyal.
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

// ─── Penyimpanan di HP ──────────────────────────────────────────────────────
const memory = new Map();
const listeners = new Set();
export function readRaw(key) {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? "";
  } catch {
    return memory.get(key) ?? "";
  }
}
/** Simpan; false bila penyimpanan HP penuh (data tetap ada di memori sampai halaman ditutup). */
export function writeJson(key, value) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  let saved = true;
  try {
    localStorage.setItem(key, raw);
  } catch {
    saved = false;
  }
  listeners.forEach((l) => l());
  return saved;
}
function subscribe(callback) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}
export function parse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function useStored(key, fallback) {
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => "");
  return useMemo(() => parse(raw, fallback), [raw, fallback]);
}
export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

// Bunyi & getar singkat sebagai umpan balik (tinggi = terbaca, rendah = ditolak).
let audio;
export function feedback(ok) {
  try {
    navigator.vibrate?.(ok ? 70 : [120, 60, 120]);
  } catch {}
  try {
    audio ??= new AudioContext();
    (ok ? [880] : [220, 180]).forEach((freq, i) => {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(audio.destination);
      const start = audio.currentTime + i * 0.2;
      osc.start(start);
      osc.stop(start + (ok ? 0.12 : 0.18));
    });
  } catch {}
}

/** Scanner fisik (USB/Bluetooth) mengetik isi QR dengan cepat lalu Enter. */
export function useScannerKeys(onScan, enabled = true) {
  const ref = useRef(onScan);
  useEffect(() => {
    ref.current = onScan;
  });
  useEffect(() => {
    if (!enabled) return;
    let buffer = "", last = 0;
    const onKey = (event) => {
      if (event.target.closest?.("input, select, textarea")) return;
      const now = performance.now();
      if (now - last > 150) buffer = "";
      last = now;
      if (event.key === "Enter" || event.key === "Tab") {
        if (buffer.length >= 10) {
          event.preventDefault();
          ref.current(buffer, "SCANNER");
        }
        buffer = "";
      } else if (event.key.length === 1) buffer += event.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

/** Layar tetap menyala selama web lapangan terbuka (bila didukung peramban). */
export function useWakeLock() {
  useEffect(() => {
    let lock;
    const request = () => navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    const visible = () => document.visibilityState === "visible" && request();
    request();
    document.addEventListener("visibilitychange", visible);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      lock?.release().catch(() => {});
    };
  }, []);
}

/**
 * Simpan halaman & aset di HP agar web lapangan tetap terbuka tanpa sinyal (hanya build produksi).
 * Service worker yang sama (/absen-sw.js) dipakai untuk setiap halaman; cache-nya per halaman.
 */
export function useOfflinePage(path) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const cacheAssets = () =>
      caches
        .open(path.slice(1) + "-v1")
        .then((cache) =>
          cache.addAll([
            ...new Set(
              performance
                .getEntriesByType("resource")
                .map((e) => new URL(e.name))
                .filter((u) => u.origin === location.origin && /^\/(_next\/static|brand)\//.test(u.pathname))
                .map((u) => u.pathname + u.search),
            ),
          ]),
        )
        .catch(() => {});
    navigator.serviceWorker.register("/absen-sw.js", { scope: path }).catch(() => {});
    // Muat pemindai cadangan sekarang agar ikut tersimpan untuk dipakai offline.
    import("jsqr").finally(() => setTimeout(cacheAssets, 1500));
  }, [path]);
}
