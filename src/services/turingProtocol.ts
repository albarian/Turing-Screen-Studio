/**
 * Turing & XuanFang Smart Screen 3.5" Multi-Protocol Driver
 * Reverse-Engineered based on mathoudebine / gerph / stalskol / Turzx specs.
 * Supports:
 *  - XuanFang 3.5" Revision B & Flagship (10-byte Framed Protocol, RGB565 Big-Endian, 0xCA-0xCE)
 *  - Turing 3.5" Revision A & Turzx Official (6-byte Bitpacked, 16-byte Orientation, RGB565 Little-Endian)
 *  - Raw RGB565 Framebuffer Streaming
 */

import { ScreenConfig } from '../types/screen';

// Revision A Opcodes (6-byte header, 16-byte orientation)
export enum TuringCommandRevA {
  RESET = 101,
  CLEAR = 102,
  TO_BLACK = 103,
  SCREEN_OFF = 108,
  SCREEN_ON = 109,
  SET_BRIGHTNESS = 110,
  SET_ORIENTATION = 121,
  DISPLAY_BITMAP = 197, // 0xC5
  HELLO = 69,
}

// Revision B Opcodes (10-byte framed: [cmd, payload[0..7], cmd])
export enum TuringCommandRevB {
  HELLO = 0xca,           // 202 - Handshake: payload ['H','E','L','L','O', 0, 0, 0]
  SET_ORIENTATION = 0xcb, // 203 - Orientation: payload [0x00=Portrait, 0x01=Landscape]
  DISPLAY_BITMAP = 0xcc,  // 204 - Render: payload [x0_h, x0_l, y0_h, y0_l, x1_h, x1_l, y1_h, y1_l]
  SET_LIGHTING = 0xcd,    // 205 - Backplate RGB LED: payload [r, g, b]
  SET_BRIGHTNESS = 0xce,  // 206 - Backlight: payload [0-255]
}

export enum ScreenOrientation {
  PORTRAIT = 0,          // 320 x 480
  REVERSE_PORTRAIT = 1,  // 320 x 480 inverted
  LANDSCAPE = 2,         // 480 x 320 (Turing Rev A firmware: opcode 2 for 480x320)
  REVERSE_LANDSCAPE = 3, // 480 x 320 inverted
}

export interface UsbDeviceInfo {
  vendorId?: string;
  productId?: string;
  chipName?: string;
  detectedRevision?: 'rev_a' | 'rev_b' | 'unknown';
}

export class TuringSerialDriver {
  private port: any = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private isConnected = false;
  private isSending = false;
  private baudRate = 115200;
  private transport: 'webserial' | 'bridge' = 'webserial';
  public isIframePolicyBlocked = false;
  public usbInfo: UsbDeviceInfo = {};
  private lastSyncedOrientation: number | null = null;
  private lastSyncedDimensions = { width: 0, height: 0 };
  private activeProtocol: 'turing_standard' | 'xuanfang_rev_b' | 'raw_stream' = 'turing_standard';
  private pendingBrightness: number | null = null;
  private lastFrameFinishTime = 0;

  private onStatusChange?: (connected: boolean, message: string, transport: 'webserial' | 'bridge') => void;
  private onLog?: (log: string) => void;

  constructor(
    onStatusChange?: (connected: boolean, message: string, transport: 'webserial' | 'bridge') => void,
    onLog?: (log: string) => void
  ) {
    this.onStatusChange = onStatusChange;
    this.onLog = onLog;
  }

  public isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsSending(): boolean {
    return this.isSending;
  }

  public getLastFrameFinishTime(): number {
    return this.lastFrameFinishTime;
  }

  public getTransport(): 'webserial' | 'bridge' {
    return this.transport;
  }

  public getBaudRate(): number {
    return this.baudRate;
  }

  public setProtocol(protocol: 'turing_standard' | 'xuanfang_rev_b' | 'raw_stream') {
    this.activeProtocol = protocol;
    this.lastSyncedOrientation = null;
  }

  private log(message: string) {
    if (this.onLog) {
      this.onLog(`[${new Date().toLocaleTimeString()}] ${message}`);
    }
  }

