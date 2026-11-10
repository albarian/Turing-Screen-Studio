/**
 * Realistic physical hardware bezel mockup for 3.5" IPS USB Type-C screen
 * Mimics the exact device enclosure shown in the product image.
 */

import React, { useRef } from 'react';
import { Camera, Download, RotateCcw, RotateCw, Sparkles, Tv, ZoomIn, ZoomOut } from 'lucide-react';
import {
  isPortraitOrientation,
  isReversedOrientation,
  ScreenConfig,
} from '../types/screen';

interface ScreenBezelProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  config: ScreenConfig;
  onToggleOrientation: () => void;
  onRotateOrientation: () => void;
  isSerialStreaming: boolean;
  fps: number;
}

export const ScreenBezel: React.FC<ScreenBezelProps> = ({
  canvasRef,
  config,
  onToggleOrientation,
  onRotateOrientation,
  isSerialStreaming,
  fps,
}) => {
  const [scale, setScale] = React.useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPortrait = isPortraitOrientation(config.orientation);
  const isReversed = isReversedOrientation(config.orientation);
  const displayWidth = isPortrait ? 320 : 480;
  const displayHeight = isPortrait ? 480 : 320;
  const orientationLabel = isPortrait ? 'Portrait' : 'Landscape';

  const handleDownloadSnapshot = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `turing_screen_${config.mode}_${config.orientation}.png`;
    if (isReversed) {
      const snapshot = document.createElement('canvas');
      snapshot.width = displayWidth;
      snapshot.height = displayHeight;
      const ctx = snapshot.getContext('2d');
      if (!ctx) {
        console.error('Unable to create a canvas for the rotated screenshot');
        return;
      }
      ctx.translate(displayWidth, displayHeight);
      ctx.rotate(Math.PI);
      ctx.drawImage(canvasRef.current, 0, 0);
      link.href = snapshot.toDataURL('image/png');
    } else {
      link.href = canvasRef.current.toDataURL('image/png');
    }
    link.click();
  };

  return (
    <div className="flex flex-col items-center">
      {/* Quick Toolbar */}
      <div className="flex items-center gap-2 mb-4 bg-slate-900 border border-slate-800 rounded-lg p-1.5 shadow-md">
        <button
          onClick={onToggleOrientation}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-md transition-colors whitespace-nowrap"
          title="Toggle between Portrait (320x480) and Landscape (480x320)"
          aria-label="Switch between portrait and landscape"
        >
          <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>{orientationLabel} ({displayWidth}x{displayHeight})</span>
        </button>

        <button
          onClick={onRotateOrientation}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-md transition-colors whitespace-nowrap"
          title="Rotate the display 180°"
          aria-label="Rotate display 180 degrees"
        >
          <RotateCcw className="w-3.5 h-3.5 text-violet-400" />
          <span>{isReversed ? 'Reset rotation' : 'Rotate 180°'}</span>
        </button>

        <div className="h-4 w-px bg-slate-800" />

        <button
          onClick={() => setScale((s) => Math.max(0.7, s - 0.1))}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-mono text-slate-400 px-1">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((s) => Math.min(1.3, s + 0.1))}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-800" />

        <button
          onClick={handleDownloadSnapshot}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          title="Capture current frame as PNG"
        >
          <Camera className="w-3.5 h-3.5 text-emerald-400" />
          <span>Screenshot</span>
        </button>
      </div>

      {/* Hardware Enclosure with Kickstand */}
      <div
        ref={containerRef}
        style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
        className="relative transition-transform duration-150 ease-out"
      >
        {/* Physical Kickstand shadow & base */}
        <div
          className={`absolute ${
            isPortrait
              ? '-bottom-4 -right-3 w-16 h-28'
              : '-bottom-4 right-10 w-24 h-16'
          } bg-gradient-to-br from-slate-900 to-black rounded-lg border-b-2 border-r-2 border-slate-700/50 shadow-2xl pointer-events-none transform skew-x-6 opacity-80`}
        />

        {/* Screen Outer Aluminum/ABS Case */}
        <div
          className={`relative bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-900 p-4 rounded-2xl shadow-2xl border border-neutral-700/40 ring-1 ring-white/10 ${
            isPortrait ? 'w-[364px]' : 'w-[524px]'
          }`}
        >
          {/* Top bezel camera/light sensor dot */}
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
              <span className="text-[10px] tracking-wider font-semibold text-neutral-500 uppercase">
                IPS 3.5" USB-C
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isSerialStreaming && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  USB SYNC
                </span>
              )}
              <span className="text-[10px] font-mono text-neutral-500">
                {displayWidth}x{displayHeight}
              </span>
            </div>
          </div>

          {/* Inner Display Glass & Active Canvas Area */}
          <div className="relative bg-black rounded-lg overflow-hidden border border-neutral-800/80 shadow-inner group">
            {/* The True 320x480 or 480x320 Canvas */}
            <canvas
              ref={canvasRef as any}
              width={displayWidth}
              height={displayHeight}
              className="block mx-auto image-rendering-pixelated"
              style={{
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
                transform: isReversed ? 'rotate(180deg)' : undefined,
                filter: `brightness(${Math.max(20, config.brightness)}%) ${
                  config.invertColors ? 'invert(1)' : ''
                }`,
              }}
            />

            {/* Subtle IPS Glass Reflection overlay */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.08]" />

            {/* Hardware Refresh Overlay Badge on hover */}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-slate-400 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              ~{fps} FPS
            </div>
          </div>

          {/* Bottom & Side USB-C Ports Representation */}
          <div className="flex items-center justify-between pt-3 px-2 text-[10px] text-neutral-500 font-mono">
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-1.5 bg-neutral-800 rounded-sm border border-neutral-700" />
              <span>Primary USB-C</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Secondary USB-C</span>
              <span className="inline-block w-4 h-1.5 bg-neutral-800 rounded-sm border border-neutral-700" />
            </div>
          </div>
        </div>

        {/* Kickstand Foot in Front */}
        <div
          className={`absolute ${
            isPortrait ? '-bottom-2 left-6 w-20' : '-bottom-2 left-12 w-28'
          } h-2 bg-gradient-to-r from-neutral-800 to-neutral-900 rounded-b-md border-b border-neutral-700 shadow-md`}
        />
      </div>

      {/* Hardware specs bar */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Tv className="w-3.5 h-3.5 text-slate-500" /> 3.5" IPS Panel (480×320 / 320×480)
        </span>
        <span aria-hidden="true" className="text-slate-700">·</span>
        <span>115200 bps Serial COM</span>
        <span aria-hidden="true" className="text-slate-700">·</span>
        <span>16-bit RGB565 Color</span>
        <span aria-hidden="true" className="text-slate-700">·</span>
        <span className="text-emerald-400">Native Windows & macOS</span>
      </div>
    </div>
  );
};
