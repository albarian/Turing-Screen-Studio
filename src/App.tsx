/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Apple,
  Download,
  HelpCircle,
  Laptop,
  Maximize2,
  RefreshCw,
  Sliders,
  Tv,
  Usb,
} from 'lucide-react';
import { OsCompanionModal } from './components/OsCompanionModal';
import { ScreenBezel } from './components/ScreenBezel';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import { ThemeSelector } from './components/ThemeSelector';
import { ToastContainer } from './components/ToastContainer';
import { WebSerialPanel } from './components/WebSerialPanel';
import { ScreenRenderer } from './services/screenRenderer';
import { SystemStatsManager } from './services/systemStats';
import { TuringSerialDriver } from './services/turingProtocol';
import {
  isPortraitOrientation,
  OrientationMode,
  ScreenConfig,
  ScreenMode,
  toggleOrientationDirection,
  toggleOrientationShape,
} from './types/screen';
import { ToastMessage, ToastType } from './types/toast';

export default function App() {
  // Screen state & configuration
  const [config, setConfig] = useState<ScreenConfig>(() => {
    let savedOffset = 0;
    try {
      const stored = localStorage.getItem('turing_h_offset');
      if (stored !== null) savedOffset = parseInt(stored, 10) || 0;
    } catch (_) {}

    return {
      mode: 'hardware_hud',
      orientation: 'portrait',
      brightness: 80,
      fpsLimit: 1, // 1 frame per second sync over serial
      accentColor: '#06b6d4',
      showScanlines: false,
      invertColors: false,
      dithering: false,
      endianness: 'little', // Turing Rev A Little-Endian (colors verified by user)
      colorOrder: 'rgb',
      chunkPacingMs: 0,
      linesPerChunk: 1,
      hardwareRev: 'rev_a',
      protocol: 'turing_standard', // Default to Turing Rev A
      testPattern: 'none',
      horizontalOffset: savedOffset,
      transmissionMode: 'single_line_direct',
      headerDelayMs: 0,
    };
  });

  const [customImage, setCustomImage] = useState<HTMLImageElement | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [isSerialStreaming, setIsSerialStreaming] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = type === 'frame' ? 'toast-frame-sync' : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();

    setToasts((prev) => {
      if (type === 'frame') {
        const existingIdx = prev.findIndex((t) => t.id === 'toast-frame-sync');
        if (existingIdx !== -1) {
          const updated = [...prev];
          const curr = updated[existingIdx];
          updated[existingIdx] = {
            ...curr,
            title,
            description,
            timestamp: now,
            count: (curr.count || 1) + 1,
          };
          return updated;
        }
      }
      return [...prev.slice(-3), { id, type, title, description, timestamp: now, count: 1 }];
    });

    const timeoutMs = type === 'frame' ? 2400 : 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, timeoutMs);
  }, []);

  const handleDismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Web Serial state
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [serialStatus, setSerialStatus] = useState<string>(
    'Ready to connect via USB-C cable to your PC or Mac.'
  );
  const [logs, setLogs] = useState<string[]>([]);

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statsManagerRef = useRef<SystemStatsManager | null>(null);
  const serialDriverRef = useRef<TuringSerialDriver | null>(null);
  const lastSendTimeRef = useRef<number>(0);
  const lastFrameFinishedRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());
  const configRef = useRef(config);
  const previousOrientationRef = useRef(config.orientation);
  configRef.current = config;

  // Initialize driver and stats manager once
  if (!statsManagerRef.current) {
    statsManagerRef.current = new SystemStatsManager();
  }

  if (!serialDriverRef.current) {
    serialDriverRef.current = new TuringSerialDriver(
      (connected, msg) => {
        setIsConnected((prevWas) => {
          if (connected && !prevWas) {
            addToast('success', 'Device Connected', msg);
          } else if (!connected && prevWas) {
            addToast('info', 'Device Disconnected', msg);
          } else if (
            !connected &&
            msg &&
            (msg.toLowerCase().includes('error') ||
              msg.toLowerCase().includes('bloqueado') ||
              msg.toLowerCase().includes('disallowed') ||
              msg.toLowerCase().includes('failed') ||
              msg.toLowerCase().includes('fallo'))
          ) {
            addToast('error', 'Serial Port Error', msg);
          }
          return connected;
        });
        setSerialStatus(msg);
        if (!connected) setIsSerialStreaming(false);
      },
      (log) => {
        setLogs((prev) => [log, ...prev.slice(0, 50)]);
      }
    );
  }

  const statsManager = statsManagerRef.current;
  const serialDriver = serialDriverRef.current;

  // Real-time loop for canvas rendering and serial streaming
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      // 1. Advance telemetry
      statsManager.tick('normal');

      // 2. Render to 320x480 / 480x320 canvas
      if (canvasRef.current) {
        ScreenRenderer.render(
          canvasRef.current,
          config,
          statsManager.getMetrics(),
          statsManager.getWeather(),
          statsManager.getMedia(),
          statsManager.getCrypto(),
          statsManager.getPomodoro(),
          statsManager.getStatusSign(),
          customImage
        );

        // 3. Serial streaming if active (Strict anti-overlap protection)
        // Interval is measured AFTER previous frame completion to prevent serial buffer pile-up
        const now = performance.now();
        const intervalSeconds = config.fpsLimit > 0 ? config.fpsLimit : 1;
        const sendIntervalMs = intervalSeconds * 1000;

        if (
          isSerialStreaming &&
          isConnected &&
          !serialDriver.getIsSending() &&
          now - lastFrameFinishedRef.current >= sendIntervalMs
        ) {
          lastSendTimeRef.current = now;
          serialDriver.sendCanvasFrame(canvasRef.current, config).then((ok) => {
            lastFrameFinishedRef.current = performance.now();
            if (!ok) {
              addToast('error', 'Frame Transmission Failed', 'Serial port could not complete frame write');
            }
          });
        }

        // FPS calculation
        frameCountRef.current++;
        if (now - lastFpsTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [config, customImage, isSerialStreaming, isConnected]);

  useEffect(() => {
    const changed = previousOrientationRef.current !== config.orientation;
    previousOrientationRef.current = config.orientation;
    if (!changed || !isConnected) return;

    let animId: number;
    let cancelled = false;
    const sendUpdatedFrame = () => {
      if (serialDriver.getIsSending() || !canvasRef.current) {
        animId = requestAnimationFrame(sendUpdatedFrame);
        return;
      }

      serialDriver.sendCanvasFrame(canvasRef.current, configRef.current).then((ok) => {
        lastFrameFinishedRef.current = performance.now();
        if (!ok && !cancelled) {
          addToast('error', 'Orientation Update Failed', 'Serial port could not transmit the updated frame');
        }
      });
    };

    animId = requestAnimationFrame(sendUpdatedFrame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
    };
  }, [config.orientation, isConnected, serialDriver, addToast]);

  // Config updater with offset persistence
  const handleUpdateConfig = (updates: Partial<ScreenConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      if (updates.horizontalOffset !== undefined) {
        try {
          localStorage.setItem('turing_h_offset', String(updates.horizontalOffset));
        } catch (_) {}
      }
      return next;
    });
  };

  const updateOrientation = (next: OrientationMode) => {
    handleUpdateConfig({ orientation: next });
  };

  const toggleOrientation = () => {
    updateOrientation(toggleOrientationShape(config.orientation));
  };

  const rotateOrientation = () => {
    updateOrientation(toggleOrientationDirection(config.orientation));
  };

  // Immediate single-frame send
  const handleSendCurrentFrame = async () => {
    if (!canvasRef.current) return;
    if (!isConnected) {
      addToast('info', 'Connecting...', 'Select your USB COM port to transmit frame');
      const ok = await serialDriver.connect();
      if (!ok) return;
    }
    const success = await serialDriver.sendCanvasFrame(canvasRef.current, config);
    if (success) {
      addToast(
        'frame',
        'Frame Transmitted Successfully',
        `Rendered frame (${isPortraitOrientation(config.orientation) ? '320×480' : '480×320'})`
      );
    } else {
      addToast('error', 'Transmission Failed', 'Serial port could not complete the frame send');
    }
  };

  // Microphone toggle for music visualizer
  const handleToggleMic = async () => {
    if (statsManager.isMicListening) {
      statsManager.disableMicAudio();
      // force re-render
      setConfig((c) => ({ ...c }));
    } else {
      await statsManager.enableMicAudio();
      setConfig((c) => ({ ...c }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* TOP BAR CONTRACT: Zone 1 (Wordmark) — Zone 2 (Nav Links) — Zone 3 (Action) */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-cyan-500/20">
            <Tv className="w-4 h-4 text-slate-950" />
          </div>
          <span className="text-base font-bold font-display tracking-tight text-white whitespace-nowrap">
            Turing Screen Studio
          </span>
        </div>

        {/* Zone 2: Navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <a
            href="#simulator"
            className="hover:text-cyan-400 transition-colors whitespace-nowrap"
          >
            3.5" Simulator
          </a>
          <button
            onClick={() => setIsGuideOpen(true)}
            className="hover:text-cyan-400 transition-colors whitespace-nowrap text-left"
          >
            Python &amp; Protocol Guide
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors shadow-sm whitespace-nowrap"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Guides &amp; Protocol Docs</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6 max-w-[2400px]">
        {/* Context Banner */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider font-mono">
                Universal Solution • No Bloatware Required
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Windows 10/11 &amp; macOS Compatible</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Control &amp; customize your 3.5" IPS USB screen directly from your browser or Python
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              No proprietary factory software needed. Connect via USB-C and stream live hardware telemetry,
              desk clocks, Spotify visualizers, crypto tickers, or custom photos using{' '}
              <strong className="text-cyan-400">native Web Serial</strong> or our background Python scripts.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
            >
              <Apple className="w-3.5 h-3.5 text-slate-400" />
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              <span>Download .py Scripts</span>
            </button>
          </div>
        </section>

        {/* 2-Column Core Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start w-full">
          {/* Left Column: Realistic Physical Bezel Simulator & Canvas */}
          <div id="simulator" className="lg:col-span-5 xl:col-span-5 2xl:col-span-5 space-y-6 flex flex-col items-center min-w-0 w-full">
            <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col items-center min-w-0">
              <ScreenBezel
                canvasRef={canvasRef}
                config={config}
                onToggleOrientation={toggleOrientation}
                onRotateOrientation={rotateOrientation}
                isSerialStreaming={isSerialStreaming}
                fps={fps}
              />
            </div>

            {/* Customizer directly beneath the simulated screen */}
            <div className="w-full min-w-0">
              <ThemeCustomizer
                config={config}
                onChangeConfig={handleUpdateConfig}
                metrics={statsManager.getMetrics()}
                onUpdateMetrics={(u) => statsManager.setMetrics(u)}
                weather={statsManager.getWeather()}
                onUpdateWeather={(u) => statsManager.setWeather(u)}
                media={statsManager.getMedia()}
                onUpdateMedia={(u) => statsManager.setMedia(u)}
                crypto={statsManager.getCrypto()}
                pomodoro={statsManager.getPomodoro()}
                onUpdatePomodoro={(u) => statsManager.setPomodoro(u)}
                statusSign={statsManager.getStatusSign()}
                onUpdateStatusSign={(u) => statsManager.setStatusSign(u)}
                onUploadImage={(img) => {
                  setCustomImage(img);
                  setConfig((prev) => ({ ...prev, mode: 'custom_image' }));
                }}
                isMicActive={statsManager.isMicListening}
                onToggleMic={handleToggleMic}
              />
            </div>
          </div>

          {/* Right Column: Web Serial API Hub & Theme Selector */}
          <div className="lg:col-span-7 xl:col-span-7 2xl:col-span-7 space-y-6 min-w-0 w-full">
            {/* 1. Web Serial Direct Connection Controller */}
            <div id="webserial" className="w-full min-w-0">
              <WebSerialPanel
                driver={serialDriver}
                isConnected={isConnected}
                statusMessage={serialStatus}
                config={config}
                onChangeConfig={handleUpdateConfig}
                onSendCurrentFrame={handleSendCurrentFrame}
                isStreaming={isSerialStreaming}
                onToggleStreaming={() => setIsSerialStreaming(!isSerialStreaming)}
                logs={logs}
                onClearLogs={() => setLogs([])}
              />
            </div>

            {/* 2. Themes Gallery */}
            <div id="themes" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg min-w-0 w-full">
              <ThemeSelector
                currentMode={config.mode}
                onSelectMode={(mode) => setConfig((prev) => ({ ...prev, mode }))}
              />
            </div>

            {/* 3. Windows & Mac Quick Download Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  Want the screen running 24/7 in the background?
                </h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Run our ultra-lightweight Python background service on Windows or macOS. It starts automatically
                with your system, consumes &lt;0.1% CPU, and streams real-time CPU, GPU, RAM, disk, and network stats.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => setIsGuideOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-cyan-400 border border-slate-700 rounded-lg transition-colors"
                >
                  <Apple className="w-3.5 h-3.5" />
                  <span>Setup on macOS</span>
                </button>

                <button
                  onClick={() => setIsGuideOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-cyan-400 border border-slate-700 rounded-lg transition-colors"
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Setup on Windows</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 px-6 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Turing Smart Screen Studio</span>
            <span aria-hidden="true">·</span>
            <span>Open Source Web Serial Driver & Protocol Suite for 3.5" USB Screens</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Native Resolution: 320×480 IPS</span>
            <span aria-hidden="true">·</span>
            <span>UART 115200 8N1</span>
            <span aria-hidden="true">·</span>
            <span>Windows, macOS & Linux</span>
          </div>
        </div>
      </footer>

      {/* OS Companion Modal */}
      <OsCompanionModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* Floating Animated Toast Notifications (framer-motion) */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
