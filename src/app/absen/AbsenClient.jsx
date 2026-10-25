"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { useDialog } from "@/components/DialogProvider";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  CloudOff,
  Loader2,
  LogOut,
  RefreshCw,
  Settings,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  DEFAULT_TIMEZONE,
  DUPLICATE_WINDOW_MS,
  MIN_SCANS,
  OFFLINE_WINDOW_MS,
  SCAN_TIMEZONES,
  localDate,
  localTime,
  timeZoneLabel,
} from "@/lib/attendance-scan";
import CameraScanner from "@/components/field/CameraScanner";
import { feedback, newId, parse, readRaw, useOfflinePage, useScannerKeys, useStored, useWakeLock, writeJson } from "@/components/field/offline";
import { fieldHseNote } from "@/lib/hse-flags";

// Web absensi lapangan untuk HP PIC. Setiap scan masuk antrean di HP (localStorage)
// lalu dikirim ke server; tanpa sinyal, antrean tetap tersimpan dan dikirim begitu online.

const QUEUE_PREFIX = "prohaba-absen:";
const ROSTER_KEY = "prohaba-absen-roster";
const TZ_KEY = "prohaba-absen-tz";
const QR = /^PRHB1\.([A-Za-z0-9-]{1,40})\.[A-Za-z0-9_-]{12}$/;
const TIMEZONES = SCAN_TIMEZONES.map(([tz]) => tz);
const EMPTY = [];
const NO_ROSTER = { employees: [] };

// ─── Penyimpanan di HP ──────────────────────────────────────────────────────
function updateQueue(key, change) {
  const cutoff = Date.now() - OFFLINE_WINDOW_MS;
  const next = change(parse(readRaw(key), EMPTY))
    .filter((i) => i.status === "pending" || Date.parse(i.scannedAt) > cutoff)
    .slice(-1500);
  writeJson(key, next);
}
const noopSubscribe = () => () => {};
const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// ─── Pengiriman antrean ─────────────────────────────────────────────────────
let flushing = false;
/** Kirim scan yang belum terkirim. Hasil: idle | ok | offline | expired | error, plus id yang ditolak. */
async function flush(key) {
  if (flushing) return null;
  flushing = true;
  const rejected = [];
  try {
    for (;;) {
      const pending = parse(readRaw(key), EMPTY).filter((i) => i.status === "pending").slice(0, 100);
      if (!pending.length) return { state: "ok", rejected };
      let response;
      try {
        response = await fetch("/api/absen/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sentAt: new Date().toISOString(),
            scans: pending.map(({ clientId, code, scannedAt, timeZone, method }) => ({ clientId, code, scannedAt, timeZone, method })),
          }),
        });
      } catch {
        return { state: "offline", rejected };
      }
      if (response.status === 401) return { state: "expired", rejected };
      if (!response.ok) return { state: "error", rejected };
      const { results } = await response.json();
      const byId = new Map(results.map((r) => [r.clientId, r]));
      results.forEach((r) => r.status === "rejected" && rejected.push(r.clientId));
      updateQueue(key, (items) =>
        items.map((i) => {
          const r = byId.get(i.clientId);
          if (!r) return i;
          return {
            ...i,
            status: r.status,
            message: r.message ?? null,
            name: r.employee?.name ?? i.name,
            nip: r.employee ? r.employee.nip : i.nip,
            position: r.employee?.position ?? i.position,
            projectName: r.projectName ?? null,
            count: r.count ?? null,
            recordedAt: r.scannedAt ?? null,
            flags: r.flags ?? [],
          };
        }),
      );
    }
  } finally {
    flushing = false;
  }
}

