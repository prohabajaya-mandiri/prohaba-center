"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { Camera, CameraOff, CheckCircle2, Info, Loader2, LogOut, Settings, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import {
  DEFAULT_TIMEZONE,
  MIN_SCANS,
  SCAN_TIMEZONES,
  localTime,
  timeZoneLabel,
} from "@/lib/attendance-scan";

// ─── Pengaturan kiosk (proyek & zona waktu) disimpan per perangkat ──────────
const KEY = "prohaba-kiosk";
const listeners = new Set();
let memory = "";
function readSettings() {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}
function saveSettings(value) {
  memory = value ? JSON.stringify(value) : "";
  try {
    if (value) localStorage.setItem(KEY, memory);
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}
function subscribeSettings(callback) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}
function parseSettings(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Jam dinding: berdetak tiap detik, kosong saat dirender di server.
function subscribeClock(callback) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}
const clockSnapshot = () => Math.floor(Date.now() / 1000);
const serverClock = () => 0;

// Bunyi singkat sebagai umpan balik scan (tinggi = berhasil, rendah = gagal).
let audio;
function beep(ok) {
  try {
    audio ??= new AudioContext();
    const tones = ok ? [880] : [220, 180];
    tones.forEach((freq, i) => {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(audio.destination);
      const start = audio.currentTime + i * 0.2;
      osc.start(start);
      osc.stop(start + (ok ? 0.15 : 0.18));
    });
  } catch {}
}

export default function KioskClient({ projects, user }) {
  const raw = useSyncExternalStore(subscribeSettings, readSettings, () => "");
  const stored = parseSettings(raw);
  const settings = stored && projects.some((p) => p.id === stored.projectId) ? stored : null;
  const project = settings && projects.find((p) => p.id === settings.projectId);

  if (!settings) return <KioskSetup projects={projects} user={user} initial={stored} />;
  return <KioskScanner key={settings.projectId + settings.timeZone} project={project} timeZone={settings.timeZone} user={user} />;
}

function KioskSetup({ projects, user, initial }) {
  function start(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    saveSettings({ projectId: data.projectId, timeZone: data.timeZone });
  }
  const defaultZone = initial?.timeZone ?? DEFAULT_TIMEZONE;
  return (
    <main className="kiosk kiosk-setup">
      <form className="card kiosk-setup-card" onSubmit={start}>
        <div className="card-body form-stack">
          <Image src="/brand/prohaba-logo.png" alt="Prohaba Jaya Mandiri" width={64} height={61} priority />
          <div>
            <h1 className="kiosk-setup-title">Kiosk absensi</h1>
            <p className="muted">Atur sekali untuk perangkat ini. Karyawan hanya dapat absen di proyek tempat mereka ditugaskan.</p>
          </div>
          {!projects.length && <p role="alert" className="alert alert-danger">Belum ada proyek aktif.</p>}
          <div className="form-group">
            <label className="form-label required" htmlFor="k-project">Proyek / lokasi kiosk</label>
            <select id="k-project" name="projectId" className="form-select" required defaultValue={initial?.projectId ?? ""}>
              <option value="" disabled>Pilih proyek</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.location ? ` — ${p.location}` : ""}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label required" htmlFor="k-tz">Zona waktu lokasi</label>
            <select id="k-tz" name="timeZone" className="form-select" defaultValue={defaultZone}>
              {SCAN_TIMEZONES.map(([tz, label]) => <option key={tz} value={tz}>{label} ({tz})</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-lg" disabled={!projects.length}>Mulai absensi</button>
          <p className="muted kiosk-user">
            Masuk sebagai {user.name} ·{" "}
            <button type="button" className="link-button" onClick={() => signOut({ callbackUrl: "/login" })}>Keluar</button>
          </p>
        </div>
      </form>
    </main>
  );
}

function KioskScanner({ project, timeZone, user }) {
  const second = useSyncExternalStore(subscribeClock, clockSnapshot, serverClock);
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [today, setToday] = useState({ scans: [], present: 0 });
  const [camera, setCamera] = useState(false);
  const inputRef = useRef(null);

  function loadToday() {
    const query = new URLSearchParams({ projectId: project.id, timeZone });
    return apiFetch("/api/absen/today?" + query)
      .then((r) => r.json())
      .then(setToday)
      .catch(() => {});
  }

  useEffect(() => {
    loadToday();
    const id = setInterval(loadToday, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kiosk dipasang ulang (key) saat proyek berganti
  }, []);

  useEffect(() => {
    if (!result) return;
    const id = setTimeout(() => setResult(null), { error: 7000, pending: 20000 }[result.kind] ?? 5000);
    return () => clearTimeout(id);
  }, [result]);

  async function submit(value, method) {
    const scanned = value.trim();
    if (!scanned) return;
    setResult({ kind: "pending" });
    try {
      const response = await apiFetch("/api/absen/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: scanned, projectId: project.id, timeZone, method }),
      });
      const data = await response.json();
      beep(true);
      setResult({ kind: data.duplicate ? "duplicate" : "ok", ...data });
      loadToday();
    } catch (e) {
      beep(false);
      setResult({ kind: "error", message: e.message });
    }
  }

  function onKeyDown(event) {
    // Scanner USB mengetik isi QR lalu mengirim Enter (sebagian mengirim Tab).
    if (event.key !== "Enter" && event.key !== "Tab") return;
    event.preventDefault();
    const value = code;
    setCode("");
    submit(value, "SCANNER");
  }

  // Kolom scan selalu siap menerima ketikan scanner, kecuali saat pengguna memakai kontrol lain.
  function refocus() {
    setTimeout(() => {
      if (document.activeElement === document.body) inputRef.current?.focus();
    }, 200);
  }

  const clock = second ? new Date(second * 1000) : null;
  return (
    <main className="kiosk">
      <header className="kiosk-header">
        <div className="kiosk-brand">
          <Image src="/brand/prohaba-mark.png" alt="" width={46} height={40} />
          <div>
            <strong>{project.name}</strong>
            <span>Kiosk absensi · {timeZoneLabel(timeZone)}</span>
          </div>
        </div>
        <div className="kiosk-clock" aria-live="off">
          <strong>{clock ? clock.toLocaleTimeString("id-ID", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).replaceAll(".", ":") : "--:--:--"}</strong>
          <span>{clock ? clock.toLocaleDateString("id-ID", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }) : " "}</span>
        </div>
        <div className="kiosk-actions">
          <button type="button" className="btn btn-ghost" onClick={() => saveSettings(null)} title="Ganti proyek atau zona waktu">
            <Settings aria-hidden /> Atur
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => signOut({ callbackUrl: "/login" })} title={`Keluar (${user.name})`}>
            <LogOut aria-hidden /> Keluar
          </button>
        </div>
      </header>

      <div className="kiosk-body">
        <section className="kiosk-main">
          <ScanResult result={result} timeZone={timeZone} />
          <div className="kiosk-input">
            <label htmlFor="k-scan" className="form-label">Arahkan kartu ke scanner</label>
            <input
              id="k-scan"
              ref={inputRef}
              className="form-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={refocus}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="Menunggu scan…"
            />
            <button type="button" className={"btn " + (camera ? "btn-outline" : "btn-primary")} onClick={() => setCamera(!camera)}>
              {camera ? <CameraOff aria-hidden /> : <Camera aria-hidden />} {camera ? "Tutup kamera" : "Scan dengan kamera"}
            </button>
          </div>
          {camera && <CameraScanner onCode={(value) => submit(value, "KAMERA")} />}
        </section>

        <aside className="card kiosk-recent">
          <div className="card-header">
            <div className="card-title">Scan hari ini</div>
            <span className="badge badge-success">{today.present} orang hadir</span>
          </div>
          <ul>
            {today.scans.map((s) => (
              <li key={s.id}>
                <span className="kiosk-recent-time">{localTime(s.scannedAt, timeZone)}</span>
                <span className="kiosk-recent-name">{s.employee.name}</span>
                <span className="muted">{s.employee.employeeNo}</span>
              </li>
            ))}
            {!today.scans.length && <li className="muted">Belum ada scan hari ini.</li>}
          </ul>
        </aside>
      </div>
    </main>
  );
}