  /**
   * Request user to select the USB Serial COM port and connect via Web Serial API.
   * Uses a large 128KB buffer to prevent OS serial driver FIFO overflow/dropped bytes.
   */
  public async connect(baudRate: number = 115200, preferredProtocol?: 'turing_standard' | 'xuanfang_rev_b'): Promise<boolean> {
    if (!this.isWebSerialSupported()) {
      const msg = 'Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.';
      this.log(msg);
      this.onStatusChange?.(false, msg, 'webserial');
      return false;
    }

    try {
      this.log('Requesting USB port selection dialog...');
      this.port = await (navigator as any).serial.requestPort({
        filters: [
          { usbVendorId: 0x1a86 }, // WCH CH340 / CH341 / CH552 (Turing & clones)
          { usbVendorId: 0x10c4 }, // Silicon Labs CP210x
          { usbVendorId: 0x0403 }, // FTDI
          { usbVendorId: 0x303a }, // Espressif
          { usbVendorId: 0x2e8a }, // RP2040
        ],
      });

      // Extract device info
      const info = this.port.getInfo?.() || {};
      const vid = info.usbVendorId ? '0x' + info.usbVendorId.toString(16).toUpperCase() : 'Unknown';
      const pid = info.usbProductId ? '0x' + info.usbProductId.toString(16).toUpperCase() : 'Unknown';

      let chip = 'Generic USB-Serial';
      if (info.usbVendorId === 0x1a86) chip = 'WCH CH340 / CH552 (3.5" IPS)';
      else if (info.usbVendorId === 0x10c4) chip = 'Silicon Labs CP2102';
      else if (info.usbVendorId === 0x0403) chip = 'FTDI FT232R';

      this.usbInfo = { vendorId: vid, productId: pid, chipName: chip };
      this.log(`USB device detected: VID=${vid}, PID=${pid} (${chip})`);

      this.baudRate = baudRate;
      // CRITICAL FIX: bufferSize 131072 (128 KB) prevents OS UART buffer overflow on Windows & macOS!
      await this.port.open({
        baudRate: this.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
        bufferSize: 131072,
      });

      this.writer = this.port.writable.getWriter();
      this.isConnected = true;
      this.transport = 'webserial';
      this.isIframePolicyBlocked = false;
      this.lastSyncedOrientation = null;
      if (preferredProtocol) this.activeProtocol = preferredProtocol;

      // Start asynchronous background reader to receive hardware replies/state
      this.startReadingLoop();

      this.log(`Connected via Web Serial at ${this.baudRate} bps with 128KB buffer and bidirectional reader.`);
      this.onStatusChange?.(true, `Connected: ${chip} @ ${this.baudRate} bps`, 'webserial');

      // Handshake activation (HELLO + SCREEN_ON) to wake ST7796/ILI9488 controller from standby
      if (this.activeProtocol === 'turing_standard' && this.writer) {
        const hello6 = new Uint8Array([69, 69, 69, 69, 69, 69]);
        await this.writer.write(hello6);
        await new Promise((r) => setTimeout(r, 40));

        const screenOn = this.createRevACommand(TuringCommandRevA.SCREEN_ON, 0, 0, 0, 0);
        await this.writer.write(screenOn);
        await new Promise((r) => setTimeout(r, 40));
      }

      // Initialize default orientation and backlight
      await this.setOrientation(ScreenOrientation.PORTRAIT, 320, 480);
      await this.setBrightness(85);
      return true;
    } catch (err: any) {
      const errStr = String(err.message || err);
      if (errStr.includes('permissions policy') || errStr.includes('disallowed')) {
        this.isIframePolicyBlocked = true;
        this.log('Notice: Browser blocked Web Serial because the app is running inside an iframe. Open the app in a standalone tab or use Local Python Bridge.');
        this.onStatusChange?.(false, 'Blocked by iframe permissions policy. Open in a standalone tab or run Local Bridge.', 'webserial');
      } else {
        this.log(`Connection error: ${errStr}`);
        this.onStatusChange?.(false, errStr, 'webserial');
      }
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Connect to Local Python HTTP Bridge (localhost:8989)
   */
  public async connectBridge(): Promise<boolean> {
    this.log('Testing connection with Local Bridge (http://127.0.0.1:8989/status)...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch('http://127.0.0.1:8989/status', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        this.isConnected = true;
        this.transport = 'bridge';
        this.usbInfo = {
          vendorId: data.vid || 'USB',
          productId: data.pid || 'Bridge',
          chipName: data.port || 'COM/USB',
        };
        this.log(`Connected to Local Bridge on port: ${data.port || 'USB'}`);
        this.onStatusChange?.(true, `Connected via Local Bridge (127.0.0.1:8989)`, 'bridge');
        return true;
      } else {
        throw new Error(`HTTP Response ${res.status}`);
      }
    } catch (err: any) {
      this.isConnected = false;
      this.log('Could not connect to http://127.0.0.1:8989. Make sure to run: python turing_bridge.py');
      this.onStatusChange?.(false, 'Local Bridge not detected on port 8989', 'bridge');
      return false;
    }
  }

  /**
   * Disconnect
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.writer) {
        await this.writer.close();
        this.writer.releaseLock();
        this.writer = null;
      }
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
      this.isConnected = false;
      this.lastSyncedOrientation = null;
      this.log('Screen disconnected.');
      this.onStatusChange?.(false, 'Disconnected', this.transport);
    } catch (err: any) {
      this.log(`Error disconnecting: ${err.message || err}`);
    }
  }

  public lastHardwareResponse = '';

  /**
   * Continuous background reader for incoming bytes from the screen (status queries, HELLO ACKs).
   */
  private async startReadingLoop(): Promise<void> {
    if (!this.port || !this.port.readable) return;
    try {
      this.reader = this.port.readable.getReader();
      this.log('Listening to incoming USB hardware return channel...');
      while (this.isConnected && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value && value.length > 0) {
          const hex = Array.from(value)
            .map((b) => '0x' + b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
          const ascii = Array.from(value)
            .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
            .join('');
          this.lastHardwareResponse = `[${hex}] ("${ascii}")`;
          this.log(`← Hardware replied (${value.length} B): [${hex}] "${ascii}"`);
        }
      }
    } catch (err: any) {
      if (this.isConnected) {
        this.log(`Serial reader notice: ${err.message || err}`);
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch (_) {}
        this.reader = null;
      }
    }
  }

  // ==========================================
  // PROTOCOL 1: XUANFANG REVISION B (10-byte Framed)
  // Used by AliExpress 3.5" IPS, ExtendScreen, UsbPCMonitor, Q002_V2.0 boards
  // ==========================================

  /**
   * Builds a 10-byte framed command packet for Revision B
   * Format: [cmd, payload[0..7], cmd]
   */
  public createRevBCommand(cmd: TuringCommandRevB | number, payload: number[] = []): Uint8Array {
    const buffer = new Uint8Array(10);
    buffer[0] = cmd & 0xff;
    for (let i = 0; i < 8; i++) {
      buffer[i + 1] = (payload[i] || 0) & 0xff;
    }
    buffer[9] = cmd & 0xff;
    return buffer;
  }

  /**
   * Builds Rev B DISPLAY_BITMAP header (0xCC) with 16-bit bounding box coordinates
   */
  public createRevBBitmapHeader(x0: number, y0: number, x1: number, y1: number): Uint8Array {
    return this.createRevBCommand(TuringCommandRevB.DISPLAY_BITMAP, [
      (x0 >> 8) & 0xff,
      x0 & 0xff,
      (y0 >> 8) & 0xff,
      y0 & 0xff,
      (x1 >> 8) & 0xff,
      x1 & 0xff,
      (y1 >> 8) & 0xff,
      y1 & 0xff,
    ]);
  }

  // ==========================================
  // PROTOCOL 2: TURING REVISION A (6-byte Packed)
  // Used by official Turing 3.5" Smart Screen & Turzx Rev A
  // ==========================================

  /**
   * Build 6-byte packed command packet for Turing Rev A
   */
  public createRevACommand(cmd: TuringCommandRevA | number, x = 0, y = 0, ex = 0, ey = 0): Uint8Array {
    const buffer = new Uint8Array(6);
    buffer[0] = (x >> 2) & 0xff;
    buffer[1] = (((x & 3) << 6) + (y >> 4)) & 0xff;
    buffer[2] = (((y & 15) << 4) + (ex >> 6)) & 0xff;
    buffer[3] = (((ex & 63) << 2) + (ey >> 8)) & 0xff;
    buffer[4] = ey & 0xff;
    buffer[5] = cmd & 0xff;
    return buffer;
  }

  /**
   * Build 16-byte Hardware Orientation packet for Turing Rev A
   */
  public createRevAOrientationPacket(orientation: number, width: number, height: number): Uint8Array {
    const buffer = new Uint8Array(16);
    buffer[0] = 0;
    buffer[1] = 0;
    buffer[2] = 0;
    buffer[3] = 0;
    buffer[4] = 0;
    buffer[5] = TuringCommandRevA.SET_ORIENTATION; // 121
    buffer[6] = (orientation + 100) & 0xff;
    buffer[7] = (width >> 8) & 0xff;
    buffer[8] = width & 0xff;
    buffer[9] = (height >> 8) & 0xff;
    buffer[10] = height & 0xff;
    return buffer;
  }

  // ==========================================
  // HARDWARE CONTROL METHODS (Multi-Protocol)
  // ==========================================

  /**
   * Hardware Reset
   * Rev A: Sends opcode 101.
   * Rev B: Streams a clear frame (Rev B firmware has no native reset opcode).
   */
  public async reset(): Promise<void> {
    if (!this.isConnected) return;
    try {
      this.log('Executing Reset command...');
      if (this.transport === 'bridge') {
        await fetch('http://127.0.0.1:8989/cmd', { method: 'POST', body: 'reset' });
      } else {
        if (this.activeProtocol === 'xuanfang_rev_b') {
          // XuanFang Rev B: clear display with blank image
          await this.clear();
        } else {
          // Turing Rev A: opcode 101
          const packet = this.createRevACommand(TuringCommandRevA.RESET, 0, 0, 0, 0);
          if (this.writer) await this.writer.write(packet);
        }
      }
      this.lastSyncedOrientation = null;
      this.log('Reset command completed.');
    } catch (e: any) {
      this.log(`Failed to reset: ${e.message}`);
    }
  }

  /**
   * Clear screen to pure white
   */
  public async clear(): Promise<void> {
    if (!this.isConnected) return;
    try {
      this.log('Clearing screen to white...');
      if (this.transport === 'bridge') {
        await fetch('http://127.0.0.1:8989/cmd', { method: 'POST', body: 'clear' });
      } else if (this.writer) {
        if (this.activeProtocol === 'xuanfang_rev_b') {
          // XuanFang Rev B: send 0xCB orientation then stream white frame (Big Endian RGB565: 0xFF, 0xFF)
          const orientPkt = this.createRevBCommand(TuringCommandRevB.SET_ORIENTATION, [0x00]);
          await this.writer.write(orientPkt);
          const header = this.createRevBBitmapHeader(0, 0, 319, 479);
          await this.writer.write(header);
          const whitePixels = new Uint8Array(320 * 480 * 2);
          whitePixels.fill(0xff);
          await this.writer.write(whitePixels);
          await new Promise((r) => setTimeout(r, 50));
        } else {
          // Turing Rev A
          const pPacket = this.createRevAOrientationPacket(ScreenOrientation.PORTRAIT, 320, 480);
          await this.writer.write(pPacket);
          await new Promise((r) => setTimeout(r, 10));
          const clearPacket = this.createRevACommand(TuringCommandRevA.CLEAR, 0, 0, 0, 0);
          await this.writer.write(clearPacket);
        }
      }
      this.log('Screen cleared to white.');
    } catch (e: any) {
      this.log(`Failed to clear screen: ${e.message}`);
    }
  }

  /**
   * Turn screen black
   */
  public async toBlack(): Promise<void> {
    if (!this.isConnected) return;
    try {
      this.log('Blanking screen to black...');
      if (this.transport === 'bridge') {
        await fetch('http://127.0.0.1:8989/cmd', { method: 'POST', body: 'black' });
      } else if (this.writer) {
        if (this.activeProtocol === 'xuanfang_rev_b') {
          const orientPkt = this.createRevBCommand(TuringCommandRevB.SET_ORIENTATION, [0x00]);
          await this.writer.write(orientPkt);
          const header = this.createRevBBitmapHeader(0, 0, 319, 479);
          await this.writer.write(header);
          const blackPixels = new Uint8Array(320 * 480 * 2);
          blackPixels.fill(0x00);
          await this.writer.write(blackPixels);
          await new Promise((r) => setTimeout(r, 50));
        } else {
          const packet = this.createRevACommand(TuringCommandRevA.TO_BLACK, 0, 0, 0, 0);
          await this.writer.write(packet);
        }
      }
      this.log('Screen blanked to black.');
    } catch (e: any) {
      this.log(`Failed to blank screen: ${e.message}`);
    }
  }

  /**
   * Set backlight brightness (0-100%)
   * Queues brightness change to be applied atomically at frame boundaries to prevent horizontal pixel shifting!
   */
  public async setBrightness(level: number): Promise<void> {
    if (!this.isConnected) return;
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    this.pendingBrightness = clamped;

    if (this.transport === 'bridge') {
      try {
        await fetch('http://127.0.0.1:8989/cmd', {
          method: 'POST',
          body: `brightness:${clamped}`,
        });
      } catch (e: any) {
        this.log(`Error enviando brillo por puente: ${e.message}`);
      }
      return;
    }

    // If not currently transmitting a frame, flush immediately without waiting
    if (!this.isSending) {
      await this.flushPendingBrightness();
    }
  }

  /**
   * Flushes any pending brightness command safely outside the pixel payload stream
   */
  public async flushPendingBrightness(): Promise<void> {
    if (this.pendingBrightness === null || !this.writer) return;
    const clamped = this.pendingBrightness;
    this.pendingBrightness = null;

    try {
      this.log(`Applying brightness to ${clamped}%...`);
      if (this.activeProtocol === 'xuanfang_rev_b') {
        const val = Math.round((clamped / 100) * 255);
        const pkt = this.createRevBCommand(TuringCommandRevB.SET_BRIGHTNESS, [val]);
        await this.writer.write(pkt);
      } else {
        // Turing Rev A: inverted scale 0 (bright) - 255 (dark)
        const levelAbsolute = Math.round(255 - (clamped / 100) * 255);
        const packet = this.createRevACommand(TuringCommandRevA.SET_BRIGHTNESS, levelAbsolute, 0, 0, 0);
        await this.writer.write(packet);
      }
    } catch (e: any) {
      this.log(`Brightness flush error: ${e.message}`);
    }
  }

  /**
   * Set hardware orientation
   */
  public async setOrientation(
    orientation: ScreenOrientation,
    width = 320,
    height = 480
  ): Promise<void> {
    if (!this.isConnected) return;
    try {
      this.log(
        `Setting orientation: ${ScreenOrientation[orientation]} (${orientation}) [${this.activeProtocol}]...`
      );
      if (this.transport === 'bridge') {
        await fetch('http://127.0.0.1:8989/cmd', {
          method: 'POST',
          body: `orientation:${orientation},${width},${height}`,
        });
      } else if (this.writer) {
        if (this.activeProtocol === 'xuanfang_rev_b') {
          // Rev B: 0xCB with [0x00] for Portrait, [0x01] for Landscape
          const orientCode = orientation === ScreenOrientation.PORTRAIT || orientation === ScreenOrientation.REVERSE_PORTRAIT ? 0x00 : 0x01;
          const pkt = this.createRevBCommand(TuringCommandRevB.SET_ORIENTATION, [orientCode]);
          await this.writer.write(pkt);
        } else {
          // Rev A: 16-byte packet
          const packet = this.createRevAOrientationPacket(orientation, width, height);
          await this.writer.write(packet);
        }
      }
      this.lastSyncedOrientation = orientation;
      this.lastSyncedDimensions = { width, height };
    } catch (e: any) {
      this.log(`Error changing orientation: ${e.message}`);
    }
  }

  /**
   * Ping screen with HELLO probe to identify hardware model
   * Rev B: 0xCA ['H','E','L','L','O']
   * Rev A: 69
   */
  public async pingHello(): Promise<string> {
    if (!this.isConnected) return 'Not connected';
    try {
      this.log('Sending HELLO identification probe...');
      if (this.writer) {
        // 1. Turing Rev A official handshake: 6 bytes of HELLO (69 = 0x45)
        const revAHello6 = new Uint8Array([69, 69, 69, 69, 69, 69]);
        await this.writer.write(revAHello6);

        // 2. Turing Rev A packed format HELLO
        const revAPacked = this.createRevACommand(TuringCommandRevA.HELLO, 0, 0, 0, 0);
        await this.writer.write(revAPacked);

        // 3. XuanFang Rev B HELLO (0xCA ['H','E','L','L','O'])
        const revBHello = this.createRevBCommand(TuringCommandRevB.HELLO, [
          'H'.charCodeAt(0),
          'E'.charCodeAt(0),
          'L'.charCodeAt(0),
          'L'.charCodeAt(0),
          'O'.charCodeAt(0),
        ]);
        await this.writer.write(revBHello);

        await new Promise((r) => setTimeout(r, 80));
      }

      if (this.lastHardwareResponse) {
        this.log(`Hardware response detected: ${this.lastHardwareResponse}`);
        return this.lastHardwareResponse;
      }
      this.log('HELLO identification probes sent. Listener channel is active.');
      return 'Probes sent';
    } catch (e: any) {
      const err = `Error in HELLO: ${e.message}`;
      this.log(err);
      return err;
    }
  }

  /**
   * Converts Canvas pixels to RGB565 with selectable Endianness and Color Order
   */
  public canvasToRgb565(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    endianness: 'little' | 'big' = 'little',
    colorOrder: 'rgb' | 'bgr' = 'rgb'
  ): Uint8Array {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('No se pudo obtener el contexto 2D');

    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    const totalPixels = width * height;
    const raw = new Uint8Array(totalPixels * 2);

    let byteIdx = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const redVal = colorOrder === 'rgb' ? pixels[i] : pixels[i + 2];
      const greenVal = pixels[i + 1];
      const blueVal = colorOrder === 'rgb' ? pixels[i + 2] : pixels[i];

      // 16-bit RGB565 (5 bits red, 6 bits green, 5 bits blue)
      const rgb = ((redVal & 0xf8) << 8) | ((greenVal & 0xfc) << 3) | (blueVal >> 3);

      if (endianness === 'little') {
        // Little Endian: LSB first, then MSB (Turing Rev A)
        raw[byteIdx++] = rgb & 0xff;
        raw[byteIdx++] = (rgb >> 8) & 0xff;
      } else {
        // Big Endian: MSB first, then LSB (XuanFang Rev B)
        raw[byteIdx++] = (rgb >> 8) & 0xff;
        raw[byteIdx++] = rgb & 0xff;
      }
    }

    return raw;
  }

