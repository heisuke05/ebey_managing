"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

export default function BarcodeScanner({
  onDetect,
  onClose,
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const doneRef = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;
    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined, // 背面カメラを自動選択
          videoRef.current!,
          (result) => {
            if (result && !doneRef.current) {
              doneRef.current = true;
              controlsRef.current?.stop();
              onDetect(result.getText());
            }
          }
        );
        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      } catch (e) {
        setError(
          `カメラを起動できませんでした。カメラの使用を許可してください。(${String(e)})`
        );
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDetect]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4">
      <div className="flex items-center justify-between text-white">
        <p className="font-bold">バーコードを枠内に写してください</p>
        <button
          onClick={onClose}
          className="rounded-lg bg-white/20 px-4 py-2 font-bold"
        >
          閉じる
        </button>
      </div>
      <div className="mt-4 flex-1 overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full object-cover" />
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
