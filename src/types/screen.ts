/**
 * Types and interfaces for Turing 3.5" IPS Screen Studio
 */

export type ScreenMode =
  | 'hardware_hud'
  | 'minimal_desk'
  | 'retro_pixel'
  | 'weather_clock'
  | 'media_player'
  | 'crypto_ticker'
  | 'pomodoro'
  | 'custom_image'
  | 'status_sign';

export type OrientationMode = 'portrait' | 'reverse_portrait' | 'landscape' | 'reverse_landscape';

export const isPortraitOrientation = (orientation: OrientationMode): boolean =>
  orientation === 'portrait' || orientation === 'reverse_portrait';

export const isReversedOrientation = (orientation: OrientationMode): boolean =>
  orientation === 'reverse_portrait' || orientation === 'reverse_landscape';

export const toggleOrientationShape = (orientation: OrientationMode): OrientationMode => {
  switch (orientation) {
    case 'portrait':
      return 'landscape';
    case 'reverse_portrait':
      return 'reverse_landscape';
    case 'landscape':
      return 'portrait';
    case 'reverse_landscape':
      return 'reverse_portrait';
  }
};

export const toggleOrientationDirection = (orientation: OrientationMode): OrientationMode => {
  switch (orientation) {
    case 'portrait':
      return 'reverse_portrait';
    case 'reverse_portrait':
      return 'portrait';
    case 'landscape':
      return 'reverse_landscape';
    case 'reverse_landscape':
      return 'landscape';
  }
};

export interface SystemMetrics {
  cpuUsage: number; // 0-100
  cpuTemp: number; // °C
  cpuClock: number; // GHz
  gpuUsage: number; // 0-100
  gpuTemp: number; // °C
  gpuVram: number; // %
  ramUsage: number; // 0-100
  ramUsedGb: number; // GB
  ramTotalGb: number; // GB
  diskUsage: number; // 0-100
  diskUsedGb: number;
  diskTotalGb: number;
  netDownloadKb: number; // KB/s
  netUploadKb: number; // KB/s
  fanRpm: number;
  batteryLevel?: number; // 0-100
  isCharging?: boolean;
}

export interface WeatherData {
  city: string;
  condition: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'thunder' | 'snow';
  temp: number; // °C
  tempMin: number;
  tempMax: number;
  humidity: number; // %
  windSpeed: number; // km/h
}

export interface MediaData {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  progressSec: number;
  durationSec: number;
  isPlaying: boolean;
  visualizerBands: number[]; // 8-16 bars
}

export interface CryptoItem {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number; // percentage
  history: number[]; // mini sparkline
}

export interface PomodoroState {
  mode: 'focus' | 'short_break' | 'long_break';
  timeLeftSec: number;
  isRunning: boolean;
  taskTitle: string;
  completedSessions: number;
}

export interface StatusSignData {
  status: 'meeting' | 'dnd' | 'available' | 'recording' | 'custom';
  title: string;
  subtitle: string;
  accentColor: string;
}

export interface ScreenConfig {
  mode: ScreenMode;
  orientation: OrientationMode;
  brightness: number; // 0-100
  fpsLimit: number; // 1, 2, 5, 10, or 0 (manual)
  accentColor: string;
  showScanlines: boolean;
  invertColors: boolean;
  dithering: boolean;
  // Hardware calibration for different revisions & timing
  endianness: 'little' | 'big';
  colorOrder: 'rgb' | 'bgr';
  chunkPacingMs: number; // delay in ms between transmission chunks (prevents UART FIFO overflow)
  linesPerChunk: number; // number of scanlines per transmission chunk
  hardwareRev: 'rev_a' | 'rev_b';
  protocol: 'turing_standard' | 'xuanfang_rev_b' | 'raw_stream';
  testPattern: 'none' | 'color_bars' | 'grid' | 'white' | 'black' | 'red' | 'green' | 'blue';
  horizontalOffset: number; // Pixel shift (-32 to +32) for interactive calibration
  transmissionMode: 'safety_cooldown' | 'single_line_direct' | 'monolithic_block'; // Anti-drift transmission strategy
  headerDelayMs: number; // Guard delay in ms after DISPLAY_BITMAP header before pixel streaming (prevents CH552 FIFO drop)
}