function ScanResult({ result, timeZone }) {
  if (!result)
    return (
      <div className="kiosk-result idle">
        <Info aria-hidden />
        <div>
          <strong>Silakan scan kartu QR</strong>
          <span>Scan saat masuk, siang dan pulang (minimal {MIN_SCANS}× sehari).</span>
        </div>
      </div>
    );
  if (result.kind === "pending")
    return (
      <div className="kiosk-result idle" role="status">
        <Loader2 aria-hidden className="spin" />
        <div>
          <strong>Memproses scan…</strong>
          <span>Tunggu sebentar.</span>
        </div>
      </div>
    );
  if (result.kind === "error")
    return (
      <div className="kiosk-result error" role="alert">
        <XCircle aria-hidden />
        <div>
          <strong>Scan ditolak</strong>
          <span>{result.message}</span>
        </div>
      </div>
    );
  const { employee, scannedAt, count } = result;
  return (
    <div className={"kiosk-result " + (result.kind === "ok" ? "ok" : "duplicate")} role="status">
      <CheckCircle2 aria-hidden />
      <div>
        <strong>{employee.name}</strong>
        <span>{employee.employeeNo} · {employee.position}</span>
        <span className="kiosk-result-time">
          {result.kind === "ok"
            ? `Tercatat ${localTime(scannedAt, timeZone)} · scan ke-${count} hari ini`
            : `Sudah tercatat ${localTime(scannedAt, timeZone)} · tunggu 2 menit untuk scan berikutnya`}
        </span>
      </div>
    </div>
  );
}

function CameraScanner({ onCode }) {
  const videoRef = useRef(null);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState("");

  useEffect(() => {
    onCodeRef.current = onCode;
  });

  useEffect(() => {
    let stream, timer, stopped = false;
    const last = { value: "", at: 0 };
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    async function detector() {
      if ("BarcodeDetector" in window) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          if (formats.includes("qr_code")) {
            const native = new window.BarcodeDetector({ formats: ["qr_code"] });
            return async (video) => (await native.detect(video))[0]?.rawValue;
          }
        } catch {}
      }
      const { default: jsQR } = await import("jsqr");
      return (video) => {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) return null;
        const scale = Math.min(1, 640 / w);
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data;
      };
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detect = await detector();
        const tick = async () => {
          if (stopped) return;
          try {
            const value = await detect(video);
            // Kartu yang masih di depan kamera tidak dikirim berulang.
            if (value && (value !== last.value || Date.now() - last.at > 5000)) {
              last.value = value;
              last.at = Date.now();
              onCodeRef.current(value);
            }
          } catch {}
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (e) {
        setError(
          e?.name === "NotAllowedError"
            ? "Akses kamera ditolak. Izinkan kamera untuk situs ini di pengaturan peramban."
            : "Kamera tidak dapat dibuka di perangkat ini.",
        );
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="kiosk-camera">
      {error ? <p role="alert" className="alert alert-danger">{error}</p> : <video ref={videoRef} muted playsInline />}
      {!error && <span className="kiosk-camera-hint">Tunjukkan kartu QR ke kamera</span>}
    </div>
  );
}
