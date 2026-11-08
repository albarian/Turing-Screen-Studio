/**
 * Theme & Mode Selector for Turing Screen
 */

import React from 'react';
import {
  Activity,
  Clock,
  Coins,
  Cpu,
  Flame,
  Gamepad2,
  Image as ImageIcon,
  Music,
  ShieldAlert,
} from 'lucide-react';
import { ScreenMode } from '../types/screen';

interface ThemeSelectorProps {
  currentMode: ScreenMode;
  onSelectMode: (mode: ScreenMode) => void;
}

interface ThemeOption {
  id: ScreenMode;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const THEMES: ThemeOption[] = [
  {
    id: 'hardware_hud',
    title: 'Hardware Monitor HUD',
    desc: 'CPU, GPU, RAM, Storage and Network with circular AIDA64-style dials',
    icon: Cpu,
  },
  {
    id: 'minimal_desk',
    title: 'Minimalist Desk Clock',
    desc: 'Swiss typographic design with large digits, date, and clean system bars',
    icon: Clock,
  },
  {
    id: 'retro_pixel',
    title: 'Retro Pixel Console',
    desc: '8-bit Game Boy green phosphor aesthetic with pixelated progress meters',
    icon: Gamepad2,
  },
  {
    id: 'weather_clock',
    title: 'Weather Station & Clock',
    desc: 'Desk clock with live local temperature, humidity, and weather forecast',
    icon: Activity,
  },
  {
    id: 'media_player',
    title: 'Media Player / Spotify',
    desc: 'Album artwork, track name, artist and animated audio frequency visualizer',
    icon: Music,
  },
  {
    id: 'crypto_ticker',
    title: 'Crypto & Market Ticker',
    desc: 'Live 24h prices and sparkline charts for Bitcoin, Ethereum, and Solana',
    icon: Coins,
  },
  {
    id: 'pomodoro',
    title: 'Pomodoro Focus Timer',
    desc: '25/5 min desk countdown ring to keep you in flow state',
    icon: Flame,
  },
  {
    id: 'custom_image',
    title: 'Photo Frame & Gallery',
    desc: 'Upload any PNG/JPG image or meme with optional retro dithering filter',
    icon: ImageIcon,
  },
  {
    id: 'status_sign',
    title: '"In a Meeting" On-Air Sign',
    desc: 'Do not disturb / on air status badge for home office and desk setups',
    icon: ShieldAlert,
  },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentMode, onSelectMode }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Display Themes & Modes</h3>
        <span className="text-xs text-slate-500 font-mono">9 Templates</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {THEMES.map((theme) => {
          const Icon = theme.icon;
          const isSelected = currentMode === theme.id;

          return (
            <button
              key={theme.id}
              onClick={() => onSelectMode(theme.id)}
              className={`flex items-start gap-3 p-3 text-left rounded-xl border transition-all duration-150 ${
                isSelected
                  ? 'bg-slate-800/90 border-cyan-500/80 shadow-md shadow-cyan-950/30'
                  : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-xs font-semibold truncate ${
                      isSelected ? 'text-white' : 'text-slate-200'
                    }`}
                  >
                    {theme.title}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                  {theme.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
