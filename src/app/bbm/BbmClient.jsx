"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { useDialog } from "@/components/DialogProvider";
import CameraScanner from "@/components/field/CameraScanner";
import { feedback, newId, parse, readRaw, useOfflinePage, useScannerKeys, useStored, useWakeLock, writeJson } from "@/components/field/offline";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Clock,
  CloudOff,
  Fuel,
  ImagePlus,
  Loader2,
  LogOut,
  Minus,
  PackageCheck,
  Plus,
  Search,
  Send,
  Settings,
  Trash2,
  Truck,
  UserRound,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  COUNT_DUE_DAYS,
  DRUM_LITERS,
  FUEL_METHODS,
  FUEL_OFFLINE_WINDOW_MS,
  LARGE_ISSUE_LITERS,
  MAX_ISSUE_LITERS,
  RECEIPT_TOLERANCE,
  USAGE_WINDOW_DAYS,
  liters,
  meterRequired,
  meterUnit,
} from "@/lib/fuel";
import { VEHICLE_TYPE } from "@/lib/ui-labels";

// Web BBM untuk HP petugas BBM site. Setiap catatan masuk antrean di HP (localStorage)
// lalu dikirim ke server; tanpa sinyal, antrean tetap tersimpan dan dikirim begitu online.
// Data site (unit, karyawan, kiriman, stok) juga disimpan di HP agar bisa bekerja offline.

const QUEUE_PREFIX = "prohaba-bbm:";
const CONTEXT_PREFIX = "prohaba-bbm-site:";
const METHOD_KEY = "prohaba-bbm-method";
const QR = /^PRHB1\.([A-Za-z0-9-]{1,40})\.[A-Za-z0-9_-]{12}$/;
const EMPTY = [];
const MAX_BATCH_CHARS = 1_500_000;
const KIND_LABEL = { ISSUE: "Keluar", RECEIPT: "Terima", COUNT: "Opname", REQUEST: "Pengajuan" };

// ─── Antrean di HP ──────────────────────────────────────────────────────────
function updateQueue(key, change) {
  const cutoff = Date.now() - FUEL_OFFLINE_WINDOW_MS;
  const next = change(parse(readRaw(key), EMPTY))
    .filter((i) => i.status === "pending" || Date.parse(i.at) > cutoff)
    .slice(-500);
  return writeJson(key, next);
}

let flushing = false;
/** Kirim catatan yang belum terkirim. Hasil: ok | offline | expired | error, plus jumlah yang ditolak dan diterima. */
async function flush(key) {
  if (flushing) return null;
  flushing = true;
  let rejected = 0, accepted = 0;
  try {
    for (;;) {
      const pending = parse(readRaw(key), EMPTY).filter((i) => i.status === "pending");
      if (!pending.length) return { state: "ok", rejected, accepted };
      // Batasi ukuran kiriman karena catatan bisa membawa foto meter.
      const batch = [];
      let size = 0;
      for (const i of pending.slice(0, 20)) {
        const entry = { clientId: i.clientId, kind: i.kind, at: i.at, ...i.payload };
        size += JSON.stringify(entry).length;
        if (batch.length && size > MAX_BATCH_CHARS) break;
        batch.push(entry);
      }
      let response;
      try {
        response = await fetch("/api/bbm/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentAt: new Date().toISOString(), entries: batch }),
        });
      } catch {
        return { state: "offline", rejected, accepted };
      }
      if (response.status === 401) return { state: "expired", rejected, accepted };
      if (!response.ok) return { state: "error", rejected, accepted, message: (await response.json().catch(() => null))?.error };
      const { results } = await response.json();
      const byId = new Map(results.map((r) => [r.clientId, r]));
      results.forEach((r) => (r.status === "rejected" ? rejected++ : accepted++));
      updateQueue(key, (items) =>
        items.map((i) => {
          const r = byId.get(i.clientId);
          if (!r) return i;
          // Foto tidak perlu disimpan lagi di HP setelah diproses server.
          const payload = { ...i.payload };
          delete payload.photo;
          return { ...i, status: r.status, message: r.message ?? null, number: r.number ?? null, payload, syncedAt: Date.now() };
        }),
      );
    }
  } finally {
    flushing = false;
  }
}

const timeOf = (at) => new Date(at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(".", ":");
const dayOf = (at) => new Date(at).toDateString();
// Nomor dokumen dari server (pengajuan/kiriman) bila belum tercantum di judul catatan.
const numberOf = (i) => (i.number && !i.label?.title?.includes(i.number) ? i.number : null);
const num = (v) => (v === "" || v == null ? null : Number(String(v).replace(",", ".")));

/** Kompres foto meter agar kecil disimpan di HP dan dikirim lewat sinyal lemah. */
async function compressPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  let quality = 0.6, url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > 200_000 && quality > 0.25) url = canvas.toDataURL("image/jpeg", (quality -= 0.1));
  return url;
}

