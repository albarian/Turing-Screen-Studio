/**
 * Web Serial API Controller & Live Packet Inspector for Turing 3.5"
 * Includes Multi-Baud Selector, Hardware Diagnostic Suite & Pixel Test Patterns.
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Download,
  ExternalLink,
  Laptop,
  Palette,
  Power,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sun,
  Terminal,
  Trash2,
  Usb,
  Zap,
  BookOpen,
  FileCode,
} from 'lucide-react';
import {
  PYTHON_SCRIPT_BRIDGE,
  PYTHON_SCRIPT_HARDWARE_MONITOR,
  PYTHON_SCRIPT_HARDWARE_MONITOR_LANDSCAPE,
} from '../services/pythonScripts';
import { TuringSerialDriver } from '../services/turingProtocol';
import { ScreenConfig } from '../types/screen';

interface WebSerialPanelProps {
  driver: TuringSerialDriver;
  isConnected: boolean;
  statusMessage: string;
  config: ScreenConfig;
  onChangeConfig: (updates: Partial<ScreenConfig>) => void;
  onSendCurrentFrame: () => void;
  isStreaming: boolean;
  onToggleStreaming: () => void;
  logs: string[];
  onClearLogs: () => void;
}

export const WebSerialPanel: React.FC<WebSerialPanelProps> = ({
  driver,
  isConnected,
  statusMessage,
  config,
  onChangeConfig,
  onSendCurrentFrame,
  isStreaming,
  onToggleStreaming,
  logs,
  onClearLogs,
}) => {
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'webserial' | 'bridge'>('webserial');

  const isWebSerialSupported = driver.isWebSerialSupported();
  const transport = driver.getTransport();
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  const isPolicyBlocked = driver.isIframePolicyBlocked;
  const usbInfo = driver.usbInfo;

  const handleConnectWebSerial = async (selectedBaud?: number) => {
    setIsConnecting(true);
    const targetBaud = selectedBaud || baudRate;
    try {
      await driver.connect(targetBaud);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectBridge = async () => {
    setIsConnecting(true);
    try {
      await driver.connectBridge();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await driver.disconnect();
  };

  const handleOpenStandalone = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadBridge = () => {
    const blob = new Blob([PYTHON_SCRIPT_BRIDGE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'turing_bridge.py';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadHardwareMonitor = () => {
    const blob = new Blob([PYTHON_SCRIPT_HARDWARE_MONITOR], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'turing_hardware_monitor.py';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadHardwareMonitorLandscape = () => {
    const blob = new Blob([PYTHON_SCRIPT_HARDWARE_MONITOR_LANDSCAPE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'turing_hardware_monitor_landscape.py';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectTestPattern = (pattern: ScreenConfig['testPattern']) => {
    onChangeConfig({ testPattern: pattern });
    // Trigger immediate render & send
    setTimeout(() => {
      onSendCurrentFrame();
    }, 50);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
      {/* Alert banner if in iframe or permissions policy blocked */}
      {(isPolicyBlocked || isIframe) && !isConnected && (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h4 className="font-semibold text-amber-200">
                Why does "disallowed by permissions policy" appear?
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Browsers (Chrome and Edge) restrict direct USB/Serial access inside preview <strong>iframes</strong> for security.
              </p>
              <p className="text-amber-300 font-medium pt-0.5">
                You have two effortless options to connect your screen:
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 pl-6">
            <button
              onClick={handleOpenStandalone}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Option 1: Open in New Tab (Full Web Serial Access)</span>
            </button>

            <button
              onClick={() => setActiveTab('bridge')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Laptop className="w-3.5 h-3.5 text-cyan-400" />
              <span>Option 2: Use Local Bridge (localhost:8989)</span>
            </button>
          </div>
        </div>
      )}

      {/* Standalone Python Hardware Monitor Suite (Vertical + Landscape + Protocol Docs) */}
      <div className="bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-500/40 rounded-xl p-4 shadow-md space-y-3 min-w-0 w-full">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-cyan-400/10 text-cyan-400 shrink-0 mt-0.5">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white">
                Standalone Python Suite: Native Windows &amp; macOS Monitors
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded-full font-mono font-medium">
                100% Stable • HELLO Handshake + 1L Stream
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Real-time OS telemetry (CPU %, GPU %, RAM, Disk C:, Net I/O) powered by <strong className="text-white">psutil</strong>.
              1-line scanline stream (640B in Portrait, 960B in Landscape) completely eliminates buffer overrun and lateral drift.
            </p>
          </div>
        </div>

        {/* Action Buttons: Clean full-width wrapped bar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800/80">
          {/* Vertical Script Button */}
          <button
            onClick={handleDownloadHardwareMonitor}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            title="Download Python script for Portrait mode (320x480)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Portrait (320×480)</span>
          </button>

          {/* Horizontal Script Button */}
          <button
            onClick={handleDownloadHardwareMonitorLandscape}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            title="Download Python script for Landscape mode (480x320)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Landscape (480×320)</span>
          </button>

          {/* Technical Docs Link */}
          <a
            href="/TURING_35_HARDWARE_PROTOCOL.md"
            download="TURING_35_HARDWARE_PROTOCOL.md"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
            title="Download Technical Protocol & Opcode Specification (.md)"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Protocol Docs (.md)</span>
          </a>
        </div>
      </div>

      {/* Tabs: Web Serial vs Local Bridge */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('webserial')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'webserial'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Web Serial (Browser)
          </button>
          <button
            onClick={() => setActiveTab('bridge')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'bridge'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Local Bridge (127.0.0.1:8989)
          </button>
        </div>

        {isConnected ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Connected ({transport === 'bridge' ? 'Local Bridge' : 'Web Serial'})</span>
          </span>
        ) : (
          <span className="text-xs text-slate-500">Disconnected</span>
        )}
      </div>

      {/* Connection Area */}
      {activeTab === 'webserial' ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Usb className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-200">
                Native Serial Port (Chrome / Edge)
              </span>
              {isConnected && usbInfo.chipName && (
                <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded-full font-mono">
                  {usbInfo.chipName} (VID {usbInfo.vendorId} / PID {usbInfo.productId})
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {statusMessage || 'Direct connection via COM port or /dev/cu.wchusbserial*'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isConnected ? (
              <>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-2 font-mono max-w-full sm:max-w-[210px]"
                  title="Select baud rate. Use 115200 for Turing Rev A, or 921600 for XuanFang Rev B."
                >
                  <option value={115200}>115200 bps (Turing Rev A)</option>
                  <option value={921600}>921600 bps (XuanFang Rev B)</option>
                  <option value={460800}>460800 bps</option>
                  <option value={57600}>57600 bps</option>
                  <option value={9600}>9600 bps</option>
                </select>

                <button
                  onClick={() => handleConnectWebSerial()}
                  disabled={isConnecting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-sm transition-colors whitespace-nowrap disabled:opacity-50 shrink-0"
                >
                  <Usb className="w-3.5 h-3.5" />
                  <span>{isConnecting ? 'Searching...' : 'Connect Screen'}</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onToggleStreaming}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    isStreaming
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-200'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isStreaming ? 'animate-spin' : ''}`} />
                  <span>{isStreaming ? 'Streaming Live' : 'Start Live Sync'}</span>
                </button>

                <button
                  onClick={handleDisconnect}
                  className="px-3 py-2 text-xs font-medium text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors whitespace-nowrap"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAB 2: LOCAL BRIDGE */
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Local HTTP Bridge (localhost:8989)
                </span>
                {isConnected && (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                    {usbInfo.chipName || 'COM/USB'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Run an ultra-lightweight relay script on your PC or Mac to transmit frames directly.
                Bypasses all iframe permission blocks across any web browser.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadBridge}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Download turing_bridge.py</span>
              </button>

              {!isConnected ? (
                <button
                  onClick={handleConnectBridge}
                  disabled={isConnecting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                  <span>{isConnecting ? 'Verifying...' : 'Link to 127.0.0.1:8989'}</span>
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-2 text-xs font-medium text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors whitespace-nowrap"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          <div className="bg-black/50 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 flex items-center justify-between">
            <span>Terminal / CMD run command:</span>
            <code className="text-cyan-400 bg-slate-900 px-2 py-0.5 rounded">
              python turing_bridge.py
            </code>
          </div>
        </div>
      )}

      {/* Hardware Actions Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Brightness control (Inverted hardware scale calibrated) */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Sun className="w-3.5 h-3.5 text-amber-400" /> Hardware Brightness
            </span>
            <span className="font-mono text-cyan-400 font-semibold">{config.brightness}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={config.brightness}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChangeConfig({ brightness: val });
              if (isConnected) driver.setBrightness(val);
            }}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Sync Rate with Anti-Overlap Timer */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" /> Post-Frame Interval
            </span>
            <span className="font-mono text-cyan-400 font-semibold">
              {config.fpsLimit === 0 ? 'Manual' : `${config.fpsLimit}s`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 5, 0].map((rate) => (
              <button
                key={rate}
                onClick={() => onChangeConfig({ fpsLimit: rate })}
                title={rate === 0 ? 'Update only when clicking Transmit' : `Wait ${rate} second(s) after frame completion before next write`}
                className={`flex-1 py-1 text-[11px] font-mono rounded transition-colors ${
                  config.fpsLimit === rate
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {rate === 0 ? 'Manual' : `${rate}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Instant Frame Send */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSendCurrentFrame}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-750 hover:text-white border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap"
            title="Immediately send rendered frame over USB serial"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Transmit Frame Now</span>
          </button>
        </div>

        {/* Diagnostic Commands (Multi-Protocol support) */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => driver.reset()}
            disabled={!isConnected}
            className="flex-1 px-1.5 py-3 text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-750 border border-slate-700/60 rounded-lg transition-colors disabled:opacity-40"
            title="Software Reset (White frame on Rev B, opcode 101 on Rev A)"
          >
            Reset
          </button>
          <button
            onClick={() => driver.clear()}
            disabled={!isConnected}
            className="flex-1 px-1.5 py-3 text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-750 border border-slate-700/60 rounded-lg transition-colors disabled:opacity-40"
            title="Clear display to pure white"
          >
            White
          </button>
          <button
            onClick={() => driver.toBlack()}
            disabled={!isConnected}
            className="flex-1 px-1.5 py-3 text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-750 border border-slate-700/60 rounded-lg transition-colors disabled:opacity-40"
            title="Set display to pure black"
          >
            Black
          </button>
          <button
            onClick={() => driver.pingHello()}
            disabled={!isConnected}
            className="flex-1 px-1.5 py-3 text-[10px] font-medium text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/50 rounded-lg transition-colors disabled:opacity-40"
            title="Send HELLO probe (0xCA in Rev B, 69 in Rev A)"
          >
            Hello Ping
          </button>
        </div>
      </div>

      {/* Test Pattern Generator Bar */}
      <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-slate-100">
              Test Pattern & Calibration Generator (Instant Check)
            </span>
          </div>
          <span className="text-[11px] text-amber-300 font-mono">
            {config.testPattern === 'none' ? 'Active Theme' : `Pattern: ${config.testPattern}`}
          </span>
        </div>

        <p className="text-[11px] text-slate-300">
          Click any test pattern to verify pixel clarity and RGB565 color mapping immediately:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 text-[11px]">
          {[
            { id: 'none', label: 'Active Theme', color: 'bg-slate-800 text-slate-200' },
            { id: 'color_bars', label: 'SMPTE Bars', color: 'bg-indigo-900/60 text-indigo-200 border-indigo-700' },
            { id: 'grid', label: '20px Grid', color: 'bg-amber-900/60 text-amber-200 border-amber-700' },
            { id: 'white', label: 'White', color: 'bg-slate-100 text-slate-900' },
            { id: 'black', label: 'Black', color: 'bg-black text-slate-400 border-slate-700' },
            { id: 'red', label: 'Red', color: 'bg-rose-950 text-rose-300 border-rose-800' },
            { id: 'green', label: 'Green', color: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
            { id: 'blue', label: 'Blue', color: 'bg-blue-950 text-blue-300 border-blue-800' },
          ].map((pat) => (
            <button
              key={pat.id}
              onClick={() => handleSelectTestPattern(pat.id as any)}
              className={`px-2 py-1.5 rounded-lg border font-medium text-center transition-all ${pat.color} ${
                config.testPattern === pat.id
                  ? 'ring-2 ring-cyan-400 font-bold scale-[1.02]'
                  : 'opacity-80 hover:opacity-100 border-slate-800'
              }`}
            >
              {pat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Mode Anti-Drift Transmission Strategy Selector */}
      <div className="bg-slate-950/80 border border-indigo-500/30 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-semibold text-slate-100">
              Anti-Jitter & Lateral Drift Transmission Strategy (3 Modes)
            </h4>
          </div>
          <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded">
            {config.transmissionMode === 'single_line_direct'
              ? 'MODE 2: 1L DIRECT (RECOMMENDED)'
              : config.transmissionMode === 'monolithic_block'
              ? 'MODE 3: MONOLITHIC BURST'
              : 'MODE 1: COOLDOWN 50ms'}
          </span>
        </div>

        <p className="text-[11px] text-slate-300 leading-relaxed">
          Select one of 3 strategies to test and eliminate periodic left/right phase jitter on your USB controller:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Mode 1: Monolithic Unified */}
          <button
            onClick={() => {
              onChangeConfig({
                transmissionMode: 'monolithic_block',
                linesPerChunk: 1,
                chunkPacingMs: 0,
                headerDelayMs: 0,
              });
              setTimeout(() => onSendCurrentFrame(), 30);
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              (config.transmissionMode || 'monolithic_block') === 'monolithic_block'
                ? 'bg-purple-950/60 border-purple-400 ring-1 ring-purple-400 shadow-sm'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                Unified Monolithic Burst
              </span>
              <span className="text-[10px] text-purple-300 font-mono font-semibold">
                Single Buffer
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              Header (6B) and all 307,200 bytes in <strong>ONE single continuous 307,206-byte buffer</strong>. Zero pause.
            </p>
          </button>

          {/* Mode 2: Safety Cooldown */}
          <button
            onClick={() => {
              onChangeConfig({
                transmissionMode: 'safety_cooldown',
                linesPerChunk: 1,
                chunkPacingMs: 0,
                headerDelayMs: 0,
              });
              setTimeout(() => onSendCurrentFrame(), 30);
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              config.transmissionMode === 'safety_cooldown'
                ? 'bg-indigo-950/60 border-indigo-400 ring-1 ring-indigo-400 shadow-sm'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Scanline (1L) + Cooldown
              </span>
              <span className="text-[10px] text-emerald-300 font-mono">1L + 60ms</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              Sends 1 scanline (640B) per chunk and applies 60ms strict rest guard at frame boundary.
            </p>
          </button>

          {/* Mode 3: Single Line Direct (Recommended) */}
          <button
            onClick={() => {
              onChangeConfig({
                transmissionMode: 'single_line_direct',
                linesPerChunk: 1,
                chunkPacingMs: 0,
                headerDelayMs: 0,
              });
              setTimeout(() => onSendCurrentFrame(), 30);
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              config.transmissionMode === 'single_line_direct'
                ? 'bg-indigo-950/60 border-indigo-400 ring-1 ring-indigo-400 shadow-sm'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Scanline Direct 1L (0ms)
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-semibold">
                Recommended
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              Sends 1 exact horizontal scanline per write without intermediate delay. Rock solid.
            </p>
          </button>
        </div>
      </div>

      {/* Horizontal Alignment & Offset Calibrator */}
      <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-slate-100">
              Horizontal Offset Calibration (Anti-Drift Fine Adjustment)
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Current Offset:</span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
              {(config.horizontalOffset || 0) > 0 ? `+${config.horizontalOffset}` : (config.horizontalOffset || 0)} px
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-300 leading-relaxed">
          If your screen image is slightly offset laterally, adjust the slider to calibrate physical raster phase to the exact pixel.
        </p>

        <div className="space-y-2">
          <input
            type="range"
            min="-32"
            max="32"
            step="1"
            value={config.horizontalOffset || 0}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChangeConfig({ horizontalOffset: val });
              setTimeout(() => onSendCurrentFrame(), 30);
            }}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>-32px (Left)</span>
            <span className="text-slate-400">0px (Center)</span>
            <span>+32px (Right)</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          {[-4, -1, 0, 1, 4].map((step) => {
            const isZero = step === 0;
            const targetVal = isZero ? 0 : (config.horizontalOffset || 0) + step;
            const clampedVal = Math.max(-32, Math.min(32, targetVal));
            const isActive = isZero && (config.horizontalOffset || 0) === 0;

            return (
              <button
                key={step}
                onClick={() => {
                  onChangeConfig({ horizontalOffset: clampedVal });
                  setTimeout(() => onSendCurrentFrame(), 30);
                }}
                className={`flex-1 py-1.5 text-xs font-mono rounded-lg border transition-all ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                    : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                {step === 0 ? '0px (Center)' : (step > 0 ? `+${step}px` : `${step}px`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hardware Calibration & Protocol Selector */}
      <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-semibold text-slate-100">
              Hardware Profile & Diagonal Artifact Solver
            </h4>
          </div>
          <span className="text-[11px] text-cyan-400 font-mono">
            {config.protocol === 'turing_standard'
              ? 'TURING REV A (STANDARD)'
              : config.protocol === 'xuanfang_rev_b'
              ? 'XUANFANG REV B'
              : 'DIRECT STREAM (RAW)'} · {config.endianness.toUpperCase()}
          </span>
        </div>

        {/* 1-Click Hardware Profiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Profile 1: Turing Rev A (Recommended) */}
          <button
            onClick={() => {
              onChangeConfig({
                protocol: 'turing_standard',
                endianness: 'little',
                hardwareRev: 'rev_a',
                chunkPacingMs: 0,
                linesPerChunk: 1,
                headerDelayMs: 15,
                transmissionMode: 'single_line_direct',
              });
              driver.setProtocol('turing_standard');
              setTimeout(() => onSendCurrentFrame(), 50);
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              config.protocol === 'turing_standard'
                ? 'bg-cyan-950/50 border-cyan-400 ring-1 ring-cyan-400'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Turing Rev A (Official / Turzx)
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-semibold">
                Recommended
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              Little-Endian RGB565 (accurate colors). 1L scanlines + 15ms post-header guard for CH552 MCU.
            </p>
          </button>

          {/* Profile 2: Raw Direct Stream */}
          <button
            onClick={() => {
              onChangeConfig({
                protocol: 'raw_stream',
                endianness: 'little',
                hardwareRev: 'rev_a',
                chunkPacingMs: 0,
                linesPerChunk: 4,
              });
              driver.setProtocol('raw_stream');
              setTimeout(() => onSendCurrentFrame(), 50);
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              config.protocol === 'raw_stream'
                ? 'bg-cyan-950/50 border-cyan-400 ring-1 ring-cyan-400'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                Direct Stream (Raw)
              </span>
              <span className="text-[10px] text-purple-300 font-mono">Pure Stream</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Stream 307,200 raw bytes without intermediate packet headers. Ideal for raster validation.
            </p>
          </button>

          {/* Profile 3: XuanFang Rev B */}
          <button
            onClick={() => {
              onChangeConfig({
                protocol: 'xuanfang_rev_b',
                endianness: 'big',
                hardwareRev: 'rev_b',
                chunkPacingMs: 2,
                linesPerChunk: 4,
              });
              driver.setProtocol('xuanfang_rev_b');
              setTimeout(() => onSendCurrentFrame(), 50);
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              config.protocol === 'xuanfang_rev_b'
                ? 'bg-cyan-950/50 border-cyan-400 ring-1 ring-cyan-400'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                XuanFang Rev B
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Big-End</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              10-byte framed packets (0xCA-0xCE) for secondary screens running XuanFang clone firmware.
            </p>
          </button>
        </div>

        {/* Detailed Fine-Tuning Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs pt-1">
          {/* Protocol Variant */}
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="text-slate-400 text-[11px]">Active Protocol:</div>
            <select
              value={config.protocol}
              onChange={(e) => {
                const proto = e.target.value as any;
                onChangeConfig({
                  protocol: proto,
                  endianness: proto === 'xuanfang_rev_b' ? 'big' : 'little',
                });
                driver.setProtocol(proto);
                onSendCurrentFrame();
              }}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-[11px] rounded px-2 py-1 font-sans"
            >
              <option value="turing_standard">Turing Rev A (Official)</option>
              <option value="xuanfang_rev_b">XuanFang Rev B (AliExpress)</option>
              <option value="raw_stream">Direct Stream (Raw)</option>
            </select>
          </div>

          {/* Endianness */}
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Byte Order:</span>
              <span className="text-cyan-400 font-mono font-semibold">{config.endianness}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  onChangeConfig({ endianness: 'little' });
                  onSendCurrentFrame();
                }}
                className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors ${
                  config.endianness === 'little'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Little-End
              </button>
              <button
                onClick={() => {
                  onChangeConfig({ endianness: 'big' });
                  onSendCurrentFrame();
                }}
                className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors ${
                  config.endianness === 'big'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Big-End
              </button>
            </div>
          </div>

          {/* Header Guard Delay (CH552 Anti-Rebote) */}
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Post-Header Guard:</span>
              <span className="text-emerald-400 font-mono font-semibold">{config.headerDelayMs ?? 15}ms</span>
            </div>
            <div className="flex gap-1">
              {[0, 5, 15, 30].map((ms) => (
                <button
                  key={ms}
                  onClick={() => onChangeConfig({ headerDelayMs: ms })}
                  title={`Wait ${ms}ms after DISPLAY_BITMAP for CH552 MCU RAMWR initialization`}
                  className={`flex-1 py-1 text-[11px] font-mono rounded transition-colors ${
                    (config.headerDelayMs ?? 15) === ms
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {ms}ms
                </button>
              ))}
            </div>
          </div>

          {/* Pacing UART */}
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>UART Pacing (Delay):</span>
              <span className="text-cyan-400 font-mono font-semibold">{config.chunkPacingMs}ms</span>
            </div>
            <div className="flex gap-1">
              {[0, 2, 4, 8].map((ms) => (
                <button
                  key={ms}
                  onClick={() => onChangeConfig({ chunkPacingMs: ms })}
                  className={`flex-1 py-1 text-[11px] font-mono rounded transition-colors ${
                    config.chunkPacingMs === ms
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {ms}ms
                </button>
              ))}
            </div>
          </div>

          {/* Lines per chunk */}
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Lines per Chunk:</span>
              <span className="text-cyan-400 font-mono font-semibold">{config.linesPerChunk}L</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 4, 8].map((lines) => (
                <button
                  key={lines}
                  onClick={() => onChangeConfig({ linesPerChunk: lines })}
                  className={`flex-1 py-1 text-[11px] font-mono rounded transition-colors ${
                    config.linesPerChunk === lines
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {lines}L
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Logs Collapsible */}
      <div className="border border-slate-800/80 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs bg-slate-950 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className="flex items-center gap-2 font-mono">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            Serial Console & Activity Log ({logs.length} events)
          </span>
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onClearLogs();
                }}
                className="p-1 hover:text-rose-400 transition-colors"
                title="Clear logs"
              >
                <Trash2 className="w-3 h-3" />
              </span>
            )}
            {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        {showLogs && (
          <div className="p-3 bg-black/80 font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <p className="text-slate-600">No serial activity recorded yet.</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="leading-tight">
                  <span className="text-cyan-400/80">›</span> {log}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
