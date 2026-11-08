/**
 * Dedicated Modal with instructions, troubleshooting and downloadable scripts for Windows & Mac
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Apple,
  Check,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  HelpCircle,
  Laptop,
  Server,
  Sliders,
  Terminal,
  Tv,
  X,
  Zap,
  BookOpen,
  FileText,
} from 'lucide-react';
import {
  PYTHON_SCRIPT_BRIDGE,
  PYTHON_SCRIPT_HARDWARE_MONITOR,
  PYTHON_SCRIPT_HARDWARE_MONITOR_LANDSCAPE,
  PYTHON_SCRIPT_MAC,
  PYTHON_SCRIPT_WINDOWS,
} from '../services/pythonScripts';

interface OsCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OsCompanionModal: React.FC<OsCompanionModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<
    'hardware_monitor' | 'protocol_docs' | 'troubleshooting' | 'mac' | 'windows' | 'hardware'
  >('hardware_monitor');
  const [monitorOrientation, setMonitorOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  if (!isOpen) return null;

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(label);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  const handleOpenStandalone = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Connection Guide & Scripts for Windows and Mac
              </h2>
              <p className="text-xs text-slate-400">
                Permissions workaround, hardware protocol reference & standalone Python monitor scripts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 bg-slate-950/40 overflow-x-auto">
          <button
            onClick={() => setActiveTab('hardware_monitor')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'hardware_monitor'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Hardware Monitor (.py)</span>
            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-1.5 py-0.2 rounded-full font-mono">
              Download
            </span>
          </button>

          <button
            onClick={() => setActiveTab('protocol_docs')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'protocol_docs'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Technical Specs (.md)</span>
            <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800/80 px-1.5 py-0.2 rounded-full font-mono">
              Protocol
            </span>
          </button>

          <button
            onClick={() => setActiveTab('troubleshooting')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'troubleshooting'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Local Setup (Permissions Error)</span>
          </button>

          <button
            onClick={() => setActiveTab('mac')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'mac'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Apple className="w-4 h-4" />
            <span>macOS (Apple Silicon & Intel)</span>
          </button>

          <button
            onClick={() => setActiveTab('windows')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'windows'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Windows 10 & 11</span>
          </button>

          <button
            onClick={() => setActiveTab('hardware')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'hardware'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Hardware Anatomy</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300">
          {/* TAB 0: HARDWARE MONITOR (STANDALONE SCRIPT: HORIZONTAL & VERTICAL) */}
          {activeTab === 'hardware_monitor' && (
            <div className="space-y-4">
              {/* Orientation Switcher for Python Scripts */}
              <div className="flex items-center justify-between bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Python Script Orientation:</span>
                  <span className="font-semibold text-white">
                    {monitorOrientation === 'landscape' ? 'Landscape (480x320)' : 'Portrait (320x480)'}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-750 text-xs">
                  <button
                    onClick={() => setMonitorOrientation('landscape')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${
                      monitorOrientation === 'landscape'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Landscape (480x320)
                  </button>
                  <button
                    onClick={() => setMonitorOrientation('portrait')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${
                      monitorOrientation === 'portrait'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Portrait (320x480)
                  </button>
                </div>
              </div>

              {/* Main Download Card */}
              <div className="bg-gradient-to-r from-cyan-950/40 via-slate-900 to-emerald-950/40 border border-cyan-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-400/20 text-cyan-300">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">
                        {monitorOrientation === 'landscape'
                          ? 'Python Hardware Monitor - Landscape (480x320)'
                          : 'Python Hardware Monitor - Portrait (320x480)'}
                      </h3>
                      <p className="text-xs text-cyan-200/80">
                        Little-Endian RGB565 • 115200 bps • VID 0x1A86 / PID 0x5722 (CH340 / CH552)
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                    100% Verified &amp; Stable
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {monitorOrientation === 'landscape'
                    ? 'Optimized for desktop desk stand orientation (480x320). Features 3 circular arc gauges for CPU, GPU, and RAM, Disk C: bar, digital clock, and live network I/O traffic. Transmits in 960-byte scanlines with zero horizontal drift or white screen.'
                    : 'Official vertical orientation (320x480). Includes sleek bar gauges and compact arcs for CPU, GPU, RAM, SSD, and real-time network traffic. Transmits in 640-byte scanlines with frame rest cooldown.'}
                </p>

                {/* Download and Action Bar */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {monitorOrientation === 'landscape' ? (
                    <>
                      <button
                        onClick={() =>
                          downloadFile(
                            'turing_hardware_monitor_landscape.py',
                            PYTHON_SCRIPT_HARDWARE_MONITOR_LANDSCAPE
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-lg shadow transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download turing_hardware_monitor_landscape.py</span>
                      </button>

                      <button
                        onClick={() =>
                          copyToClipboard(
                            PYTHON_SCRIPT_HARDWARE_MONITOR_LANDSCAPE,
                            'script_hw_monitor_land'
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
                      >
                        {copiedScript === 'script_hw_monitor_land' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedScript === 'script_hw_monitor_land' ? 'Copied!' : 'Copy Code'}</span>
                      </button>

                      <a
                        href="/turing_hardware_monitor_landscape.py"
                        download="turing_hardware_monitor_landscape.py"
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Direct Link</span>
                      </a>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          downloadFile('turing_hardware_monitor.py', PYTHON_SCRIPT_HARDWARE_MONITOR)
                        }
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg shadow transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download turing_hardware_monitor.py</span>
                      </button>

                      <button
                        onClick={() =>
                          copyToClipboard(PYTHON_SCRIPT_HARDWARE_MONITOR, 'script_hw_monitor_vert')
                        }
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
                      >
                        {copiedScript === 'script_hw_monitor_vert' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedScript === 'script_hw_monitor_vert' ? 'Copied!' : 'Copy Code'}</span>
                      </button>

                      <a
                        href="/turing_hardware_monitor.py"
                        download="turing_hardware_monitor.py"
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Direct Link</span>
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* What does this theme include */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Metrics &amp; Built-in HUD</span>
                  </h4>
                  <ul className="text-xs text-slate-300 space-y-1.5">
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span><strong>CPU:</strong> Real-time load (%) + Package Temp (°C)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span><strong>GPU:</strong> Radial gauge (%) + VRAM / Load indicator</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span><strong>RAM:</strong> Progress bar Used / Total GB and %</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span><strong>Disk C:</strong> Primary partition used / total storage and %</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                      <span><strong>Network I/O:</strong> Download ↓ &amp; Upload ↑ in KB/s or MB/s</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>How to Run (Windows / macOS / Linux)</span>
                  </h4>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="text-slate-400">1. Install dependencies (CMD, PowerShell, or Terminal):</div>
                    <pre className="bg-black/60 p-2 rounded text-cyan-300 border border-slate-800">
                      pip install pyserial psutil pillow
                    </pre>
                    <div className="text-slate-400">2. Run script:</div>
                    <pre className="bg-black/60 p-2 rounded text-emerald-300 border border-slate-800">
                      {monitorOrientation === 'landscape'
                        ? 'python turing_hardware_monitor_landscape.py'
                        : 'python turing_hardware_monitor.py'}
                    </pre>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1">
                    Automatically scans and connects to COM port (VID 0x1A86 / PID 0x5722) with
                    auto-recovery, zero jitter, and low CPU usage.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 0.5: TECHNICAL DOCUMENTATION TAB */}
          {activeTab === 'protocol_docs' && (
            <div className="space-y-4">
              <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-amber-400" />
                      <h3 className="font-semibold text-white text-sm">
                        Technical Protocol &amp; Hardware Specification (Turing 3.5" IPS)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Low-level specs, firmware opcodes, buffer constraints, and empirical engineering findings.
                    </p>
                  </div>

                  <a
                    href="/TURING_35_HARDWARE_PROTOCOL.md"
                    download="TURING_35_HARDWARE_PROTOCOL.md"
                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg shadow transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Protocol Spec (.md)</span>
                  </a>
                </div>
              </div>

              {/* Technical Spec Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* 1. Hardware ID & Ports */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <h4 className="font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5" />
                    <span>1. Hardware &amp; USB Connectors</span>
                  </h4>
                  <ul className="space-y-1.5 text-slate-300">
                    <li><strong>USB VID / PID:</strong> <code className="text-cyan-300 font-mono">0x1A86:0x5722</code> (WCH CH340 + CH552 MCU 8051)</li>
                    <li><strong>Baud Rate:</strong> <code className="text-cyan-300 font-mono">115200 bps, 8N1</code> (No hardware flow control)</li>
                    <li><strong>Resolution:</strong> 320x480 (Portrait) / 480x320 (Landscape)</li>
                    <li><strong>Dual USB-C:</strong> <em>Bottom</em> for Portrait; <em>Side</em> for Landscape with stand. <strong>Never connect both cables simultaneously!</strong></li>
                  </ul>
                </div>

                {/* 2. Color Format & Scanlines */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <h4 className="font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>2. Color Format &amp; Scanlines</span>
                  </h4>
                  <ul className="space-y-1.5 text-slate-300">
                    <li><strong>Color Format:</strong> 16-bit <strong>RGB565 Little-Endian</strong> (LSB first, MSB second).</li>
                    <li><strong>Full Frame Buffer:</strong> 320 × 480 × 2 = <strong>307,200 bytes</strong>.</li>
                    <li><strong>1L Scanline Portrait:</strong> 320 × 2 = <strong>640 bytes</strong>.</li>
                    <li><strong>1L Scanline Landscape:</strong> 480 × 2 = <strong>960 bytes</strong>.</li>
                    <li><strong>Byte Layout:</strong> <code className="text-emerald-300 font-mono text-[11px]">raw[0]=rgb&amp;0xFF; raw[1]=(rgb&gt;&gt;8)&amp;0xFF;</code></li>
                  </ul>
                </div>

                {/* 3. Opcodes Rev A */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <h4 className="font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>3. Turing Rev A Command Opcodes</span>
                  </h4>
                  <ul className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                    <li><strong className="text-white">HELLO (69):</strong> Wake-up burst <code className="text-purple-300">[69, 69, 69, 69, 69, 69]</code>.</li>
                    <li><strong className="text-white">SCREEN_ON (109):</strong> Packet <code className="text-purple-300">[0, 0, 0, 0, 0, 109]</code> (powers on backlight).</li>
                    <li><strong className="text-white">SET_BRIGHTNESS (110):</strong> Inverted scale: <code className="text-purple-300">255 - (val * 2.55)</code>.</li>
                    <li><strong className="text-white">SET_ORIENTATION (121):</strong> 16B packet (<code className="text-purple-300">byte[6] = 100 + orient</code>).</li>
                    <li><strong className="text-white">DISPLAY_BITMAP (197):</strong> 6B coordinate header + direct RGB565 stream.</li>
                  </ul>
                </div>

                {/* 4. Critical Findings & Anti-Drift */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <h4 className="font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>4. Root Causes: Drift &amp; White Screen</span>
                  </h4>
                  <ul className="space-y-1.5 text-slate-300 text-xs">
                    <li><strong>White Screen:</strong> Occurs if <code className="text-amber-300">HELLO</code> + <code className="text-amber-300">SCREEN_ON</code> sequence is skipped, or if Win32 <code className="text-rose-300">write_timeout</code> drops the stream midway.</li>
                    <li><strong>Buffer Fix:</strong> In Python, configure <code className="text-emerald-300">write_timeout=None</code> and stream in 1-line chunks (<code className="text-emerald-300">1L</code>).</li>
                    <li><strong>Horizontal Drift:</strong> Caused by asynchronous timer fragmentation. The clean 1L scanline pipeline without artificial sleeps provides 100% stable framing.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: TROUBLESHOOTING / LOCAL SETUP */}
          {activeTab === 'troubleshooting' && (
            <div className="space-y-4">
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Why did the "disallowed by permissions policy" error occur?</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  For security reasons, modern browsers (Google Chrome and Microsoft Edge)
                  <strong> restrict Web Serial API access</strong> when a web app is rendered inside an
                  embedded <code>&lt;iframe&gt;</code> (such as the AI Studio preview frame).
                </p>
                <p className="text-xs text-amber-200/90 font-medium">
                  <strong>You have 3 easy ways to run this project:</strong>
                </p>
              </div>

              {/* 3 Solutions */}
              <div className="space-y-3">
                {/* Option 1 */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                      Option 1: Open in a New Tab (Recommended — takes 5 seconds)
                    </span>
                    <span className="text-[11px] text-slate-500">Zero installation</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Opening the direct preview URL in a standalone Chrome or Edge tab outside of the iframe
                    immediately enables <strong>Web Serial API</strong>. Clicking "Connect Screen" will pop up
                    the native USB/COM port picker dialog.
                  </p>
                  <button
                    onClick={handleOpenStandalone}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg transition-colors shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Standalone Tab</span>
                  </button>
                </div>

                {/* Option 2 */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      Option 2: Use the Local Python Bridge (localhost:8989)
                    </span>
                    <span className="text-[11px] text-slate-500">Lightweight script</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Download <code>turing_bridge.py</code> and run it in your terminal. It spins up a tiny
                    local HTTP server that receives canvas frame renders from the browser and pumps them directly
                    into your USB serial port. Works on any browser without permission restrictions.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => downloadFile('turing_bridge.py', PYTHON_SCRIPT_BRIDGE)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download turing_bridge.py</span>
                    </button>
                    <code className="text-xs bg-slate-900 px-2 py-1 rounded text-slate-300 font-mono">
                      python turing_bridge.py
                    </code>
                  </div>
                </div>

                {/* Option 3 */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Option 3: Run the Full Node.js App Locally
                    </span>
                    <span className="text-[11px] text-slate-500">For developers</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Clone or download the project repo to your Mac, Windows PC, or Linux workstation:
                  </p>
                  <pre className="bg-black/60 p-2.5 rounded font-mono text-xs text-slate-200">
                    npm install{'\n'}npm run dev
                  </pre>
                  <p className="text-xs text-slate-400">
                    Navigate to <code>http://localhost:3000</code> in Chrome or Edge and connect directly without
                    security warnings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: MAC */}
          {activeTab === 'mac' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-white mb-1">
                  1. How it works on macOS
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The original Chinese software (3.5inchENG) never supported macOS. However, the Turing 3.5"
                  features an onboard WCH CH340 / CH552 USB-to-UART chip that macOS recognizes natively
                  (macOS Monterey, Ventura, Sonoma, Sequoia) as a serial device under{' '}
                  <code className="text-cyan-400 font-mono">/dev/cu.wchusbserial*</code>.
                </p>
              </div>

              {/* Step by step */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Quick Setup Steps
                </h4>

                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
                    <span>1. Install Python packages:</span>
                    <button
                      onClick={() =>
                        copyToClipboard('pip3 install pyserial psutil pillow', 'cmd_mac_pip')
                      }
                      className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                    >
                      {copiedScript === 'cmd_mac_pip' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="text-slate-200 bg-black/40 p-2.5 rounded">
                    pip3 install pyserial psutil pillow
                  </pre>

                  <div className="flex items-center justify-between text-slate-400 pt-2 pb-1 border-b border-slate-800">
                    <span>2. Verify screen detection:</span>
                    <button
                      onClick={() => copyToClipboard('ls /dev/cu.wchusbserial*', 'cmd_mac_ls')}
                      className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                    >
                      {copiedScript === 'cmd_mac_ls' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="text-slate-200 bg-black/40 p-2.5 rounded">
                    ls /dev/cu.wchusbserial*
                  </pre>
                </div>

                {/* Download script */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-cyan-950/20 border border-cyan-800/40 rounded-xl">
                  <div>
                    <h5 className="text-sm font-semibold text-white">
                      macOS Hardware Monitor Script
                    </h5>
                    <p className="text-xs text-slate-400">
                      Reads CPU, Unified Memory, SSD storage, and network speed on Apple Silicon (M1–M4) &amp; Intel.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(PYTHON_SCRIPT_MAC, 'script_mac')}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                    >
                      {copiedScript === 'script_mac' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Code</span>
                    </button>

                    <button
                      onClick={() => downloadFile('turing_monitor_mac.py', PYTHON_SCRIPT_MAC)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .py</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WINDOWS */}
          {activeTab === 'windows' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-white mb-1">
                  1. How it works on Windows 10 &amp; 11
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The original Chinese software (3.5inchENG) frequently triggers Windows Defender false positives
                  and consumed up to 10% CPU in the background. With this clean Python script or Web Serial in Chrome/Edge,
                  the screen runs with 0.1% CPU overhead and zero bloatware.
                </p>
              </div>

              {/* Step by step */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Installation Steps on Windows
                </h4>

                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
                    <span>1. Install libraries in PowerShell or CMD:</span>
                    <button
                      onClick={() =>
                        copyToClipboard('pip install pyserial psutil pillow', 'cmd_win_pip')
                      }
                      className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                    >
                      {copiedScript === 'cmd_win_pip' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="text-slate-200 bg-black/40 p-2.5 rounded">
                    pip install pyserial psutil pillow
                  </pre>

                  <div className="text-slate-400 pt-2 text-[11px]">
                    2. In <strong className="text-slate-200">Device Manager</strong>,
                    verify that the device appears under <em>Ports (COM &amp; LPT)</em> as{' '}
                    <code className="text-cyan-400">USB-SERIAL CH340 (COM3, COM4, etc.)</code>.
                  </div>
                </div>

                {/* Download script */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-cyan-950/20 border border-cyan-800/40 rounded-xl">
                  <div>
                    <h5 className="text-sm font-semibold text-white">
                      Windows Hardware Monitor Script
                    </h5>
                    <p className="text-xs text-slate-400">
                      Auto-detects COM port and streams CPU, RAM, C: Drive, and network metrics.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(PYTHON_SCRIPT_WINDOWS, 'script_win')}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                    >
                      {copiedScript === 'script_win' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Code</span>
                    </button>

                    <button
                      onClick={() =>
                        downloadFile('turing_monitor_windows.py', PYTHON_SCRIPT_WINDOWS)
                      }
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .py</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HARDWARE ANATOMY */}
          {activeTab === 'hardware' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-cyan-400">
                    Dual USB Type-C Ports
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    The screen includes <strong>two USB-C ports</strong> (one on the side, one on the bottom):
                  </p>
                  <ul className="text-xs text-slate-400 list-disc list-inside space-y-1">
                    <li>Use the <strong>bottom port</strong> for portrait orientation.</li>
                    <li>Use the <strong>side port</strong> for landscape orientation on the desk stand.</li>
                    <li className="text-amber-400">
                      <strong>Important:</strong> Connect only one USB-C cable at a time. Never connect both ports simultaneously.
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-emerald-400">
                    It is Not an HDMI Display
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    This screen is <strong>not a standard graphic desktop display</strong>. It does not appear in
                    Windows or macOS display settings because it communicates via a 115200-baud UART serial protocol
                    with raw RGB565 frame transfers.
                  </p>
                  <p className="text-xs text-slate-400">
                    That is why this Web Studio and the Python scripts are the ideal solution to render custom themes,
                    widgets, and system statistics without driver hassles.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-xs text-slate-500">
          <span>Compatible with Turing / XuanFang 3.5" Revision A &amp; C</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors font-medium"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
