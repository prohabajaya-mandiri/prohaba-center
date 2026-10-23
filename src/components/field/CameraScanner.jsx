"use client";
import { useEffect, useRef, useState } from "react";

/** Kamera belakang yang terus membaca QR; BarcodeDetector bila ada, jsQR sebagai cadangan. */
export default function CameraScanner({ onCode }) {
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
            // Kartu yang masih di depan kamera tidak dibaca berulang.
            if (value && (value !== last.value || Date.now() - last.at > 5000)) {
              last.value = value;
              last.at = Date.now();
              onCodeRef.current(value);
            }
          } catch {}
          timer = setTimeout(tick, 200);
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

  if (error) return <p role="alert" className="alert alert-danger absen-camera-error">{error}</p>;
  return (
    <div className="absen-camera">
      <video ref={videoRef} muted playsInline />
      <span className="absen-camera-frame" aria-hidden />
    </div>
  );
}
