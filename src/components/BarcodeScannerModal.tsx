import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Check, Keyboard, QrCode, X } from 'lucide-react';
import { normalizeSerial } from '../db/constants';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  title?: string;
  multiScan?: boolean;
  existingSerials?: string[];
  onScan: (serialNumber: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  title = 'Scan Barcode or QR Code',
  multiScan = false,
  existingSerials = [],
  onScan,
  onClose,
}) => {
  const [statusMessage, setStatusMessage] = useState<string>('Initializing camera...');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [scannedInSession, setScannedInSession] = useState<string[]>([]);
  const scannerContainerId = 'solar-life-qr-reader';
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ value: string; time: number }>({ value: '', time: 0 });

  useEffect(() => {
    if (!isOpen) {
      setScannedInSession([]);
      setCameraError(null);
      setManualInput('');
      return;
    }

    let cancelled = false;

    const handleDetected = (rawText: string) => {
      const normalized = normalizeSerial(rawText);
      if (!normalized) return;

      const now = Date.now();
      // Debounce identical consecutive scans within 1.8s
      if (lastScannedRef.current.value === normalized && now - lastScannedRef.current.time < 1800) {
        return;
      }
      lastScannedRef.current = { value: normalized, time: now };

      setScannedInSession((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
      onScan(normalized);

      if (!multiScan) {
        onClose();
      }
    };

    const startNativeScanner = async () => {
      try {
        setStatusMessage('Checking camera permissions...');
        const perm = await BarcodeScanner.requestPermissions();
        if (perm.camera !== 'granted' && perm.camera !== 'limited') {
          setCameraError('Camera permission denied. Enter the serial number manually below or grant permission in Android Settings.');
          return;
        }

        const modAvail = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!modAvail.available) {
          setStatusMessage('Preparing Google ML Kit Barcode module...');
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }

        setStatusMessage('Opening native barcode scanner...');
        const result = await BarcodeScanner.scan();
        if (cancelled) return;
        if (result.barcodes && result.barcodes.length > 0) {
          for (const code of result.barcodes) {
            if (code.rawValue) {
              handleDetected(code.rawValue);
            }
          }
          if (!multiScan) return;
        }
        setStatusMessage('Scan complete. Tap "Scan Another" or enter manually.');
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err instanceof Error
              ? err.message
              : 'Unable to launch native camera scanner. You can enter serial numbers manually below.'
          );
        }
      }
    };

    const startWebScanner = async () => {
      try {
        setStatusMessage('Starting camera preview...');
        // Wait a tick for DOM element mount
        await new Promise((r) => setTimeout(r, 150));
        if (cancelled) return;
        const container = document.getElementById(scannerContainerId);
        if (!container) return;

        const scanner = new Html5Qrcode(scannerContainerId);
        html5QrRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 140 } },
          (decodedText) => {
            if (!cancelled) handleDetected(decodedText);
          },
          () => {
            // Ignore frame decode misses
          }
        );
        if (!cancelled) setStatusMessage('Point camera at panel or inverter barcode/QR label');
      } catch {
        if (!cancelled) {
          setCameraError(
            'Camera preview unavailable in this browser/iframe. Connect a device camera or enter/paste the serial number below.'
          );
        }
      }
    };

    if (Capacitor.isNativePlatform()) {
      startNativeScanner();
    } else {
      startWebScanner();
    }

    return () => {
      cancelled = true;
      if (html5QrRef.current) {
        const ref = html5QrRef.current;
        html5QrRef.current = null;
        if (ref.isScanning) {
          ref.stop().then(() => ref.clear()).catch(() => undefined);
        } else {
          try {
            ref.clear();
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    };
  }, [isOpen, multiScan, onClose, onScan]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeSerial(manualInput);
    if (!cleaned) return;
    setScannedInSession((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
    onScan(cleaned);
    setManualInput('');
    if (!multiScan) {
      onClose();
    }
  };

  const triggerNativeRescan = async () => {
    try {
      setCameraError(null);
      const result = await BarcodeScanner.scan();
      if (result.barcodes && result.barcodes.length > 0) {
        for (const code of result.barcodes) {
          if (code.rawValue) {
            const normalized = normalizeSerial(code.rawValue);
            setScannedInSession((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
            onScan(normalized);
          }
        }
      }
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Scan cancelled.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-blue-900 text-white">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-amber-300" />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-blue-800 transition-colors"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!Capacitor.isNativePlatform() && !cameraError && (
            <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-200">
              <div id={scannerContainerId} className="w-full min-h-[220px]" />
            </div>
          )}

          {Capacitor.isNativePlatform() && !cameraError && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-center space-y-3">
              <Camera className="w-8 h-8 text-blue-700 mx-auto" />
              <p className="text-sm font-medium text-slate-800">{statusMessage}</p>
              {multiScan && (
                <button
                  type="button"
                  onClick={triggerNativeRescan}
                  className="min-h-[44px] px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800"
                >
                  Scan Another Barcode
                </button>
              )}
            </div>
          )}

          {cameraError ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              {cameraError}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center">{statusMessage}</p>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Keyboard className="w-4 h-4 text-blue-700" />
              Manual / Handheld Scanner Entry
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Type or scan serial number..."
                className="flex-1 min-h-[44px] px-3.5 py-2 text-sm font-mono uppercase bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                autoFocus
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                {multiScan ? 'Add' : 'Use'}
              </button>
            </div>
          </form>

          {multiScan && (scannedInSession.length > 0 || existingSerials.length > 0) && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-2">
                <span>Session Scanned ({scannedInSession.length})</span>
                <span className="font-mono tabular-nums">Total: {existingSerials.length}</span>
              </div>
              {scannedInSession.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {scannedInSession.map((sn) => (
                    <span
                      key={sn}
                      className="inline-flex items-center gap-1 text-xs font-mono bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-800"
                    >
                      <Check className="w-3 h-3 text-emerald-600" />
                      {sn}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-amber-400 text-slate-950 font-semibold text-sm rounded-xl hover:bg-amber-300 transition-colors"
            >
              {multiScan ? 'Done Scanning' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