  /**
   * Send a complete HTML5 Canvas frame to the 3.5" display with precision scanline pacing.
   * Seamlessly switches between XuanFang Rev B (10-byte) and Turing Rev A (6-byte).
   */
  public async sendCanvasFrame(
    canvas: HTMLCanvasElement,
    config: ScreenConfig
  ): Promise<boolean> {
    if (!this.isConnected || this.isSending) {
      return false;
    }

    this.isSending = true;
    try {
      this.activeProtocol = config.protocol;
      const isPortrait = config.orientation === 'portrait';
      const width = isPortrait ? 320 : 480;
      const height = isPortrait ? 480 : 320;
      const orientationVal = isPortrait ? ScreenOrientation.PORTRAIT : ScreenOrientation.LANDSCAPE;

      // Rev B defaults to Big Endian; Rev A defaults to Little Endian
      const effectiveEndianness =
        config.endianness || (config.protocol === 'xuanfang_rev_b' ? 'big' : 'little');

      const rgb565Bytes = this.canvasToRgb565(
        canvas,
        width,
        height,
        effectiveEndianness,
        config.colorOrder
      );

      // If running via Local HTTP Bridge
      if (this.transport === 'bridge') {
        const res = await fetch('http://127.0.0.1:8989/frame', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Orientation': config.orientation,
            'X-Endianness': effectiveEndianness,
            'X-Protocol': config.protocol || 'xuanfang_rev_b',
          },
          body: rgb565Bytes as any,
        });
        return res.ok;
      }

