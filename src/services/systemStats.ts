/**
 * System telemetry simulator & browser audio/hardware stats provider
 */

import { CryptoItem, MediaData, PomodoroState, StatusSignData, SystemMetrics, WeatherData } from '../types/screen';

export class SystemStatsManager {
  private metrics: SystemMetrics = {
    cpuUsage: 28,
    cpuTemp: 44,
    cpuClock: 3.8,
    gpuUsage: 35,
    gpuTemp: 52,
    gpuVram: 42,
    ramUsage: 48,
    ramUsedGb: 15.4,
    ramTotalGb: 32,
    diskUsage: 64,
    diskUsedGb: 640,
    diskTotalGb: 1000,
    netDownloadKb: 2840,
    netUploadKb: 420,
    fanRpm: 1250,
  };

  private weather: WeatherData = {
    city: 'Madrid',
    condition: 'sunny',
    temp: 22,
    tempMin: 14,
    tempMax: 26,
    humidity: 45,
    windSpeed: 12,
  };

  private media: MediaData = {
    title: 'Midnight City',
    artist: 'M83',
    album: 'Hurry Up, We\'re Dreaming',
    coverUrl: '',
    progressSec: 84,
    durationSec: 243,
    isPlaying: true,
    visualizerBands: [40, 65, 80, 50, 90, 75, 60, 45, 70, 85, 95, 60, 40, 55, 70, 45],
  };