export default function AbsenClient({ user }) {
  const queueKey = QUEUE_PREFIX + user.id;
  const items = useStored(queueKey, EMPTY);
  const roster = useStored(ROSTER_KEY, NO_ROSTER);
  const savedZone = useStored(TZ_KEY, "");
  const device = useSyncExternalStore(noopSubscribe, deviceZone, () => "");
  const timeZone = TIMEZONES.includes(savedZone) ? savedZone : TIMEZONES.includes(device) ? device : DEFAULT_TIMEZONE;
  const [sync, setSync] = useState("ok");
  const [banner, setBanner] = useState(null);
  const [camera, setCamera] = useState(true);
  const [menu, setMenu] = useState(false);
  const { showConfirm } = useDialog();

  const people = useMemo(() => new Map(roster.employees.map((e) => [e.employeeNo, e])), [roster]);
  const pending = items.filter((i) => i.status === "pending").length;

  async function send() {
    const result = await flush(queueKey);
    if (!result) return;
    setSync(result.state);
    if (result.rejected.length) feedback(false);
  }

  function scan(raw, method) {
    const value = raw.trim();
    const match = QR.exec(value);
    if (!match) {
      feedback(false);
      setBanner({ local: "invalid", at: Date.now() });
      return;
    }
    const employeeNo = match[1], now = Date.now();
    const recent = parse(readRaw(queueKey), EMPTY).findLast(
      (i) => i.employeeNo === employeeNo && i.status !== "rejected" && now - Date.parse(i.scannedAt) < DUPLICATE_WINDOW_MS,
    );
    if (recent) {
      feedback(true);
      setBanner({ clientId: recent.clientId, local: "duplicate", at: now });
      return;
    }
    const person = people.get(employeeNo);
    const item = {
      clientId: newId(),
      code: value,
      scannedAt: new Date(now).toISOString(),
      timeZone,
      method,
      status: "pending",
      employeeNo, // kode internal dari QR: hanya untuk mencocokkan, tidak ditampilkan
      nip: person?.nip ?? null,
      name: person?.name ?? null,
      position: person?.position ?? null,
    };
    updateQueue(queueKey, (list) => [...list, item]);
    feedback(true);
    setBanner({ clientId: item.clientId, at: now });
    send();
  }

  const scanRef = useRef(scan);
  const sendRef = useRef(send);
  useEffect(() => {
    scanRef.current = scan;
    sendRef.current = send;
  });

  // Kirim antrean saat dibuka, saat sinyal kembali, saat aplikasi kembali tampil, dan berkala.
  useEffect(() => {
    const retry = () => sendRef.current();
    const visible = () => document.visibilityState === "visible" && retry();
    const loadRoster = () =>
      fetch("/api/absen/roster")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && writeJson(ROSTER_KEY, data))
        .catch(() => {});
    const first = setTimeout(retry, 0);
    const timer = setInterval(retry, 20000);
    const rosterTimer = setInterval(loadRoster, 30 * 60 * 1000);
    loadRoster();
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      clearInterval(rosterTimer);
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  useScannerKeys((value, method) => scanRef.current(value, method));

  // Layar tetap menyala dan halaman tersimpan di HP agar web absensi terbuka tanpa sinyal.
  useWakeLock();
  useOfflinePage("/absen");

  const bannerItem = banner?.clientId ? items.find((i) => i.clientId === banner.clientId) : null;
  const bannerStatus = bannerItem?.status;
  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), bannerStatus === "rejected" ? 9000 : 6000);
    return () => clearTimeout(id);
  }, [banner, bannerStatus]);

  const today = localDate(new Date(), timeZone);
  const todayItems = items.filter((i) => localDate(new Date(i.recordedAt ?? i.scannedAt), i.timeZone) === today).reverse();
  const counted = todayItems.filter((i) => i.status !== "rejected");
  const presentCount = new Set(counted.map((i) => i.employeeNo)).size;

  return (
    <main className="absen">
      <header className="absen-header">
        {/* unoptimized: berkas asli /brand ikut tersimpan service worker untuk offline. */}
        <Image src="/brand/prohaba-mark.png" alt="" width={36} height={31} unoptimized />
        <div className="absen-title">
          <strong>Absensi Lapangan</strong>
          <span>{user.name} · {timeZoneLabel(timeZone)}</span>
        </div>
        <SyncPill sync={sync} pending={pending} onRetry={send} />
        <button type="button" className="absen-icon-btn" onClick={() => setMenu(!menu)} aria-label="Pengaturan" aria-expanded={menu}>
          <Settings aria-hidden />
        </button>
      </header>

      {menu && (
        <div className="absen-menu">
          <label className="form-label" htmlFor="ab-tz">Zona waktu lokasi</label>
          <select id="ab-tz" className="form-select" value={timeZone} onChange={(e) => writeJson(TZ_KEY, e.target.value)}>
            {SCAN_TIMEZONES.map(([tz, label]) => <option key={tz} value={tz}>{label} ({tz})</option>)}
          </select>
          <button
            type="button"
            className="btn btn-outline"
            onClick={async () => {
              if (!pending || (await showConfirm(`${pending} scan belum terkirim. Scan tetap tersimpan di HP ini dan terkirim setelah Anda login lagi. Keluar sekarang?`, "Keluar")))
                signOut({ callbackUrl: "/login" });
            }}
          >
            <LogOut aria-hidden /> Keluar
          </button>
        </div>
      )}

      {sync === "expired" && (
        <p className="alert alert-danger absen-alert" role="alert">
          <AlertTriangle aria-hidden />
          <span>Sesi login habis. {pending ? `${pending} scan tersimpan aman di HP ini. ` : ""}<a href="/login">Login ulang</a> untuk mengirimnya.</span>
        </p>
      )}

      <section className="absen-scan">
        {camera ? <CameraScanner onCode={(value) => scanRef.current(value, "KAMERA")} /> : (
          <div className="absen-camera-off">
            <CameraOff aria-hidden />
            <span>Kamera dijeda</span>
          </div>
        )}
        <ScanBanner banner={banner} item={bannerItem} sync={sync} />
        <button type="button" className={"btn " + (camera ? "btn-outline" : "btn-primary")} onClick={() => setCamera(!camera)}>
          {camera ? <CameraOff aria-hidden /> : <Camera aria-hidden />} {camera ? "Jeda kamera" : "Nyalakan kamera"}
        </button>
      </section>

      <section className="absen-today">
        <div className="absen-today-head">
          <strong>Scan saya hari ini</strong>
          <span>{counted.length} scan · {presentCount} orang</span>
        </div>
        <ul>
          {todayItems.map((i) => (
            <li key={i.clientId} className={"absen-row " + i.status}>
              <span className="absen-row-time">{localTime(i.recordedAt ?? i.scannedAt, i.timeZone)}</span>
              <span className="absen-row-main">
                <strong>{i.name ?? "Kartu terbaca"}</strong>
                <span>{rowDetail(i)}</span>
                <HseNote item={i} />
              </span>
              <StatusIcon status={i.status} />
            </li>
          ))}
          {!todayItems.length && <li className="absen-empty">Belum ada scan hari ini. Arahkan kamera ke kartu QR karyawan.</li>}
        </ul>
      </section>
    </main>
  );
}