export default function BbmClient({ user }) {
  const queueKey = QUEUE_PREFIX + user.id, contextKey = CONTEXT_PREFIX + user.id;
  const items = useStored(queueKey, EMPTY);
  const site = useStored(contextKey, null);
  const [sync, setSync] = useState("ok");
  const [siteError, setSiteError] = useState("");
  const [screen, setScreen] = useState("home");
  const [banner, setBanner] = useState(null);
  const [menu, setMenu] = useState(false);
  const { showConfirm, showAlert } = useDialog();

  const pending = items.filter((i) => i.status === "pending");

  async function loadSite() {
    try {
      const response = await fetch("/api/bbm/context");
      if (response.ok) {
        writeJson(contextKey, { ...(await response.json()), loadedAt: Date.now() });
        setSiteError("");
      } else if (response.status === 409) setSiteError((await response.json()).error);
      else if (response.status === 401) setSync("expired");
    } catch {}
  }

  async function send() {
    const result = await flush(queueKey);
    if (!result) return;
    setSync(result.state);
    if (result.rejected) feedback(false);
    if (result.accepted) loadSite();
  }

  const sendRef = useRef(send);
  const loadSiteRef = useRef(loadSite);
  useEffect(() => {
    sendRef.current = send;
    loadSiteRef.current = loadSite;
  });

  // Kirim antrean saat dibuka, saat sinyal kembali, saat aplikasi kembali tampil, dan berkala.
  useEffect(() => {
    const retry = () => sendRef.current();
    const visible = () => document.visibilityState === "visible" && retry();
    const first = setTimeout(() => {
      retry();
      loadSiteRef.current();
    }, 0);
    const timer = setInterval(retry, 20000);
    const siteTimer = setInterval(() => loadSiteRef.current(), 10 * 60 * 1000);
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      clearInterval(siteTimer);
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useWakeLock();
  useOfflinePage("/bbm");

  /** Masukkan catatan baru ke antrean lalu coba kirim. */
  async function add(kind, payload, label, ref = null) {
    const item = { clientId: newId(), kind, at: new Date().toISOString(), status: "pending", payload, label, ref };
    if (!updateQueue(queueKey, (list) => [...list, item]) && payload.photo) {
      // Penyimpanan HP penuh: simpan tanpa foto daripada kehilangan catatan.
      const rest = { ...payload };
      delete rest.photo;
      updateQueue(queueKey, (list) => list.map((i) => (i.clientId === item.clientId ? { ...i, payload: rest } : i)));
      await showAlert("Penyimpanan HP penuh, foto meter tidak ikut disimpan. Catatan tetap tersimpan.", "Foto tidak disimpan");
    }
    feedback(true);
    setBanner({ clientId: item.clientId, at: Date.now() });
    setScreen("home");
    send();
  }

  const bannerItem = banner ? items.find((i) => i.clientId === banner.clientId) : null;
  const bannerStatus = bannerItem?.status;
  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), bannerStatus === "rejected" ? 12000 : 7000);
    return () => clearTimeout(id);
  }, [banner, bannerStatus]);

  // Stok di HP: stok server terakhir dikoreksi catatan yang belum masuk ke angka itu
  // (belum terkirim, atau terkirim sesudah data site terakhir dimuat).
  const stock = useMemo(() => {
    if (!site) return null;
    const unseen = items.filter((i) => i.status === "pending" || (i.status === "ok" && i.syncedAt > (site.loadedAt ?? 0)));
    const total = (kind) => unseen.filter((i) => i.kind === kind).reduce((s, i) => s + (i.label?.liters ?? i.payload?.liters ?? 0), 0);
    return { ...site.stock, liters: site.stock.liters - total("ISSUE") + total("RECEIPT") };
  }, [site, items]);
  const handled = new Set(items.filter((i) => i.kind === "RECEIPT" && i.status !== "rejected").map((i) => i.ref));
  const shipments = (site?.shipments ?? []).filter((s) => !handled.has(s.id));
  const openRequest = site?.openRequest ?? (pending.find((i) => i.kind === "REQUEST") ? { status: "PENDING_SEND" } : null);

  const back = () => setScreen("home");

  return (
    <main className="absen bbm">
      <header className="absen-header">
        {screen === "home" ? (
          // unoptimized: berkas asli /brand ikut tersimpan service worker untuk offline.
          <Image src="/brand/prohaba-mark.png" alt="" width={36} height={31} unoptimized />
        ) : (
          <button type="button" className="absen-icon-btn" onClick={back} aria-label="Kembali">
            <ChevronLeft aria-hidden />
          </button>
        )}
        <div className="absen-title">
          <strong>{{ home: "BBM Site", issue: "Keluarkan BBM", receive: "Terima kiriman", count: "Opname stok", request: "Ajukan drum" }[screen]}</strong>
          <span>{site ? `${site.site.code} · ${site.site.name}` : user.name}</span>
        </div>
        <SyncPill sync={sync} pending={pending.length} onRetry={send} />
        {screen === "home" && (
          <button type="button" className="absen-icon-btn" onClick={() => setMenu(!menu)} aria-label="Pengaturan" aria-expanded={menu}>
            <Settings aria-hidden />
          </button>
        )}
      </header>

      {menu && screen === "home" && (
        <div className="absen-menu">
          <span className="muted">Masuk sebagai {user.name}</span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={async () => {
              if (!pending.length || (await showConfirm(`${pending.length} catatan belum terkirim. Catatan tetap tersimpan di HP ini dan terkirim setelah Anda login lagi. Keluar sekarang?`, "Keluar")))
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
          <span>Sesi login habis. {pending.length ? `${pending.length} catatan tersimpan aman di HP ini. ` : ""}<a href="/login">Login ulang</a> untuk mengirimnya.</span>
        </p>
      )}
      {siteError && (
        <p className="alert alert-danger absen-alert" role="alert">
          <AlertTriangle aria-hidden /> <span>{siteError}</span>
        </p>
      )}

      {!site ? (
        <section className="bbm-body">
          <div className="absen-banner idle">
            <strong>{siteError ? "Site belum diatur" : "Mengunduh data site…"}</strong>
            <span>Buka web ini sekali saat ada sinyal agar daftar unit, karyawan dan kiriman tersimpan di HP.</span>
          </div>
        </section>
      ) : screen === "issue" ? (
        <IssueForm site={site} onSave={add} />
      ) : screen === "receive" ? (
        <ReceiveForm shipments={shipments} onSave={add} />
      ) : screen === "count" ? (
        <CountForm onSave={add} />
      ) : screen === "request" ? (
        <RequestForm stock={stock} openRequest={openRequest} onSave={add} />
      ) : (
        <Home stock={stock} shipments={shipments} openRequest={openRequest} items={items} banner={banner} bannerItem={bannerItem} sync={sync} onOpen={setScreen} />
      )}
    </main>
  );
}

// ─── Beranda ────────────────────────────────────────────────────────────────
function Home({ stock, shipments, openRequest, items, banner, bannerItem, sync, onOpen }) {
  const today = dayOf(new Date());
  const todayItems = items.filter((i) => dayOf(i.at) === today).reverse();
  const out = todayItems.filter((i) => i.kind === "ISSUE" && i.status !== "rejected").reduce((s, i) => s + (i.label?.liters ?? 0), 0);
  // Umur opname dihitung saat halaman dibuka; cukup akurat untuk pengingat harian.
  const [openedAt] = useState(() => Date.now());
  const countAge = stock.lastCountAt ? Math.floor((openedAt - Date.parse(stock.lastCountAt)) / 86400000) : null;
  const countDue = countAge == null || countAge >= COUNT_DUE_DAYS;
  return (
    <section className="bbm-body">
      {banner && bannerItem && <EntryBanner item={bannerItem} sync={sync} />}

      <div className="bbm-stock">
        <span className="bbm-stock-label">Stok BBM site (perkiraan sistem)</span>
        <strong className={stock.liters < 0 ? "bbm-negative" : ""}>{liters(stock.liters)}</strong>
        <span>
          ≈ {(stock.liters / DRUM_LITERS).toLocaleString("id-ID", { maximumFractionDigits: 1 })} drum
          {stock.daysCover != null && ` · cukup ±${stock.daysCover} hari`}
          {stock.perDay > 0 && ` · rata-rata ${liters(stock.perDay)}/hari`}
        </span>
      </div>

      {countDue && (
        <button type="button" className="bbm-notice warn" onClick={() => onOpen("count")}>
          <ClipboardCheck aria-hidden />
          <span>{countAge == null ? "Belum pernah opname. Lakukan opname pertama sekarang." : `Opname terakhir ${countAge} hari lalu. Waktunya opname mingguan.`}</span>
        </button>
      )}
      {shipments.length > 0 && (
        <button type="button" className="bbm-notice info" onClick={() => onOpen("receive")}>
          <Truck aria-hidden />
          <span>{shipments.length} kiriman dari HO dalam perjalanan. Konfirmasi saat drum tiba.</span>
        </button>
      )}

      <div className="bbm-actions">
        <button type="button" className="bbm-action primary" onClick={() => onOpen("issue")}>
          <Fuel aria-hidden />
          <strong>Keluarkan BBM</strong>
          <span>Scan kartu pengambil</span>
        </button>
        <button type="button" className="bbm-action" onClick={() => onOpen("receive")}>
          <PackageCheck aria-hidden />
          <strong>Terima kiriman</strong>
          <span>{shipments.length ? `${shipments.length} menunggu` : "Tidak ada kiriman"}</span>
        </button>
        <button type="button" className="bbm-action" onClick={() => onOpen("count")}>
          <ClipboardCheck aria-hidden />
          <strong>Opname</strong>
          <span>{countAge == null ? "Belum pernah" : countAge === 0 ? "Hari ini" : `${countAge} hari lalu`}</span>
        </button>
        <button type="button" className="bbm-action" onClick={() => onOpen("request")}>
          <Send aria-hidden />
          <strong>Ajukan drum</strong>
          <span>{openRequest ? "Sedang diproses" : "Ke Logistik HO"}</span>
        </button>
      </div>

      <div className="absen-today">
        <div className="absen-today-head">
          <strong>Catatan saya hari ini</strong>
          <span>{liters(out)} keluar</span>
        </div>
        <ul>
          {todayItems.map((i) => (
            <li key={i.clientId} className={"absen-row " + i.status}>
              <span className="absen-row-time">{timeOf(i.at)}</span>
              <span className="absen-row-main">
                <strong>{KIND_LABEL[i.kind]} · {i.label?.title}</strong>
                <span>{i.status === "rejected" ? i.message : [i.label?.detail, i.status === "pending" && "belum terkirim", numberOf(i)].filter(Boolean).join(" · ")}</span>
              </span>
              <StatusIcon status={i.status} />
            </li>
          ))}
          {!todayItems.length && <li className="absen-empty">Belum ada catatan hari ini.</li>}
        </ul>
      </div>
    </section>
  );
}

// ─── Keluarkan BBM ──────────────────────────────────────────────────────────
function IssueForm({ site, onSave }) {
  const { showConfirm } = useDialog();
  const [taker, setTaker] = useState(null); // { code, name, nip } atau { name, manual: true }
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [scanError, setScanError] = useState("");
  const [vehicle, setVehicle] = useState(null);
  const [query, setQuery] = useState("");
  const [meter, setMeter] = useState("");
  const [runHours, setRunHours] = useState("");
  const [amount, setAmount] = useState("");
  const savedMethod = useStored(METHOD_KEY, "");
  const [method, setMethod] = useState(savedMethod in FUEL_METHODS ? savedMethod : "");
  const [photo, setPhoto] = useState(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const people = useMemo(() => new Map(site.employees.map((e) => [e.employeeNo, e])), [site]);

  function scan(raw) {
    const value = raw.trim(), match = QR.exec(value);
    if (!match) {
      feedback(false);
      setScanError("Bukan kartu absensi Prohaba. Scan kartu QR karyawan.");
      return;
    }
    const person = people.get(match[1]);
    feedback(true);
    setScanError("");
    setTaker({ code: value, name: person?.name ?? "Kartu terbaca (nama muncul setelah terkirim)", nip: person?.nip ?? null, position: person?.position ?? null });
  }
  useScannerKeys(scan, !taker && !manual);

  const unit = vehicle ? meterUnit(vehicle.type) : null;
  const q = query.trim().toLowerCase();
  const matches = q
    ? site.vehicles.filter((v) => [v.code, v.name, v.plateNumber].some((x) => x?.toLowerCase().includes(q))).slice(0, 30)
    : site.vehicles.slice(0, 8);

  async function save(e) {
    e.preventDefault();
    setError("");
    const l = num(amount), m = num(meter), h = num(runHours);
    if (!(l > 0) || l > MAX_ISSUE_LITERS) return setError(`Isi jumlah liter (0,1–${MAX_ISSUE_LITERS} L).`);
    if (!method) return setError("Pilih cara takar.");
    if (meterRequired(vehicle.type) && m == null) return setError(`Isi ${unit} ${vehicle.name}.`);
    if (vehicle.type === "GENSET" && m == null && !(h > 0)) return setError("Isi HM genset, atau lama nyala bila HM rusak.");
    if (m != null && vehicle.lastMeter != null && m < vehicle.lastMeter) return setError(`${unit} tidak boleh lebih kecil dari catatan terakhir (${vehicle.lastMeter.toLocaleString("id-ID")}).`);
    if (l > LARGE_ISSUE_LITERS && !(await showConfirm(`${liters(l)} untuk ${vehicle.name}? Jumlah ini besar dan akan ditandai untuk diperiksa HO.`, "Pengambilan besar"))) return;
    setBusy(true);
    writeJson(METHOD_KEY, method);
    onSave(
      "ISSUE",
      {
        vehicleId: vehicle.id,
        liters: l,
        method,
        meterValue: m,
        runHours: m == null && h > 0 ? h : null,
        ...(taker.manual ? { takerName: taker.name } : { takerCode: taker.code }),
        notes: notes.trim() || null,
        ...(photo ? { photo } : {}),
      },
      { title: `${liters(l)} · ${vehicle.code ?? vehicle.name}`, detail: taker.name, liters: l },
    );
  }

  if (!taker)
    return (
      <section className="bbm-body">
        <p className="bbm-step"><span>1</span> Siapa yang mengambil?</p>
        {manual ? (
          <form
            className="bbm-card"
            onSubmit={(e) => {
              e.preventDefault();
              if (manualName.trim().length >= 3) setTaker({ name: manualName.trim(), manual: true });
            }}
          >
            <label className="form-label required" htmlFor="bbm-taker">Nama pengambil (subkon/tamu)</label>
            <input id="bbm-taker" className="form-input" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Nama lengkap & perusahaan" autoFocus minLength={3} required />
            <p className="form-hint">Pengambilan tanpa kartu ditandai untuk diperiksa HO.</p>
            <div className="bbm-row">
              <button type="button" className="btn btn-outline" onClick={() => setManual(false)}><Camera aria-hidden /> Scan kartu</button>
              <button type="submit" className="btn btn-primary">Lanjut</button>
            </div>
          </form>
        ) : (
          <>
            <CameraScanner onCode={scan} />
            <div className={"absen-banner " + (scanError ? "error" : "idle")} role={scanError ? "alert" : undefined}>
              <strong>{scanError ? "Kartu tidak dikenali" : "Scan kartu QR absensi pengambil"}</strong>
              <span>{scanError || "Orang yang menerima BBM, bukan petugas BBM."}</span>
            </div>
            <button type="button" className="btn btn-outline" onClick={() => setManual(true)}><UserRound aria-hidden /> Tanpa kartu (subkon/tamu)</button>
          </>
        )}
      </section>
    );

  return (
    <form className="bbm-body" onSubmit={save}>
      <div className="bbm-chip">
        <UserRound aria-hidden />
        <div><strong>{taker.name}</strong><span>{taker.manual ? "Tanpa kartu" : [taker.nip && `NIP ${taker.nip}`, taker.position].filter(Boolean).join(" · ") || "Kartu QR"}</span></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTaker(null); setManual(false); }}>Ganti</button>
      </div>

      {!vehicle ? (
        <>
          <p className="bbm-step"><span>2</span> Untuk unit apa?</p>
          <div className="bbm-search">
            <Search aria-hidden />
            <input className="form-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kode, nama atau nomor polisi" aria-label="Cari unit" />
          </div>
          <ul className="bbm-list">
            {matches.map((v) => (
              <li key={v.id}>
                <button type="button" onClick={() => { setVehicle(v); setMeter(""); setRunHours(""); }}>
                  <strong>{v.code ? `${v.code} · ` : ""}{v.name}</strong>
                  <span>{[VEHICLE_TYPE[v.type] ?? v.type, v.plateNumber, v.lastMeter != null && `${meterUnit(v.type)} terakhir ${v.lastMeter.toLocaleString("id-ID")}`].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
            {!matches.length && <li className="absen-empty">Unit tidak ditemukan. Minta Logistik HO mendaftarkannya.</li>}
          </ul>
          {!q && site.vehicles.length > matches.length && <p className="form-hint">Menampilkan unit yang paling sering diisi di site ini. Ketik untuk mencari unit lain.</p>}
        </>
      ) : (
        <>
          <div className="bbm-chip">
            <Truck aria-hidden />
            <div><strong>{vehicle.code ? `${vehicle.code} · ` : ""}{vehicle.name}</strong><span>{VEHICLE_TYPE[vehicle.type] ?? vehicle.type}</span></div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVehicle(null)}>Ganti</button>
          </div>
          <p className="bbm-step"><span>3</span> Isi pengambilan</p>
          <div className="bbm-card">
            {unit && (
              <div className="form-group">
                <label className={"form-label" + (meterRequired(vehicle.type) ? " required" : "")} htmlFor="bbm-meter">{unit === "km" ? "Odometer sekarang (km)" : "HM sekarang"}</label>
                <input id="bbm-meter" className="form-input bbm-big-input" inputMode="decimal" value={meter} onChange={(e) => setMeter(e.target.value)} placeholder={vehicle.lastMeter != null ? `Terakhir ${vehicle.lastMeter.toLocaleString("id-ID")}` : "Lihat di panel unit"} />
              </div>
            )}
            {vehicle.type === "GENSET" && !meter && (
              <div className="form-group">
                <label className="form-label" htmlFor="bbm-run">Lama nyala sejak isi terakhir (jam) — bila HM rusak</label>
                <input id="bbm-run" className="form-input" inputMode="decimal" value={runHours} onChange={(e) => setRunHours(e.target.value)} placeholder="mis. 12" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label required" htmlFor="bbm-liters">Jumlah (liter)</label>
              <input id="bbm-liters" className="form-input bbm-big-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              <div className="bbm-quick">
                {[10, 20, 50, 100, 200].map((n) => (
                  <button key={n} type="button" className={"chip" + (num(amount) === n ? " active" : "")} onClick={() => setAmount(String(n))}>{n} L</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <span className="form-label required">Cara takar</span>
              <div className="bbm-segment" role="radiogroup" aria-label="Cara takar">
                {Object.entries(FUEL_METHODS).map(([value, label]) => (
                  <button key={value} type="button" role="radio" aria-checked={method === value} className={method === value ? "active" : ""} onClick={() => setMethod(value)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <span className="form-label">Foto meter / flow meter</span>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  setPhoto(await compressPhoto(file));
                } catch {
                  setError("Foto tidak dapat dibaca. Coba ambil ulang.");
                }
              }} />
              {photo ? (
                <div className="bbm-photo">
                  <img src={photo} alt="Foto meter" />
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPhoto(null)}><Trash2 aria-hidden /> Hapus</button>
                </div>
              ) : (
                <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()}><ImagePlus aria-hidden /> Ambil foto</button>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="bbm-notes">Catatan</label>
              <input id="bbm-notes" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" maxLength={500} />
            </div>
          </div>
          {error && <p className="alert alert-danger" role="alert"><AlertTriangle aria-hidden /> {error}</p>}
          <button type="submit" className="btn btn-primary bbm-submit" disabled={busy}><Fuel aria-hidden /> Simpan pengambilan</button>
        </>
      )}
    </form>
  );
}

// ─── Terima kiriman ─────────────────────────────────────────────────────────
function ReceiveForm({ shipments, onSave }) {
  const [selected, setSelected] = useState(null);
  const [drums, setDrums] = useState("");
  const [amount, setAmount] = useState("");
  const [seal, setSeal] = useState(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  if (!shipments.length)
    return (
      <section className="bbm-body">
        <div className="absen-banner idle">
          <strong>Tidak ada kiriman dalam perjalanan</strong>
          <span>Kiriman muncul di sini setelah Logistik HO mencatat pengiriman drum ke site ini. Bila drum tiba tanpa catatan, hubungi Logistik HO.</span>
        </div>
      </section>
    );

  if (!selected)
    return (
      <section className="bbm-body">
        <p className="bbm-step"><span>1</span> Pilih kiriman yang tiba</p>
        <ul className="bbm-list">
          {shipments.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => { setSelected(s); setDrums(String(s.drums)); setAmount(String(s.liters)); setSeal(null); }}>
                <strong>{s.number} · {s.drums} drum · {liters(s.liters)}</strong>
                <span>{[new Date(s.sentAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }), s.driver && `Sopir ${s.driver}`, s.plateNumber].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );

  const d = num(drums), l = num(amount);
  const short = d != null && l != null && (d < selected.drums || l < selected.liters * (1 - RECEIPT_TOLERANCE) || seal === false);
  function save(e) {
    e.preventDefault();
    setError("");
    if (!Number.isInteger(d) || d < 0 || d > selected.drums) return setError(`Jumlah drum 0–${selected.drums}.`);
    if (!(l >= 0) || l > selected.liters * 1.02) return setError("Liter diterima tidak boleh melebihi yang dikirim.");
    if (seal == null) return setError("Pilih kondisi segel.");
    if (short && !notes.trim()) return setError("Jumlah kurang atau segel rusak: tulis keterangannya.");
    onSave(
      "RECEIPT",
      { shipmentId: selected.id, drums: d, liters: l, sealIntact: seal, notes: notes.trim() || null },
      { title: `${selected.number} · ${d} drum`, detail: short ? `kurang dari kiriman (${liters(l)} dari ${liters(selected.liters)})` : liters(l), liters: l },
      selected.id,
    );
  }
  return (
    <form className="bbm-body" onSubmit={save}>
      <div className="bbm-chip">
        <Truck aria-hidden />
        <div><strong>{selected.number}</strong><span>Dikirim {selected.drums} drum · {liters(selected.liters)}{selected.driver ? ` · ${selected.driver}` : ""}</span></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Ganti</button>
      </div>
      {selected.sealNumbers && <p className="form-hint">Nomor segel dari HO: <strong>{selected.sealNumbers}</strong>. Cocokkan dengan segel di drum.</p>}
      <p className="bbm-step"><span>2</span> Hitung yang benar-benar tiba</p>
      <div className="bbm-card">
        <Stepper id="rc-drums" label="Drum diterima" value={drums} onChange={setDrums} />
        <div className="form-group">
          <label className="form-label required" htmlFor="rc-liters">Total liter diterima</label>
          <input id="rc-liters" className="form-input bbm-big-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="form-hint">Ubah bila ada drum yang tidak penuh atau bocor.</p>
        </div>
        <div className="form-group">
          <span className="form-label required">Kondisi segel</span>
          <div className="bbm-segment" role="radiogroup" aria-label="Kondisi segel">
            <button type="button" role="radio" aria-checked={seal === true} className={seal === true ? "active" : ""} onClick={() => setSeal(true)}>Utuh &amp; cocok</button>
            <button type="button" role="radio" aria-checked={seal === false} className={seal === false ? "active danger" : ""} onClick={() => setSeal(false)}>Rusak / tidak cocok</button>
          </div>
        </div>
        <div className="form-group">
          <label className={"form-label" + (short ? " required" : "")} htmlFor="rc-notes">Keterangan</label>
          <input id="rc-notes" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={short ? "Jelaskan kekurangan / kerusakan" : "Opsional"} maxLength={1000} />
        </div>
      </div>
      {short && <p className="alert alert-warning" role="status"><AlertTriangle aria-hidden /> Penerimaan tidak sesuai kiriman. HO akan melihat selisih ini.</p>}
      {error && <p className="alert alert-danger" role="alert"><AlertTriangle aria-hidden /> {error}</p>}
      <button type="submit" className="btn btn-primary bbm-submit"><PackageCheck aria-hidden /> Konfirmasi penerimaan</button>
    </form>
  );
}

// ─── Opname ─────────────────────────────────────────────────────────────────
const OPEN_PRESETS = [["¾", 150], ["½", 100], ["¼", 50], ["Dasar", 10]];
function CountForm({ onSave }) {
  const { showConfirm } = useDialog();
  const [full, setFull] = useState("0");
  const [open, setOpen] = useState([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const openLiters = open.reduce((s, o) => s + (num(o.liters) || 0), 0);
  const fullDrums = num(full);
  const total = (fullDrums || 0) * DRUM_LITERS + openLiters;

  async function save(e) {
    e.preventDefault();
    setError("");
    if (!Number.isInteger(fullDrums) || fullDrums < 0) return setError("Jumlah drum penuh harus bilangan bulat.");
    if (open.some((o) => !(num(o.liters) >= 0) || num(o.liters) > DRUM_LITERS)) return setError(`Isi tiap drum terbuka 0–${DRUM_LITERS} L.`);
    if (!(await showConfirm(`${fullDrums} drum penuh + ${open.length} drum terbuka (${liters(openLiters)}) = ${liters(total)}. Simpan opname?`, "Simpan opname"))) return;
    onSave("COUNT", { fullDrums, openLiters, notes: notes.trim() || null }, { title: liters(total), detail: `${fullDrums} penuh + ${open.length} terbuka` });
  }
  return (
    <form className="bbm-body" onSubmit={save}>
      <p className="form-hint">Hitung fisik semua drum di site apa adanya, termasuk drum di unit/genset yang belum dituang.</p>
      <div className="bbm-card">
        <Stepper id="ct-full" label={`Drum penuh (masih bersegel, ${DRUM_LITERS} L)`} value={full} onChange={setFull} />
      </div>
      <p className="bbm-step"><span>+</span> Drum terbuka</p>
      <div className="bbm-card">
        {open.map((o, index) => (
          <div key={o.id} className="bbm-open">
            <span className="bbm-open-no">#{index + 1}</span>
            <input className="form-input" inputMode="decimal" value={o.liters} aria-label={`Isi drum terbuka ${index + 1} (liter)`} placeholder="liter"
              onChange={(e) => setOpen(open.map((x) => (x.id === o.id ? { ...x, liters: e.target.value } : x)))} />
            <div className="bbm-quick">
              {OPEN_PRESETS.map(([label, value]) => (
                <button key={label} type="button" className={"chip" + (num(o.liters) === value ? " active" : "")} onClick={() => setOpen(open.map((x) => (x.id === o.id ? { ...x, liters: String(value) } : x)))}>{label}</button>
              ))}
            </div>
            <button type="button" className="absen-icon-btn" aria-label={`Hapus drum terbuka ${index + 1}`} onClick={() => setOpen(open.filter((x) => x.id !== o.id))}><Trash2 aria-hidden /></button>
          </div>
        ))}
        <button type="button" className="btn btn-outline" onClick={() => setOpen([...open, { id: newId(), liters: "" }])}><Plus aria-hidden /> Tambah drum terbuka</button>
        <p className="form-hint">Ukur dengan tongkat ukur bila ada; bila tidak, pilih perkiraan ¾, ½, ¼ atau sisa dasar.</p>
      </div>
      <div className="bbm-total"><span>Total fisik</span><strong>{liters(total)}</strong></div>
      <div className="form-group">
        <label className="form-label" htmlFor="ct-notes">Catatan</label>
        <input id="ct-notes" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="mis. 1 drum bocor, saksi: Pak Budi" maxLength={1000} />
      </div>
      {error && <p className="alert alert-danger" role="alert"><AlertTriangle aria-hidden /> {error}</p>}
      <button type="submit" className="btn btn-primary bbm-submit"><ClipboardCheck aria-hidden /> Simpan opname</button>
    </form>
  );
}

// ─── Ajukan drum ────────────────────────────────────────────────────────────
function RequestForm({ stock, openRequest, onSave }) {
  // Saran: cukup untuk 3 minggu ke depan dengan pemakaian rata-rata saat ini.
  const suggested = stock.perDay > 0 ? Math.max(1, Math.ceil((stock.perDay * 21 - stock.liters) / DRUM_LITERS)) : 1;
  const [drums, setDrums] = useState(String(suggested));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  if (openRequest)
    return (
      <section className="bbm-body">
        <div className="absen-banner idle">
          <strong>{openRequest.number ? `Pengajuan ${openRequest.number}` : "Pengajuan belum terkirim"}</strong>
          <span>
            {openRequest.status === "PENDING_SEND"
              ? "Tersimpan di HP dan terkirim otomatis saat ada sinyal."
              : `${openRequest.drums} drum · ${openRequest.status === "APPROVED" ? "disetujui, menunggu dikirim HO" : "menunggu persetujuan HO"}. Pengajuan baru bisa dibuat setelah ini dikirim atau ditolak.`}
          </span>
        </div>
      </section>
    );
  function save(e) {
    e.preventDefault();
    const d = num(drums);
    if (!Number.isInteger(d) || d < 1 || d > 500) return setError("Jumlah drum 1–500.");
    onSave("REQUEST", { drums: d, notes: notes.trim() || null }, { title: `${d} drum`, detail: `stok ${liters(stock.liters)}` });
  }
  return (
    <form className="bbm-body" onSubmit={save}>
      <div className="bbm-card bbm-facts">
        <div><span>Stok sistem</span><strong>{liters(stock.liters)}</strong></div>
        <div><span>Pemakaian {USAGE_WINDOW_DAYS} hari</span><strong>{liters(stock.usage)}</strong></div>
        <div><span>Rata-rata / hari</span><strong>{liters(stock.perDay)}</strong></div>
        <div><span>Perkiraan cukup</span><strong>{stock.daysCover != null ? `${stock.daysCover} hari` : "-"}</strong></div>
      </div>
      <p className="form-hint">Angka ini dihitung sistem dan ikut terkirim ke HO bersama pengajuan.</p>
      <div className="bbm-card">
        <Stepper id="rq-drums" label="Jumlah drum diajukan" value={drums} onChange={setDrums} min={1} />
        <p className="form-hint">Saran sistem: {suggested} drum (cukup ±3 minggu).</p>
        <div className="form-group">
          <label className="form-label" htmlFor="rq-notes">Alasan / catatan</label>
          <input id="rq-notes" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="mis. genset tambahan mulai minggu depan" maxLength={1000} />
        </div>
      </div>
      {error && <p className="alert alert-danger" role="alert"><AlertTriangle aria-hidden /> {error}</p>}
      <button type="submit" className="btn btn-primary bbm-submit"><Send aria-hidden /> Kirim pengajuan</button>
    </form>
  );
}

// ─── Komponen kecil ─────────────────────────────────────────────────────────
function Stepper({ id, label, value, onChange, min = 0 }) {
  const n = num(value) || 0;
  return (
    <div className="form-group">
      <label className="form-label required" htmlFor={id}>{label}</label>
      <div className="bbm-stepper">
        <button type="button" className="btn btn-outline" aria-label="Kurangi" onClick={() => onChange(String(Math.max(min, n - 1)))}><Minus aria-hidden /></button>
        <input id={id} className="form-input bbm-big-input" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} />
        <button type="button" className="btn btn-outline" aria-label="Tambah" onClick={() => onChange(String(n + 1))}><Plus aria-hidden /></button>
      </div>
    </div>
  );
}

function EntryBanner({ item, sync }) {
  const title = `${KIND_LABEL[item.kind]} · ${item.label?.title ?? ""}`;
  if (item.status === "rejected")
    return (
      <div className="absen-banner error" role="alert">
        <XCircle aria-hidden />
        <div><strong>{title}</strong><span>{item.message}</span></div>
      </div>
    );
  if (item.status === "ok")
    return (
      <div className="absen-banner ok" role="status">
        <CheckCircle2 aria-hidden />
        <div><strong>{title}</strong><span>Tercatat {timeOf(item.at)}{numberOf(item) ? ` · ${numberOf(item)}` : ""}{item.label?.detail ? ` · ${item.label.detail}` : ""}</span></div>
      </div>
    );
  const offline = sync !== "ok";
  return (
    <div className={"absen-banner " + (offline ? "saved" : "sending")} role="status">
      {offline ? <CloudOff aria-hidden /> : <Loader2 aria-hidden className="spin" />}
      <div><strong>{title}</strong><span>{offline ? `Tersimpan di HP ${timeOf(item.at)} · terkirim otomatis saat ada sinyal` : "Mengirim…"}</span></div>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === "ok") return <CheckCircle2 aria-label="Terkirim" className="absen-row-icon" />;
  if (status === "pending") return <Clock aria-label="Menunggu dikirim" className="absen-row-icon" />;
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