      // If running via native Web Serial
      if (!this.writer) return false;

      // 0. Safely flush pending brightness at frame boundary (never mid-stream)
      if (this.pendingBrightness !== null) {
        await this.flushPendingBrightness();
      }

      // 1. Sync Hardware Orientation if needed
      if (
        this.lastSyncedOrientation !== orientationVal ||
        this.lastSyncedDimensions.width !== width ||
        this.lastSyncedDimensions.height !== height
      ) {
        if (config.protocol === 'xuanfang_rev_b') {
          const orientCode = isPortrait ? 0x00 : 0x01;
          const orientPkt = this.createRevBCommand(TuringCommandRevB.SET_ORIENTATION, [orientCode]);
          await this.writer.write(orientPkt);
          await new Promise((r) => setTimeout(r, 10));
        } else if (config.protocol === 'turing_standard') {
          const orientationPacket = this.createRevAOrientationPacket(orientationVal, width, height);
          await this.writer.write(orientationPacket);
          await new Promise((r) => setTimeout(r, 10));
        }
        this.lastSyncedOrientation = orientationVal;
        this.lastSyncedDimensions = { width, height };
      }

      // 2. Prepare Bitmap Header
      let header: Uint8Array;
      if (config.protocol === 'xuanfang_rev_b') {
        // XuanFang Rev B: 10-byte header 0xCC with exact 16-bit bounding box
        header = this.createRevBBitmapHeader(0, 0, width - 1, height - 1);
      } else {
        // Turing Rev A: 6-byte header 197 with bit-packed coordinates
        header = this.createRevACommand(
          TuringCommandRevA.DISPLAY_BITMAP,
          0,
          0,
          width - 1,
          height - 1
        );
      }