const nipLabel = (i) => (i.nip ? `NIP ${i.nip}` : i.name ? "NIP belum diisi" : null);

function rowDetail(i) {
  if (i.status === "rejected") return i.message;
  if (i.status === "pending") return [nipLabel(i), "belum terkirim"].filter(Boolean).join(" · ");
  if (i.status === "duplicate") return [nipLabel(i), "scan ganda, tidak dihitung"].filter(Boolean).join(" · ");
  return [nipLabel(i), i.projectName, i.count && `scan ke-${i.count}`].filter(Boolean).join(" · ");
}

/** Catatan HSE di bawah baris/banner scan yang tercatat (MCU tidak berlaku): scan tetap dihitung. */
function HseNote({ item }) {
  const note = item.status === "ok" ? fieldHseNote(item.flags) : null;
  return note ? <span className="absen-hse">{note}</span> : null;
}

function StatusIcon({ status }) {
  if (status === "ok") return <CheckCircle2 aria-label="Terkirim" className="absen-row-icon" />;
  if (status === "pending") return <Clock aria-label="Menunggu dikirim" className="absen-row-icon" />;
  if (status === "duplicate") return <RefreshCw aria-label="Scan ganda" className="absen-row-icon" />;
  return <XCircle aria-label="Ditolak" className="absen-row-icon" />;
}

function SyncPill({ sync, pending, onRetry }) {
  if (sync === "offline" || sync === "error" || sync === "expired")
    return (
      <button type="button" className="absen-pill warn" onClick={onRetry} title="Coba kirim sekarang">
        <CloudOff aria-hidden /> {sync === "offline" ? "Offline" : sync === "expired" ? "Login ulang" : "Gagal kirim"}
        {pending > 0 && ` · ${pending}`}
      </button>
    );
  if (pending)
    return (
      <span className="absen-pill">
        <Loader2 aria-hidden className="spin" /> Mengirim {pending}
      </span>
    );
  return (
    <span className="absen-pill ok">
      <Wifi aria-hidden /> Terkirim
    </span>
  );
}

function ScanBanner({ banner, item, sync }) {
  if (!banner)
    return (
      <div className="absen-banner idle">
        <strong>Siap scan</strong>
        <span>Scan setiap karyawan minimal {MIN_SCANS}× sehari (masuk, siang, pulang).</span>
      </div>
    );
  if (banner.local === "invalid")
    return (
      <div className="absen-banner error" role="alert">
        <XCircle aria-hidden />
        <div><strong>Bukan kartu absensi</strong><span>QR ini bukan kartu absensi Prohaba.</span></div>
      </div>
    );
  if (!item) return null;
  const who = item.name ? (item.nip ? `${item.name} · NIP ${item.nip}` : item.name) : "Kartu terbaca";
  const time = localTime(item.recordedAt ?? item.scannedAt, item.timeZone);
  if (banner.local === "duplicate" || item.status === "duplicate")
    return (
      <div className="absen-banner duplicate" role="status">
        <RefreshCw aria-hidden />
        <div><strong>{who}</strong><span>Sudah di-scan {time}. Tunggu 2 menit untuk scan berikutnya.</span></div>
      </div>
    );
  if (item.status === "rejected")
    return (
      <div className="absen-banner error" role="alert">
        <XCircle aria-hidden />
        <div><strong>{who}</strong><span>{item.message}</span></div>
      </div>
    );
  if (item.status === "ok")
    return (
      <div className={"absen-banner ok" + (item.flags?.length ? " hse" : "")} role="status">
        <CheckCircle2 aria-hidden />
        <div>
          <strong>{who}</strong>
          <span>Tercatat {time}{item.projectName ? ` · ${item.projectName}` : ""} · scan ke-{item.count}</span>
          <HseNote item={item} />
        </div>
      </div>
    );
  const offline = sync !== "ok";
  return (
    <div className={"absen-banner " + (offline ? "saved" : "sending")} role="status">
      {offline ? <CloudOff aria-hidden /> : <Loader2 aria-hidden className="spin" />}
      <div>
        <strong>{who}</strong>
        <span>{offline ? `Tersimpan di HP ${time} · terkirim otomatis saat ada sinyal` : `Mengirim… ${time}`}</span>
      </div>
    </div>
  );
}
