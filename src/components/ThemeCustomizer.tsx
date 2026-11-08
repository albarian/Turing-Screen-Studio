/**
 * Context-aware controls for current active theme/mode
 */

import React, { useRef } from 'react';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  CryptoItem,
  MediaData,
  PomodoroState,
  ScreenConfig,
  StatusSignData,
  SystemMetrics,
  WeatherData,
} from '../types/screen';

interface ThemeCustomizerProps {
  config: ScreenConfig;
  onChangeConfig: (updates: Partial<ScreenConfig>) => void;
  metrics: SystemMetrics;
  onUpdateMetrics: (updates: Partial<SystemMetrics>) => void;
  weather: WeatherData;
  onUpdateWeather: (updates: Partial<WeatherData>) => void;
  media: MediaData;
  onUpdateMedia: (updates: Partial<MediaData>) => void;
  crypto: CryptoItem[];
  pomodoro: PomodoroState;
  onUpdatePomodoro: (updates: Partial<PomodoroState>) => void;
  statusSign: StatusSignData;
  onUpdateStatusSign: (updates: Partial<StatusSignData>) => void;
  onUploadImage: (img: HTMLImageElement) => void;
  isMicActive: boolean;
  onToggleMic: () => void;
}

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  config,
  onChangeConfig,
  metrics,
  onUpdateMetrics,
  weather,
  onUpdateWeather,
  media,
  onUpdateMedia,
  crypto,
  pomodoro,
  onUpdatePomodoro,
  statusSign,
  onUpdateStatusSign,
  onUploadImage,
  isMicActive,
  onToggleMic,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        onUploadImage(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-100">Theme Customizer</h3>
        <span className="text-xs text-cyan-400 font-mono capitalize">
          {config.mode.replace('_', ' ')}
        </span>
      </div>

      {/* Global Visual Toggles */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={config.showScanlines}
            onChange={(e) => onChangeConfig({ showScanlines: e.target.checked })}
            className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
          />
          <span>CRT Scanline Effect</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={config.dithering}
            onChange={(e) => onChangeConfig({ dithering: e.target.checked })}
            className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
          />
          <span>Retro Dithering Filter</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={config.invertColors}
            onChange={(e) => onChangeConfig({ invertColors: e.target.checked })}
            className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
          />
          <span>Invert Colors</span>
        </label>
      </div>

      {/* CONTROLS PER MODE */}

      {/* 1. HARDWARE HUD OR RETRO PIXEL */}
      {(config.mode === 'hardware_hud' || config.mode === 'retro_pixel') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Simulation Load Profiles:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateMetrics({ cpuUsage: 12, gpuUsage: 5, cpuTemp: 38, gpuTemp: 42, fanRpm: 900 })}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300"
              >
                Idle (Eco)
              </button>
              <button
                onClick={() => onUpdateMetrics({ cpuUsage: 45, gpuUsage: 35, cpuTemp: 52, gpuTemp: 56, fanRpm: 1400 })}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300"
              >
                Normal Work
              </button>
              <button
                onClick={() => onUpdateMetrics({ cpuUsage: 88, gpuUsage: 94, cpuTemp: 78, gpuTemp: 82, fanRpm: 2600 })}
                className="px-2.5 py-1 rounded bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900"
              >
                Heavy / Gaming
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>CPU: {Math.round(metrics.cpuUsage)}%</span>
                <span className="text-cyan-400">{metrics.cpuTemp}°C</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={metrics.cpuUsage}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateMetrics({ cpuUsage: val, cpuTemp: Math.round(35 + val * 0.45) });
                }}
                className="w-full accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>GPU: {Math.round(metrics.gpuUsage)}%</span>
                <span className="text-purple-400">{metrics.gpuTemp}°C</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={metrics.gpuUsage}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateMetrics({ gpuUsage: val, gpuTemp: Math.round(40 + val * 0.42) });
                }}
                className="w-full accent-purple-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>RAM: {Math.round(metrics.ramUsage)}%</span>
                <span className="text-emerald-400">{metrics.ramUsedGb.toFixed(1)}G</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={metrics.ramUsage}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateMetrics({
                    ramUsage: val,
                    ramUsedGb: Number(((val / 100) * metrics.ramTotalGb).toFixed(1)),
                  });
                }}
                className="w-full accent-emerald-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Fan Speed</span>
                <span className="text-amber-400">{metrics.fanRpm} RPM</span>
              </div>
              <input
                type="range"
                min="600"
                max="3200"
                step="50"
                value={metrics.fanRpm}
                onChange={(e) => onUpdateMetrics({ fanRpm: Number(e.target.value) })}
                className="w-full accent-amber-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. WEATHER & MINIMAL DESK */}
      {(config.mode === 'weather_clock' || config.mode === 'minimal_desk') && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">City / Location</label>
            <input
              type="text"
              value={weather.city}
              onChange={(e) => onUpdateWeather({ city: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Temperature (°C)</label>
            <input
              type="number"
              value={weather.temp}
              onChange={(e) => onUpdateWeather({ temp: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Weather Condition</label>
            <select
              value={weather.condition}
              onChange={(e) => onUpdateWeather({ condition: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
            >
              <option value="sunny">Sunny</option>
              <option value="partly_cloudy">Partly Cloudy</option>
              <option value="cloudy">Cloudy</option>
              <option value="rain">Rain</option>
              <option value="thunder">Thunderstorm</option>
              <option value="snow">Snow</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Humidity (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={weather.humidity}
              onChange={(e) => onUpdateWeather({ humidity: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
            />
          </div>
        </div>
      )}

      {/* 3. MEDIA PLAYER / SPOTIFY */}
      {config.mode === 'media_player' && (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Track Title</label>
              <input
                type="text"
                value={media.title}
                onChange={(e) => onUpdateMedia({ title: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Artist</label>
              <input
                type="text"
                value={media.artist}
                onChange={(e) => onUpdateMedia({ artist: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Album</label>
              <input
                type="text"
                value={media.album}
                onChange={(e) => onUpdateMedia({ album: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => onUpdateMedia({ isPlaying: !media.isPlaying })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg transition-colors"
            >
              {media.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{media.isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              onClick={onToggleMic}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                isMicActive
                  ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              }`}
            >
              {isMicActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              <span>
                {isMicActive
                  ? 'Microphone Active (Realtime EQ)'
                  : 'Enable Microphone for Live Visualizer'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 4. POMODORO */}
      {config.mode === 'pomodoro' && (
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdatePomodoro({ isRunning: !pomodoro.isRunning })}
                className={`flex items-center gap-1.5 px-4 py-2 font-medium rounded-lg text-slate-950 transition-colors ${
                  pomodoro.isRunning ? 'bg-amber-400 hover:bg-amber-300' : 'bg-emerald-400 hover:bg-emerald-300'
                }`}
              >
                {pomodoro.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{pomodoro.isRunning ? 'Pause' : 'Start'}</span>
              </button>

              <button
                onClick={() =>
                  onUpdatePomodoro({
                    isRunning: false,
                    timeLeftSec: pomodoro.mode === 'focus' ? 25 * 60 : 5 * 60,
                  })
                }
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => onUpdatePomodoro({ mode: 'focus', timeLeftSec: 25 * 60, isRunning: false })}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  pomodoro.mode === 'focus' ? 'bg-rose-500 text-white font-medium' : 'text-slate-400'
                }`}
              >
                Focus (25m)
              </button>
              <button
                onClick={() => onUpdatePomodoro({ mode: 'short_break', timeLeftSec: 5 * 60, isRunning: false })}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  pomodoro.mode === 'short_break' ? 'bg-emerald-500 text-white font-medium' : 'text-slate-400'
                }`}
              >
                Break (5m)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Task Title</label>
            <input
              type="text"
              value={pomodoro.taskTitle}
              onChange={(e) => onUpdatePomodoro({ taskTitle: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
            />
          </div>
        </div>
      )}

      {/* 5. CUSTOM IMAGE */}
      {config.mode === 'custom_image' && (
        <div className="space-y-3 text-xs">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageFileChange}
            accept="image/*"
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Image from PC or Mac</span>
            </button>
            <span className="text-slate-400">
              Supports PNG, JPEG, WEBP and GIF. Auto-fits to 320x480 / 480x320.
            </span>
          </div>
        </div>
      )}

      {/* 6. STATUS SIGN */}
      {config.mode === 'status_sign' && (
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { title: 'IN A MEETING', subtitle: 'Please do not disturb', color: '#ef4444' },
              { title: 'ON AIR / RECORDING', subtitle: 'Silence in the room', color: '#f59e0b' },
              { title: 'AVAILABLE', subtitle: 'Feel free to step in', color: '#10b981' },
              { title: 'DEEP FOCUS', subtitle: 'Coding session in progress', color: '#3b82f6' },
            ].map((preset) => (
              <button
                key={preset.title}
                onClick={() =>
                  onUpdateStatusSign({
                    title: preset.title,
                    subtitle: preset.subtitle,
                    accentColor: preset.color,
                  })
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors"
              >
                {preset.title}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Main Heading</label>
              <input
                type="text"
                value={statusSign.title}
                onChange={(e) => onUpdateStatusSign({ title: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Subtitle</label>
              <input
                type="text"
                value={statusSign.subtitle}
                onChange={(e) => onUpdateStatusSign({ subtitle: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