      // 3. Transmit payload
      const bytesPerLine = width * 2;
      const mode = config.transmissionMode || 'monolithic_block';

      if (mode === 'monolithic_block') {
        // Mode 3: Unified Monolithic Burst (Header + 307.200 bytes in ONE single contiguous Uint8Array)
        // Eliminates any microtask gap, short USB packet or timing separation between header and pixels.
        const unified = new Uint8Array(header.length + rgb565Bytes.length);
        unified.set(header, 0);
        unified.set(rgb565Bytes, header.length);
        await this.writer.write(unified);
        await new Promise((resolve) => setTimeout(resolve, 60));
      } else if (mode === 'single_line_direct') {
        // Mode 2: Strict line-by-line (640 bytes/packet), zero delay between header and lines
        await this.writer.write(header);
        for (let offset = 0; offset < rgb565Bytes.length; offset += bytesPerLine) {
          const chunk = rgb565Bytes.subarray(offset, offset + bytesPerLine);
          await this.writer.write(chunk);
        }
        await new Promise((resolve) => setTimeout(resolve, 60));
      } else {
        // Mode 1: Safety Cooldown (Line by line with optional pacing and 60ms post-frame cooldown)
        await this.writer.write(header);
        const linesPerChunk = Math.max(1, config.linesPerChunk || 1);
        const chunkSize = bytesPerLine * linesPerChunk;
        const pacingMs = config.chunkPacingMs ?? 0;

        for (let offset = 0; offset < rgb565Bytes.length; offset += chunkSize) {
          const end = Math.min(offset + chunkSize, rgb565Bytes.length);
          const chunk = rgb565Bytes.subarray(offset, end);
          await this.writer.write(chunk);

          if (pacingMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, pacingMs));
          }
        }

        // Guaranteed 60ms safety cooldown at frame boundary
        await new Promise((resolve) => setTimeout(resolve, 60));
      }

      // 4. Additional cooldown delay for XuanFang Rev B if active
      if (config.protocol === 'xuanfang_rev_b') {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      return true;
    } catch (err: any) {
      this.log(`Error sending frame to screen: ${err.message || err}`);
      return false;
    } finally {
      this.isSending = false;
      this.lastFrameFinishTime = performance.now();
    }
  }
}
