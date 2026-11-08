/**
 * Renders themes onto the 320x480 (portrait) or 480x320 (landscape) canvas
 * Exactly matching the physical hardware display capabilities of Turing 3.5".
 */

import {
  CryptoItem,
  MediaData,
  OrientationMode,
  PomodoroState,
  ScreenConfig,
  StatusSignData,
  SystemMetrics,
  WeatherData,
} from '../types/screen';

export class ScreenRenderer {
  /**
   * Helper to format double digits
   */
  private static pad(n: number): string {
    return n < 10 ? '0' + n : String(n);
  }

  /**
   * Main render dispatch
   */
  public static render(
    canvas: HTMLCanvasElement,
    config: ScreenConfig,
    metrics: SystemMetrics,
    weather: WeatherData,
    media: MediaData,
    crypto: CryptoItem[],
    pomodoro: PomodoroState,
    statusSign: StatusSignData,
    customImage: HTMLImageElement | null
  ) {
    const isPortrait = config.orientation === 'portrait';
    const width = isPortrait ? 320 : 480;
    const height = isPortrait ? 480 : 320;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Base background fill
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, width, height);

    // Apply interactive horizontal calibration offset
    const hOffset = config.horizontalOffset || 0;
    if (hOffset !== 0) {
      ctx.setTransform(1, 0, 0, 1, hOffset, 0);
    }

    // If a hardware test pattern is active, render it directly
    if (config.testPattern && config.testPattern !== 'none') {
      this.renderTestPattern(ctx, width, height, config.testPattern, isPortrait);
      return;
    }

    // Draw active theme
    switch (config.mode) {
      case 'hardware_hud':
        this.renderHardwareHud(ctx, width, height, metrics, isPortrait);
        break;
      case 'minimal_desk':
        this.renderMinimalDesk(ctx, width, height, metrics, weather, isPortrait);
        break;
      case 'retro_pixel':
        this.renderRetroPixel(ctx, width, height, metrics, isPortrait);
        break;
      case 'weather_clock':
        this.renderWeatherClock(ctx, width, height, weather, isPortrait);
        break;
      case 'media_player':
        this.renderMediaPlayer(ctx, width, height, media, isPortrait);
        break;
      case 'crypto_ticker':
        this.renderCryptoTicker(ctx, width, height, crypto, isPortrait);
        break;
      case 'pomodoro':
        this.renderPomodoro(ctx, width, height, pomodoro, isPortrait);
        break;
      case 'custom_image':
        this.renderCustomImage(ctx, width, height, customImage, config);
        break;
      case 'status_sign':
        this.renderStatusSign(ctx, width, height, statusSign, isPortrait);
        break;
    }

