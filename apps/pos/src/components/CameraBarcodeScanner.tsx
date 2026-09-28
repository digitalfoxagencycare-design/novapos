import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

export const CameraBarcodeScanner: React.FC<Props> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Product Barcode / QR',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCameraError, setHasCameraError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [manualCode, setManualCode] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const generation = useRef(0);
  const callbacks = useRef({ onScan, onClose });
  callbacks.current = { onScan, onClose };
  const [attempt, setAttempt] = useState(0);

  const stopCamera = () => {
    generation.current++;
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleBarcodeFound = (value: string) => {
    const code = value.trim();
    if (!code) return;
    stopCamera();
    try { navigator.vibrate?.(100); } catch { /* optional feedback */ }
    callbacks.current.onScan(code);
    callbacks.current.onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const session = ++generation.current;
    const active = () => generation.current === session;
    setHasCameraError(false);
    setErrorMessage('');
    setManualCode('');
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera is unavailable. Use manual entry.');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
        });
        if (!active()) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) { stopCamera(); return; }
        video.srcObject = stream;
        await video.play();
        if (!active()) return;

        let native: { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> } | null = null;
        const Detector = (window as any).BarcodeDetector;
        if (Detector) {
          try {
            const formats = typeof Detector.getSupportedFormats === 'function' ? await Detector.getSupportedFormats() : undefined;
            if (!active()) return;
            native = formats?.length === 0 ? null : new Detector(formats ? { formats } : undefined);
          } catch { /* fall back to the bundled decoder */ }
        }
        let reader: import('@zxing/browser').BrowserMultiFormatReader | undefined;
        const canvas = document.createElement('canvas');
        const fallback = async () => {
          reader ??= new (await import('@zxing/browser')).BrowserMultiFormatReader();
          if (!active()) return undefined;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Camera image decoding is unavailable. Use manual entry.');
          ctx.drawImage(video, 0, 0);
          try { return reader.decodeFromCanvas(canvas).getText(); }
          catch (error) {
            // No readable symbol in this frame is expected while aiming.
            if (['NotFoundException', 'ChecksumException', 'FormatException'].includes((error as Error).name)) return undefined;
            throw error;
          }
        };
        let lastFrame = 0;
        const detect = async (time: number) => {
          if (!active()) return;
          if (video.readyState >= 2 && video.videoWidth > 0 && time - lastFrame >= 150) {
            lastFrame = time;
            try {
              let code: string | undefined;
              if (native) {
                try { code = (await native.detect(video))[0]?.rawValue; }
                catch { native = null; }
              }
              if (!native) code = await fallback();
              if (!active()) return;
              if (code?.trim()) { handleBarcodeFound(code); return; }
            } catch (error) {
              if (!active()) return;
              stopCamera();
              setHasCameraError(true);
              setErrorMessage((error as Error).message || 'Unable to scan. Use manual entry.');
              return;
            }
          }
          if (active()) animationFrameRef.current = requestAnimationFrame(detect);
        };
        animationFrameRef.current = requestAnimationFrame(detect);
      } catch (error) {
        if (!active()) return;
        stopCamera();
        setHasCameraError(true);
        setErrorMessage((error as Error).message || 'Camera permission denied. Use manual entry.');
      }
    };
    void start();
    return stopCamera;
  }, [isOpen, attempt]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeFound(manualCode.trim());
  };

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 text-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-3.5 bg-slate-800/90 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-sm text-white">{title}</h3>
          </div>
          <button
            aria-label="Close scanner" onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Scanner Area */}
        <div className="relative bg-black h-64 flex items-center justify-center overflow-hidden">
          <video ref={videoRef} playsInline muted className={hasCameraError ? 'hidden' : 'w-full h-full object-cover'} />
          {!hasCameraError ? (
            <>
              {/* Target Aim Box */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-32 border-2 border-purple-400 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-purple-300" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-purple-300" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-purple-300" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-purple-300" />
                  {/* Scanning beam line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2 shadow-[0_0_8px_#a855f7]" />
                </div>
              </div>
              <p className="absolute bottom-3 text-xs font-semibold text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                Point camera at item barcode / QR code
              </p>
            </>
          ) : (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300">{errorMessage}</p>
              <button
                onClick={() => setAttempt(value => value + 1)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Manual Barcode Input Fallback */}
        <form onSubmit={handleManualSubmit} className="p-4 bg-slate-800 space-y-3">
          <label className="text-xs font-semibold text-slate-300 block">
            Or enter Barcode manually:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 8901030000001"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-purple-500 outline-none"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
            >
              Use Code
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
