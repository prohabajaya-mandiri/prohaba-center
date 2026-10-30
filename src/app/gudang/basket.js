'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Keranjang barang yang diambil dari beberapa rak sebelum dibuat satu surat jalan.
// Disimpan di browser HP (per akun tidak dibedakan: satu HP = satu petugas gudang).
const KEY = 'gudang-ambil';
const EVENT = 'gudang-ambil-change';
const EMPTY = '[]';

const read = () => {
  try {
    return localStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
};
const write = (lines) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
};
const subscribe = (cb) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
};

export function useBasket() {
  const raw = useSyncExternalStore(subscribe, read, () => EMPTY);
  const lines = JSON.parse(raw);

  /** Barang yang sama dari rak yang sama dijumlahkan, tidak melebihi stok di rak itu. */
  const add = useCallback((line) => {
    const current = JSON.parse(read());
    const at = current.findIndex((l) => l.itemId === line.itemId && l.locationId === line.locationId);
    if (at >= 0) current[at] = { ...current[at], qty: Math.min(line.available, current[at].qty + line.qty) };
    else current.push(line);
    write(current);
  }, []);
  const remove = useCallback((itemId, locationId) => {
    write(JSON.parse(read()).filter((l) => !(l.itemId === itemId && l.locationId === locationId)));
  }, []);
  const clear = useCallback(() => write([]), []);

  return { lines, add, remove, clear };
}