    // Optional CRT scanline overlay effect
    if (config.showScanlines) {
      this.drawScanlines(ctx, width, height);
    }
  }

  // ==========================================
  // THEME 1: HARDWARE HUD (Cyberpunk / AIDA64 style)
  // ==========================================
  private static renderHardwareHud(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    m: SystemMetrics,
    portrait: boolean
  ) {
    // Header bar
    ctx.fillStyle = '#0c121e';
    ctx.fillRect(0, 0, w, 32);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 32);
    ctx.lineTo(w, 32);
    ctx.stroke();

    // Header Title
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.fillText('PC HARDWARE TELEMETRY', 10, 20);

    const now = new Date();
    const timeStr = `${this.pad(now.getHours())}:${this.pad(now.getMinutes())}:${this.pad(now.getSeconds())}`;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, w - 10, 20);
    ctx.textAlign = 'left';

    if (portrait) {
      // 2 Big Circular Gauges: CPU & GPU
      this.drawArcGauge(ctx, 80, 105, 54, m.cpuUsage, 100, '#06b6d4', 'CPU', `${Math.round(m.cpuUsage)}%`, `${m.cpuTemp}°C`);
      this.drawArcGauge(ctx, 240, 105, 54, m.gpuUsage, 100, '#a855f7', 'GPU', `${Math.round(m.gpuUsage)}%`, `${m.gpuTemp}°C`);

      // Clock speed subtext
      ctx.fillStyle = '#64748b';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${m.cpuClock.toFixed(2)} GHz`, 80, 168);
      ctx.fillText(`VRAM: ${Math.round(m.gpuVram)}%`, 240, 168);
      ctx.textAlign = 'left';

      // Middle Divider
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(16, 180);
      ctx.lineTo(w - 16, 180);
      ctx.stroke();

      // RAM Bar
      this.drawLinearMetricBar(ctx, 20, 200, w - 40, 12, 'RAM USAGE', `${m.ramUsedGb.toFixed(1)} / ${m.ramTotalGb} GB (${Math.round(m.ramUsage)}%)`, m.ramUsage / 100, '#10b981');

      // Disk Bar
      this.drawLinearMetricBar(ctx, 20, 250, w - 40, 12, 'SSD / DISK', `${m.diskUsedGb} / ${m.diskTotalGb} GB (${Math.round(m.diskUsage)}%)`, m.diskUsage / 100, '#f59e0b');

      // Network Stats Box
      ctx.fillStyle = '#0f172a';
      ctx.roundRect(20, 310, w - 40, 70, 8);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "Outfit", sans-serif';
      ctx.fillText('NETWORK REAL-TIME I/O', 32, 330);

      // Download
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.fillText(`↓ ${m.netDownloadKb > 1024 ? (m.netDownloadKb / 1024).toFixed(1) + ' MB/s' : Math.round(m.netDownloadKb) + ' KB/s'}`, 32, 355);

      // Upload
      ctx.fillStyle = '#ec4899';
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`↑ ${m.netUploadKb > 1024 ? (m.netUploadKb / 1024).toFixed(1) + ' MB/s' : Math.round(m.netUploadKb) + ' KB/s'}`, w - 32, 355);
      ctx.textAlign = 'left';

      // Footer Telemetry
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 420, w, 60);
      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(0, 420, w, 1);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`FAN SPEED: ${m.fanRpm} RPM`, 20, 445);
      ctx.fillText(`OS: Win/macOS Companion`, 20, 462);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#10b981';
      ctx.fillText('LIVE UART 115.2k', w - 20, 445);
      ctx.fillStyle = '#64748b';
      ctx.fillText('320x480 IPS', w - 20, 462);
      ctx.textAlign = 'left';

    } else {
      // LANDSCAPE (480 x 320)
      this.drawArcGauge(ctx, 80, 110, 52, m.cpuUsage, 100, '#06b6d4', 'CPU', `${Math.round(m.cpuUsage)}%`, `${m.cpuTemp}°C`);
      this.drawArcGauge(ctx, 220, 110, 52, m.gpuUsage, 100, '#a855f7', 'GPU', `${Math.round(m.gpuUsage)}%`, `${m.gpuTemp}°C`);
      this.drawArcGauge(ctx, 360, 110, 52, m.ramUsage, 100, '#10b981', 'RAM', `${Math.round(m.ramUsage)}%`, `${m.ramUsedGb.toFixed(1)}G`);

      // Bars below
      this.drawLinearMetricBar(ctx, 30, 195, 200, 10, 'DISK STORAGE', `${Math.round(m.diskUsage)}%`, m.diskUsage / 100, '#f59e0b');
      this.drawLinearMetricBar(ctx, 250, 195, 200, 10, 'FAN RPM', `${m.fanRpm} RPM`, m.fanRpm / 3000, '#38bdf8');

      // Network Strip
      ctx.fillStyle = '#0f172a';
      ctx.roundRect(30, 245, 420, 50, 6);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "Outfit", sans-serif';
      ctx.fillText('NET TRAFFIC', 45, 275);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText(`↓ ${m.netDownloadKb > 1024 ? (m.netDownloadKb / 1024).toFixed(1) + ' MB/s' : Math.round(m.netDownloadKb) + ' KB/s'}`, 140, 275);

      ctx.fillStyle = '#ec4899';
      ctx.fillText(`↑ ${m.netUploadKb > 1024 ? (m.netUploadKb / 1024).toFixed(1) + ' MB/s' : Math.round(m.netUploadKb) + ' KB/s'}`, 260, 275);

      ctx.fillStyle = '#10b981';
      ctx.textAlign = 'right';
      ctx.fillText('IPS 480x320', 435, 275);
      ctx.textAlign = 'left';
    }
  }

  // ==========================================
  // THEME 2: MINIMAL SWISS DESK
  // ==========================================
  private static renderMinimalDesk(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    m: SystemMetrics,
    weather: WeatherData,
    portrait: boolean
  ) {
    const now = new Date();
    const hours = this.pad(now.getHours());
    const minutes = this.pad(now.getMinutes());
    const seconds = this.pad(now.getSeconds());
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dateStr = `${dayNames[now.getDay()]} ${now.getDate()} ${monthNames[now.getMonth()]}`;

    if (portrait) {
      // Date kicker
      ctx.fillStyle = '#64748b';
      ctx.font = '600 11px "Outfit", sans-serif';
      ctx.fillText(dateStr, 24, 48);

      // Massive clock
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 64px "Outfit", sans-serif';
      ctx.fillText(`${hours}:${minutes}`, 20, 115);

      // Seconds pill
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText(`:${seconds}`, 205, 85);

      // Weather brief
      ctx.fillStyle = '#0f172a';
      ctx.roundRect(20, 140, w - 40, 52, 8);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px "Outfit", sans-serif';
      ctx.fillText(`${weather.temp}°C`, 36, 172);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px "Outfit", sans-serif';
      ctx.fillText(`${weather.city} · ${weather.condition.replace('_', ' ')}`, 105, 171);

      // Divider
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(24, 218);
      ctx.lineTo(w - 24, 218);
      ctx.stroke();

      // Clean Metrics Section
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px "Outfit", sans-serif';
      ctx.fillText('SYSTEM METRICS', 24, 246);

      // CPU Row
      this.drawMinimalRow(ctx, 24, 275, w - 48, 'CPU', `${Math.round(m.cpuUsage)}% · ${m.cpuTemp}°C`, m.cpuUsage / 100);

      // GPU Row
      this.drawMinimalRow(ctx, 24, 325, w - 48, 'GPU', `${Math.round(m.gpuUsage)}% · ${m.gpuTemp}°C`, m.gpuUsage / 100);

      // RAM Row
      this.drawMinimalRow(ctx, 24, 375, w - 48, 'MEMORY', `${m.ramUsedGb.toFixed(1)}GB (${Math.round(m.ramUsage)}%)`, m.ramUsage / 100);

      // Storage Row
      this.drawMinimalRow(ctx, 24, 425, w - 48, 'DISK C:', `${Math.round(m.diskUsage)}%`, m.diskUsage / 100);

    } else {
      // LANDSCAPE
      ctx.fillStyle = '#64748b';
      ctx.font = '600 12px "Outfit", sans-serif';
      ctx.fillText(dateStr, 32, 45);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 74px "Outfit", sans-serif';
      ctx.fillText(`${hours}:${minutes}`, 28, 122);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.fillText(`:${seconds}`, 240, 85);

      // Weather on right side
      ctx.fillStyle = '#0f172a';
      ctx.roundRect(32, 145, 190, 60, 8);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 24px "Outfit", sans-serif';
      ctx.fillText(`${weather.temp}°C`, 48, 183);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "Outfit", sans-serif';
      ctx.fillText(weather.city, 115, 175);
      ctx.fillText(`Hum: ${weather.humidity}%`, 115, 192);

      // Right Column Metrics
      this.drawMinimalRow(ctx, 250, 60, 200, 'CPU LOAD', `${Math.round(m.cpuUsage)}% (${m.cpuTemp}°C)`, m.cpuUsage / 100);
      this.drawMinimalRow(ctx, 250, 115, 200, 'GPU LOAD', `${Math.round(m.gpuUsage)}% (${m.gpuTemp}°C)`, m.gpuUsage / 100);
      this.drawMinimalRow(ctx, 250, 170, 200, 'RAM USAGE', `${m.ramUsedGb.toFixed(1)}GB (${Math.round(m.ramUsage)}%)`, m.ramUsage / 100);
      this.drawMinimalRow(ctx, 250, 225, 200, 'STORAGE', `${Math.round(m.diskUsage)}%`, m.diskUsage / 100);
    }
  }

  // ==========================================
  // THEME 3: RETRO PIXEL (8-Bit / Game Boy style)
  // ==========================================
  private static renderRetroPixel(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    m: SystemMetrics,
    portrait: boolean
  ) {
    // Vintage Game Boy / Amber CRT phosphor background
    ctx.fillStyle = '#0f1d14';
    ctx.fillRect(0, 0, w, h);

    // Pixel frame border
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Title
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText('== RETRO PC HUD ==', 24, 32);

    const now = new Date();
    const timeStr = `${this.pad(now.getHours())}:${this.pad(now.getMinutes())}:${this.pad(now.getSeconds())}`;
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, w - 24, 32);
    ctx.textAlign = 'left';

    // Pixel mascot (8-bit computer icon)
    this.drawPixelComputer(ctx, 24, 50);

    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText('SYS.NORMAL', 80, 72);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#34d399';
    ctx.fillText(`UPTIME: ACTIVE`, 80, 88);

    // Metric pixel bars
    const yStart = 115;
    this.drawPixelBar(ctx, 24, yStart, w - 48, 'CPU', m.cpuUsage, `${m.cpuTemp}C`);
    this.drawPixelBar(ctx, 24, yStart + 55, w - 48, 'GPU', m.gpuUsage, `${m.gpuTemp}C`);
    this.drawPixelBar(ctx, 24, yStart + 110, w - 48, 'MEM', m.ramUsage, `${m.ramUsedGb.toFixed(1)}G`);
    this.drawPixelBar(ctx, 24, yStart + 165, w - 48, 'DSK', m.diskUsage, `${Math.round(m.diskUsage)}%`);

    // Bottom 8-bit text box
    ctx.fillStyle = '#07130b';
    ctx.fillRect(20, h - 85, w - 40, 60);
    ctx.strokeStyle = '#10b981';
    ctx.strokeRect(20, h - 85, w - 40, 60);

    ctx.fillStyle = '#34d399';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`FAN : ${m.fanRpm} RPM`, 32, h - 65);
    ctx.fillText(`DOWN: ${Math.round(m.netDownloadKb)} KB/s`, 32, h - 45);
    ctx.fillText(`UP  : ${Math.round(m.netUploadKb)} KB/s`, 32, h - 30);
  }

  // ==========================================
  // THEME 4: WEATHER CLOCK STATION
  // ==========================================
  private static renderWeatherClock(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    weather: WeatherData,
    portrait: boolean
  ) {
    const now = new Date();
    const hours = this.pad(now.getHours());
    const minutes = this.pad(now.getMinutes());
    const seconds = this.pad(now.getSeconds());

    // Weather icon illustration (Sun / Cloud)
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(portrait ? 80 : 380, portrait ? 85 : 80, 36, 0, Math.PI * 2);
    ctx.fill();

    // Soft cloud overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    const cx = portrait ? 85 : 385;
    const cy = portrait ? 95 : 90;
    ctx.arc(cx - 20, cy, 20, 0, Math.PI * 2);
    ctx.arc(cx + 8, cy - 8, 26, 0, Math.PI * 2);
    ctx.arc(cx + 30, cy, 18, 0, Math.PI * 2);
    ctx.fill();

    if (portrait) {
      // Temp display
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px "Outfit", sans-serif';
      ctx.fillText(`${weather.temp}°`, 150, 95);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '14px "Outfit", sans-serif';
      ctx.fillText(weather.condition.toUpperCase(), 155, 120);

      // City & Date
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px "Outfit", sans-serif';
      ctx.fillText(weather.city, 24, 160);

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      ctx.fillText(`${days[now.getDay()]}, ${now.getDate()} ${now.toLocaleDateString('en-US', { month: 'long' })}`, 24, 180);

      // Clock Block
      ctx.fillStyle = '#0f172a';
      ctx.roundRect(20, 210, w - 40, 110, 12);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 62px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${hours}:${minutes}`, w / 2, 280);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText(`:${seconds}`, w / 2 + 105, 250);
      ctx.textAlign = 'left';

      // 3 Weather Stats Cards
      const cardW = (w - 40 - 16) / 2;
      this.drawWeatherCard(ctx, 20, 340, cardW, 60, 'Humidity', `${weather.humidity}%`);
      this.drawWeatherCard(ctx, 20 + cardW + 16, 340, cardW, 60, 'Wind', `${weather.windSpeed} km/h`);
      this.drawWeatherCard(ctx, 20, 410, w - 40, 52, 'Forecast Today', `Min: ${weather.tempMin}°C · Max: ${weather.tempMax}°C`);
    } else {
      // Landscape
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px "Outfit", sans-serif';
      ctx.fillText(`${weather.temp}°C`, 32, 90);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px "Outfit", sans-serif';
      ctx.fillText(`${weather.city} · ${weather.condition}`, 32, 120);

      // Clock right side
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 58px "JetBrains Mono", monospace';
      ctx.fillText(`${hours}:${minutes}`, 32, 200);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.fillText(`:${seconds}`, 235, 175);

      // Weather details strip
      this.drawWeatherCard(ctx, 32, 235, 130, 60, 'Humidity', `${weather.humidity}%`);
      this.drawWeatherCard(ctx, 175, 235, 130, 60, 'Wind', `${weather.windSpeed} km/h`);
      this.drawWeatherCard(ctx, 318, 235, 130, 60, 'Hi / Lo', `${weather.tempMin}° / ${weather.tempMax}°`);
    }
  }

  // ==========================================
  // THEME 5: MEDIA / SPOTIFY NOW PLAYING
  // ==========================================
  private static renderMediaPlayer(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    media: MediaData,
    portrait: boolean
  ) {
    if (portrait) {
      // Album art placeholder or glow
      const artSize = 200;
      const artX = (w - artSize) / 2;
      const artY = 40;

      // Card container
      ctx.fillStyle = '#1e1b4b';
      ctx.roundRect(artX, artY, artSize, artSize, 12);
      ctx.fill();

      // Stylized music disc/vinyl in center
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(artX + artSize / 2, artY + artSize / 2, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(artX + artSize / 2, artY + artSize / 2, 25, 0, Math.PI * 2);
      ctx.fill();

      // Title & Artist
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(media.title, w / 2, 275);

      ctx.fillStyle = '#a5b4fc';
      ctx.font = '14px "Outfit", sans-serif';
      ctx.fillText(media.artist, w / 2, 300);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px "Outfit", sans-serif';
      ctx.fillText(media.album, w / 2, 320);

      // Animated Frequency Visualizer bars
      const numBars = 18;
      const barW = 8;
      const barGap = 5;
      const startX = (w - (numBars * (barW + barGap))) / 2;
      const baseY = 375;

      for (let i = 0; i < numBars; i++) {
        const val = media.visualizerBands[i % media.visualizerBands.length] || 30;
        const barH = (val / 100) * 35;
        ctx.fillStyle = i % 2 === 0 ? '#06b6d4' : '#a855f7';
        ctx.roundRect(startX + i * (barW + barGap), baseY - barH, barW, barH, 2);
        ctx.fill();
      }

      // Progress bar
      const progressFrac = Math.min(1, media.progressSec / (media.durationSec || 1));
      ctx.fillStyle = '#1e293b';
      ctx.roundRect(30, 400, w - 60, 6, 3);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.roundRect(30, 400, (w - 60) * progressFrac, 6, 3);
      ctx.fill();

      // Time timestamps
      const curM = Math.floor(media.progressSec / 60);
      const curS = this.pad(Math.floor(media.progressSec % 60));
      const totM = Math.floor(media.durationSec / 60);
      const totS = this.pad(Math.floor(media.durationSec % 60));

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${curM}:${curS}`, 30, 422);

      ctx.textAlign = 'right';
      ctx.fillText(`${totM}:${totS}`, w - 30, 422);
      ctx.textAlign = 'left';

      // Status pill
      ctx.textAlign = 'center';
      ctx.fillStyle = media.isPlaying ? '#10b981' : '#f59e0b';
      ctx.font = 'bold 12px "Outfit", sans-serif';
      ctx.fillText(media.isPlaying ? '▶ PLAYING' : '❚❚ PAUSED', w / 2, 455);
      ctx.textAlign = 'left';
    } else {
      // Landscape media player
      const artSize = 180;
      ctx.fillStyle = '#1e1b4b';
      ctx.roundRect(24, 30, artSize, artSize, 12);
      ctx.fill();

      // Vinyl
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(24 + artSize / 2, 30 + artSize / 2, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Right Column
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px "Outfit", sans-serif';
      ctx.fillText(media.title, 230, 65);

      ctx.fillStyle = '#a5b4fc';
      ctx.font = '15px "Outfit", sans-serif';
      ctx.fillText(media.artist, 230, 92);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px "Outfit", sans-serif';
      ctx.fillText(media.album, 230, 115);

      // Progress bar
      const progressFrac = Math.min(1, media.progressSec / (media.durationSec || 1));
      ctx.fillStyle = '#1e293b';
      ctx.roundRect(230, 145, 220, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.roundRect(230, 145, 220 * progressFrac, 6, 3);
      ctx.fill();

      // Equalizer bars
      for (let i = 0; i < 16; i++) {
        const val = media.visualizerBands[i % media.visualizerBands.length] || 25;
        const barH = (val / 100) * 35;
        ctx.fillStyle = '#06b6d4';
        ctx.roundRect(230 + i * 14, 215 - barH, 9, barH, 2);
        ctx.fill();
      }
    }
  }

  // ==========================================
  // THEME 6: CRYPTO & STOCKS TICKER
  // ==========================================
  private static renderCryptoTicker(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cryptoList: CryptoItem[],
    portrait: boolean
  ) {
    // Header
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, w, 36);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(0, 36, w, 1);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.fillText('MARKET WATCH', 16, 23);

    const now = new Date();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.pad(now.getHours())}:${this.pad(now.getMinutes())}`, w - 16, 23);
    ctx.textAlign = 'left';

    const itemHeight = portrait ? 95 : 75;
    cryptoList.slice(0, portrait ? 4 : 3).forEach((item, idx) => {
      const y = 48 + idx * (itemHeight + 10);
      ctx.fillStyle = '#0f172a';
      ctx.roundRect(14, y, w - 28, itemHeight, 8);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      // Symbol
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px "Outfit", sans-serif';
      ctx.fillText(item.symbol, 26, y + 26);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px "Outfit", sans-serif';
      ctx.fillText(item.name, 26, y + 42);

      // Price
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      const formattedPrice = item.priceUsd > 1000
        ? '$' + item.priceUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : '$' + item.priceUsd.toFixed(2);
      ctx.fillText(formattedPrice, w - 26, y + 26);

      // 24h Change
      const isPositive = item.change24h >= 0;
      ctx.fillStyle = isPositive ? '#10b981' : '#ef4444';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText(`${isPositive ? '+' : ''}${item.change24h.toFixed(2)}%`, w - 26, y + 44);
      ctx.textAlign = 'left';

      // Mini Sparkline chart
      if (item.history && item.history.length > 1) {
        ctx.strokeStyle = isPositive ? '#10b981' : '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const minVal = Math.min(...item.history);
        const maxVal = Math.max(...item.history);
        const range = maxVal - minVal || 1;
        const sparkW = w - 60;
        const sparkY = y + itemHeight - 14;

        item.history.forEach((val, ptIdx) => {
          const ptX = 26 + (ptIdx / (item.history.length - 1)) * sparkW;
          const ptNormY = sparkY - ((val - minVal) / range) * 16;
          if (ptIdx === 0) ctx.moveTo(ptX, ptNormY);
          else ctx.lineTo(ptX, ptNormY);
        });
        ctx.stroke();
      }
    });
  }

  // ==========================================
  // THEME 7: POMODORO & FOCUS TIMER
  // ==========================================
  private static renderPomodoro(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    p: PomodoroState,
    portrait: boolean
  ) {
    const mins = Math.floor(p.timeLeftSec / 60);
    const secs = this.pad(p.timeLeftSec % 60);

    const modeLabels = {
      focus: 'TIEMPO DE ENFOQUE',
      short_break: 'PAUSA CORTA',
      long_break: 'PAUSA LARGA',
    };

    const modeColors = {
      focus: '#ef4444',
      short_break: '#10b981',
      long_break: '#3b82f6',
    };

    const activeColor = modeColors[p.mode];

    // Mode Banner
    ctx.fillStyle = activeColor;
    ctx.fillRect(0, 0, w, 36);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(modeLabels[p.mode], w / 2, 22);

    // Big Circular Progress
    const cx = w / 2;
    const cy = portrait ? 180 : 160;
    const radius = portrait ? 85 : 75;

    // Total time standard based on mode
    const totalSecs = p.mode === 'focus' ? 25 * 60 : p.mode === 'short_break' ? 5 * 60 : 15 * 60;
    const fraction = Math.max(0, p.timeLeftSec / totalSecs);

    // Track
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Progress Arc
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (1 - fraction) * Math.PI * 2);
    ctx.stroke();

    // Center Timer Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "JetBrains Mono", monospace';
    ctx.fillText(`${this.pad(mins)}:${secs}`, cx, cy + 14);

    // Task & Count
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px "Outfit", sans-serif';
    ctx.fillText(p.taskTitle || 'Coding / Deep Work Session', cx, portrait ? 305 : 265);

    // Completed Pomodoros
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "Outfit", sans-serif';
    ctx.fillText(`Sessions completed today: ${p.completedSessions} 🍅`, cx, portrait ? 335 : 290);

    // State indicator
    ctx.fillStyle = p.isRunning ? '#10b981' : '#f59e0b';
    ctx.font = 'bold 13px "Outfit", sans-serif';
    ctx.fillText(p.isRunning ? '● RUNNING' : '❚❚ PAUSED', cx, portrait ? 385 : 305);
    ctx.textAlign = 'left';
  }

  // ==========================================
  // THEME 8: CUSTOM IMAGE / MEME / PHOTO FRAME
  // ==========================================
  private static renderCustomImage(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    img: HTMLImageElement | null,
    config: ScreenConfig
  ) {
    if (!img) {
      // Empty state
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#334155';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(20, 20, w - 40, h - 40);
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 15px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No image loaded', w / 2, h / 2 - 10);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px "Outfit", sans-serif';
      ctx.fillText('Upload a picture or meme to', w / 2, h / 2 + 15);
      ctx.fillText('display on your 3.5" screen', w / 2, h / 2 + 35);
      ctx.textAlign = 'left';
      return;
    }

    // Draw image scaling to fit/cover
    const imgRatio = img.width / img.height;
    const screenRatio = w / h;
    let dw = w;
    let dh = h;
    let dx = 0;
    let dy = 0;

    if (imgRatio > screenRatio) {
      // image is wider than screen
      dh = h;
      dw = h * imgRatio;
      dx = (w - dw) / 2;
    } else {
      // image is taller
      dw = w;
      dh = w / imgRatio;
      dy = (h - dh) / 2;
    }

    ctx.drawImage(img, dx, dy, dw, dh);

    // Optional 1-bit or 16-color Floyd-Steinberg dithering effect
    if (config.dithering) {
      this.applyDithering(ctx, w, h);
    }
  }

  // ==========================================
  // THEME 9: DESK STATUS SIGN ("EN REUNIÓN")
  // ==========================================
  private static renderStatusSign(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sign: StatusSignData,
    portrait: boolean
  ) {
    // Solid high-impact background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, w, h);

    // Neon Border
    ctx.strokeStyle = sign.accentColor || '#ef4444';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Pulsing Inner Box
    ctx.fillStyle = `${sign.accentColor}22`;
    ctx.fillRect(16, 16, w - 32, h - 32);

    ctx.textAlign = 'center';

    // Status Icon
    ctx.fillStyle = sign.accentColor || '#ef4444';
    ctx.beginPath();
    ctx.arc(w / 2, portrait ? 130 : 90, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Outfit", sans-serif';
    ctx.fillText('!', w / 2, portrait ? 138 : 98);

    // Main Big Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Outfit", sans-serif';
    ctx.fillText(sign.title, w / 2, portrait ? 220 : 160);

    // Subtitle
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px "Outfit", sans-serif';
    ctx.fillText(sign.subtitle, w / 2, portrait ? 260 : 200);

    // Footnote
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "JetBrains Mono", monospace';
    const now = new Date();
    ctx.fillText(`SINCE: ${this.pad(now.getHours())}:${this.pad(now.getMinutes())}`, w / 2, portrait ? 420 : 275);

    ctx.textAlign = 'left';
  }

  // ==========================================
  // DRAWING UTILITIES
  // ==========================================

  private static drawArcGauge(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    value: number,
    max: number,
    color: string,
    label: string,
    valueText: string,
    subText?: string
  ) {
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const totalAngle = endAngle - startAngle;
    const pct = Math.max(0, Math.min(1, value / max));

    // Outer track
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.stroke();

    // Active arc
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, startAngle + totalAngle * pct);
    ctx.stroke();

    // Texts inside
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.fillText(label, cx, cy - 14);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText(valueText, cx, cy + 8);

    if (subText) {
      ctx.fillStyle = color;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(subText, cx, cy + 24);
    }
    ctx.textAlign = 'left';
  }

  private static drawLinearMetricBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    valText: string,
    pct: number,
    color: string
  ) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Outfit", sans-serif';
    ctx.fillText(label, x, y - 5);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(valText, x + w, y - 5);
    ctx.textAlign = 'left';

    // Track
    ctx.fillStyle = '#1e293b';
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();

    // Bar
    const barWidth = Math.max(h, Math.min(w, w * Math.min(1, Math.max(0, pct))));
    ctx.fillStyle = color;
    ctx.roundRect(x, y, barWidth, h, h / 2);
    ctx.fill();
  }

  private static drawMinimalRow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    label: string,
    stat: string,
    fraction: number
  ) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Outfit", sans-serif';
    ctx.fillText(label, x, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(stat, x + w, y);
    ctx.textAlign = 'left';

    // Thin bar below
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y + 6, w, 3);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x, y + 6, w * Math.min(1, Math.max(0, fraction)), 3);
  }

  private static drawPixelBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    name: string,
    value: number,
    detail: string
  ) {
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText(`${name} [${Math.round(value)}%] ${detail}`, x, y);

    // Segmented retro blocks
    const totalBlocks = 16;
    const activeBlocks = Math.round((value / 100) * totalBlocks);
    const blockW = (w - (totalBlocks - 1) * 3) / totalBlocks;

    for (let i = 0; i < totalBlocks; i++) {
      ctx.fillStyle = i < activeBlocks ? '#10b981' : '#062612';
      ctx.fillRect(x + i * (blockW + 3), y + 8, blockW, 12);
    }
  }

  private static drawPixelComputer(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#34d399';
    // Draw 8-bit monitor icon
    ctx.fillRect(x, y, 40, 30);
    ctx.fillStyle = '#0f1d14';
    ctx.fillRect(x + 4, y + 4, 32, 22);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(x + 16, y + 30, 8, 6);
    ctx.fillRect(x + 10, y + 36, 20, 4);
  }

  private static drawWeatherCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    val: string
  ) {
    ctx.fillStyle = '#0f172a';
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '10px "Outfit", sans-serif';
    ctx.fillText(label, x + 12, y + 20);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px "Outfit", sans-serif';
    ctx.fillText(val, x + 12, y + 42);
  }

  private static drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  private static applyDithering(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    // Simple Floyd-Steinberg error diffusion approximation
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const oldR = d[i];
        const oldG = d[i + 1];
        const oldB = d[i + 2];

        // Quantize to 4 levels per channel
        const newR = Math.round(oldR / 85) * 85;
        const newG = Math.round(oldG / 85) * 85;
        const newB = Math.round(oldB / 85) * 85;

        d[i] = newR;
        d[i + 1] = newG;
        d[i + 2] = newB;

        const errR = oldR - newR;
        const errG = oldG - newG;
        const errB = oldB - newB;

        if (x + 1 < w) {
          const next = i + 4;
          d[next] = Math.min(255, Math.max(0, d[next] + (errR * 7) / 16));
          d[next + 1] = Math.min(255, Math.max(0, d[next + 1] + (errG * 7) / 16));
          d[next + 2] = Math.min(255, Math.max(0, d[next + 2] + (errB * 7) / 16));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  /**
   * Hardware Calibration Test Patterns
   */
  private static renderTestPattern(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    pattern: string,
    isPortrait: boolean
  ) {
    if (pattern === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    } else if (pattern === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    } else if (pattern === 'red') {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, width, height);
    } else if (pattern === 'green') {
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(0, 0, width, height);
    } else if (pattern === 'blue') {
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(0, 0, width, height);
    } else if (pattern === 'color_bars') {
      const colors = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff', '#000000'];
      const barW = width / colors.length;
      for (let i = 0; i < colors.length; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(i * barW, 0, barW + 1, height - 44);
      }
      // Bottom test banner
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, height - 44, width, 44);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`TEST BARRAS: ${width}x${height} (${isPortrait ? 'PORTRAIT' : 'LANDSCAPE'})`, width / 2, height - 20);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px monospace';
      ctx.fillText('Blanco · Amarillo · Cian · Verde · Magenta · Rojo · Azul · Negro', width / 2, height - 6);
    } else if (pattern === 'grid') {
      // Dark slate background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // 20px grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Outer frame in bright gold
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);

      // Diagnostic center box
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      const boxW = Math.min(260, width - 20);
      const boxH = 90;
      const boxX = (width - boxW) / 2;
      const boxY = (height - boxH) / 2;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`20PX GRID ALIGNMENT · ${width}x${height}`, width / 2, boxY + 24);

      ctx.fillStyle = '#10b981';
      ctx.font = '11px monospace';
      ctx.fillText(`Mode: ${isPortrait ? '320x480 (Portrait)' : '480x320 (Landscape)'}`, width / 2, boxY + 44);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText('If you see diagonal tearing or drift, check Little-Endian', width / 2, boxY + 62);
      ctx.fillText('and verify 1L scanline alignment.', width / 2, boxY + 76);
    }
  }
}