  private crypto: CryptoItem[] = [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      priceUsd: 89450,
      change24h: 3.42,
      history: [86200, 86800, 87400, 86900, 88100, 89450],
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      priceUsd: 3340,
      change24h: 1.85,
      history: [3250, 3280, 3310, 3290, 3320, 3340],
    },
    {
      symbol: 'SOL',
      name: 'Solana',
      priceUsd: 198.5,
      change24h: -1.2,
      history: [205, 203, 201, 199, 197, 198.5],
    },
    {
      symbol: 'NVDA',
      name: 'Nvidia',
      priceUsd: 138.2,
      change24h: 4.15,
      history: [131, 132, 134, 133, 136, 138.2],
    },
  ];

  private pomodoro: PomodoroState = {
    mode: 'focus',
    timeLeftSec: 25 * 60,
    isRunning: false,
    taskTitle: 'Desarrollo & Configuración',
    completedSessions: 3,
  };

  private statusSign: StatusSignData = {
    status: 'meeting',
    title: 'EN REUNIÓN',
    subtitle: 'Por favor, no interrumpir',
    accentColor: '#ef4444',
  };

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private audioDataArray: Uint8Array | null = null;
  public isMicListening = false;

  constructor() {
    this.initNativeStats();
  }

  private async initNativeStats() {
    // Check if Battery API is supported
    if ('getBattery' in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery();
        this.metrics.batteryLevel = Math.round(battery.level * 100);
        this.metrics.isCharging = battery.charging;
        battery.addEventListener('levelchange', () => {
          this.metrics.batteryLevel = Math.round(battery.level * 100);
        });
        battery.addEventListener('chargingchange', () => {
          this.metrics.isCharging = battery.charging;
        });
      } catch (e) {
        // Battery API not available
      }
    }
  }

  /**
   * Start microphone input for real live audio visualizer
   */
  public async enableMicAudio(): Promise<boolean> {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const source = this.audioCtx.createMediaStreamSource(this.micStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);
      this.audioDataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isMicListening = true;
      return true;
    } catch (err) {
      console.warn('Microphone permission not granted, using simulated audio:', err);
      this.isMicListening = false;
      return false;
    }
  }

  public disableMicAudio() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.isMicListening = false;
  }

  /**
   * Tick simulation forward
   */
  public tick(profile: 'normal' | 'gaming' | 'idle' = 'normal') {
    // 1. Natural metrics variation
    const jitter = (val: number, range: number, min: number, max: number) => {
      const delta = (Math.random() - 0.5) * range;
      return Math.max(min, Math.min(max, val + delta));
    };

    if (profile === 'gaming') {
      this.metrics.cpuUsage = jitter(this.metrics.cpuUsage, 6, 65, 95);
      this.metrics.cpuTemp = jitter(this.metrics.cpuTemp, 1.5, 68, 85);
      this.metrics.gpuUsage = jitter(this.metrics.gpuUsage, 8, 85, 99);
      this.metrics.gpuTemp = jitter(this.metrics.gpuTemp, 1.5, 72, 82);
      this.metrics.fanRpm = Math.round(jitter(this.metrics.fanRpm, 80, 2200, 2900));
      this.metrics.cpuClock = 4.6;
    } else if (profile === 'idle') {
      this.metrics.cpuUsage = jitter(this.metrics.cpuUsage, 2, 5, 18);
      this.metrics.cpuTemp = jitter(this.metrics.cpuTemp, 0.5, 36, 42);
      this.metrics.gpuUsage = jitter(this.metrics.gpuUsage, 2, 2, 10);
      this.metrics.gpuTemp = jitter(this.metrics.gpuTemp, 0.5, 40, 46);
      this.metrics.fanRpm = Math.round(jitter(this.metrics.fanRpm, 30, 800, 1100));
      this.metrics.cpuClock = 2.4;
    } else {
      // Normal
      this.metrics.cpuUsage = jitter(this.metrics.cpuUsage, 4, 20, 55);
      this.metrics.cpuTemp = jitter(this.metrics.cpuTemp, 0.8, 42, 58);
      this.metrics.gpuUsage = jitter(this.metrics.gpuUsage, 4, 15, 60);
      this.metrics.gpuTemp = jitter(this.metrics.gpuTemp, 0.8, 48, 62);
      this.metrics.fanRpm = Math.round(jitter(this.metrics.fanRpm, 40, 1100, 1600));
      this.metrics.cpuClock = 3.9;
    }

    this.metrics.netDownloadKb = Math.round(jitter(this.metrics.netDownloadKb, 350, 120, 12500));
    this.metrics.netUploadKb = Math.round(jitter(this.metrics.netUploadKb, 80, 20, 2200));

    // 2. Audio bands
    if (this.isMicListening && this.analyser && this.audioDataArray) {
      this.analyser.getByteFrequencyData(this.audioDataArray as any);
      const bands: number[] = [];
      const step = Math.floor(this.audioDataArray.length / 16) || 1;
      for (let i = 0; i < 16; i++) {
        const val = this.audioDataArray[i * step] || 0;
        bands.push(Math.round((val / 255) * 100));
      }
      this.media.visualizerBands = bands;
    } else if (this.media.isPlaying) {
      // Simulated equalizer rhythm
      this.media.visualizerBands = this.media.visualizerBands.map((b) =>
        Math.round(jitter(b, 25, 15, 100))
      );
      this.media.progressSec = (this.media.progressSec + 1) % (this.media.durationSec || 240);
    }

    // 3. Pomodoro countdown
    if (this.pomodoro.isRunning && this.pomodoro.timeLeftSec > 0) {
      this.pomodoro.timeLeftSec -= 1;
      if (this.pomodoro.timeLeftSec === 0) {
        if (this.pomodoro.mode === 'focus') {
          this.pomodoro.completedSessions += 1;
          this.pomodoro.mode = 'short_break';
          this.pomodoro.timeLeftSec = 5 * 60;
        } else {
          this.pomodoro.mode = 'focus';
          this.pomodoro.timeLeftSec = 25 * 60;
        }
      }
    }
  }

  public getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  public getWeather(): WeatherData {
    return { ...this.weather };
  }

  public getMedia(): MediaData {
    return { ...this.media };
  }

  public getCrypto(): CryptoItem[] {
    return [...this.crypto];
  }

  public getPomodoro(): PomodoroState {
    return { ...this.pomodoro };
  }

  public getStatusSign(): StatusSignData {
    return { ...this.statusSign };
  }

  public setWeather(w: Partial<WeatherData>) {
    this.weather = { ...this.weather, ...w };
  }

  public setMedia(m: Partial<MediaData>) {
    this.media = { ...this.media, ...m };
  }

  public setPomodoro(p: Partial<PomodoroState>) {
    this.pomodoro = { ...this.pomodoro, ...p };
  }

  public setStatusSign(s: Partial<StatusSignData>) {
    this.statusSign = { ...this.statusSign, ...s };
  }

  public setMetrics(m: Partial<SystemMetrics>) {
    this.metrics = { ...this.metrics, ...m };
  }
}
