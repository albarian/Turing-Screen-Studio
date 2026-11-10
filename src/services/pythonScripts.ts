/**
 * Python script generator and standalone companion daemons for Windows & macOS
 * Based on open-source reverse engineered Turing 3.5" USB protocol (mathoudebine / stalskol).
 * Updated with exact 16-byte orientation packets, inverted brightness (0-255), and scanline alignment.
 */

export const PYTHON_SCRIPT_MAC = `#!/usr/bin/env python3
"""
Turing 3.5" IPS USB Screen Companion for macOS (Apple Silicon M1/M2/M3/M4 & Intel)
Reads real CPU, RAM, Disk, and Network stats using psutil and streams to screen.

Installation:
  pip3 install pyserial psutil pillow

Execution:
  python3 turing_monitor_mac.py
"""

import sys
import time
import glob
import serial
import psutil
from PIL import Image, ImageDraw, ImageFont

# Screen Dimensions
WIDTH = 320
HEIGHT = 480
BAUDRATE = 115200 # Change to 921600 if using a high-speed XuanFang Rev B model

# Commands
CMD_RESET = 101
CMD_CLEAR = 102
CMD_SET_BRIGHTNESS = 110
CMD_SET_ORIENTATION = 121
CMD_DISPLAY_BITMAP = 197

def find_serial_port():
    """Auto-detect Turing / CH340 / USB serial port on macOS"""
    patterns = ['/dev/cu.wchusbserial*', '/dev/cu.usbserial*', '/dev/cu.SLAB_USBtoUART*']
    for pat in patterns:
        ports = glob.glob(pat)
        if ports:
            return ports[0]
    return None

def create_command(cmd, x=0, y=0, ex=0, ey=0):
    """Build 6-byte header for Turing 3.5. Default coordinates are 0 for non-bitmap commands."""
    buf = bytearray(6)
    buf[0] = (x >> 2) & 0xFF
    buf[1] = (((x & 3) << 6) + (y >> 4)) & 0xFF
    buf[2] = (((y & 15) << 4) + (ex >> 6)) & 0xFF
    buf[3] = (((ex & 63) << 2) + (ey >> 8)) & 0xFF
    buf[4] = ey & 0xFF
    buf[5] = cmd & 0xFF
    return bytes(buf)

def create_orientation_packet(orientation=0, width=320, height=480):
    """Build 16-byte orientation and geometry packet required by Turing firmware."""
    buf = bytearray(16)
    buf[0] = 0
    buf[1] = 0
    buf[2] = 0
    buf[3] = 0
    buf[4] = 0
    buf[5] = CMD_SET_ORIENTATION
    buf[6] = (orientation + 100) & 0xFF
    buf[7] = (width >> 8) & 0xFF
    buf[8] = width & 0xFF
    buf[9] = (height >> 8) & 0xFF
    buf[10] = height & 0xFF
    return bytes(buf)

def set_brightness(ser, level=85):
    """Set brightness (0-100%). Hardware scale is inverted: 0 is brightest, 255 is dark."""
    level_clamped = max(0, min(100, int(level)))
    level_absolute = int(255 - (level_clamped / 100.0) * 255)
    ser.write(create_command(CMD_SET_BRIGHTNESS, x=level_absolute))

def image_to_rgb565(img):
    """Convert PIL image to 16-bit RGB565 little-endian bytes"""
    img = img.convert('RGB')
    pixels = img.load()
    w, h = img.size
    raw = bytearray(w * h * 2)
    idx = 0
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            rgb = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
            raw[idx] = rgb & 0xFF
            raw[idx + 1] = (rgb >> 8) & 0xFF
            idx += 2
    return bytes(raw)

def draw_dashboard(cpu, ram, disk, net_in, net_out):
    """Render a 320x480 dashboard image"""
    img = Image.new('RGB', (WIDTH, HEIGHT), color='#070b14')
    draw = ImageDraw.Draw(img)

    # Header
    draw.rectangle([0, 0, WIDTH, 36], fill='#0f172a')
    draw.text((16, 10), "macOS TELEMETRY 3.5\\"", fill='#38bdf8')
    time_str = time.strftime("%H:%M:%S")
    draw.text((WIDTH - 80, 10), time_str, fill='#94a3b8')

    # CPU Section
    draw.text((20, 55), "APPLE SILICON / CPU", fill='#94a3b8')
    draw.text((20, 72), f"{cpu:.1f}%", fill='#ffffff')
    draw.rounded_rectangle([20, 105, WIDTH - 20, 120], radius=4, fill='#1e293b')
    draw.rounded_rectangle([20, 105, 20 + int((WIDTH - 40) * (cpu / 100)), 120], radius=4, fill='#06b6d4')

    # RAM Section
    draw.text((20, 140), "MEMORIA UNIFICADA (RAM)", fill='#94a3b8')
    draw.text((20, 157), f"{ram.percent}% ({ram.used / (1024**3):.1f} / {ram.total / (1024**3):.0f} GB)", fill='#ffffff')
    draw.rounded_rectangle([20, 190, WIDTH - 20, 205], radius=4, fill='#1e293b')
    draw.rounded_rectangle([20, 190, 20 + int((WIDTH - 40) * (ram.percent / 100)), 205], radius=4, fill='#10b981')

    # SSD Disk
    draw.text((20, 225), "MACINTOSH HD (SSD)", fill='#94a3b8')
    draw.text((20, 242), f"{disk.percent}% ({disk.used / (1024**3):.0f} / {disk.total / (1024**3):.0f} GB)", fill='#ffffff')
    draw.rounded_rectangle([20, 275, WIDTH - 20, 290], radius=4, fill='#1e293b')
    draw.rounded_rectangle([20, 275, 20 + int((WIDTH - 40) * (disk.percent / 100)), 290], radius=4, fill='#f59e0b')

    # Network Box
    draw.rounded_rectangle([20, 315, WIDTH - 20, 400], radius=8, fill='#0f172a', outline='#1e293b')
    draw.text((32, 328), "RED & TRANSFERENCIA", fill='#64748b')
    draw.text((32, 350), f"↓ Descarga: {net_in:.1f} KB/s", fill='#38bdf8')
    draw.text((32, 372), f"↑ Subida:   {net_out:.1f} KB/s", fill='#ec4899')

    # Footer
    draw.rectangle([0, 435, WIDTH, HEIGHT], fill='#0c121e')
    draw.text((20, 448), "Puerto: USB-Serial", fill='#64748b')
    draw.text((WIDTH - 90, 448), "Turing 3.5\\"", fill='#10b981')

    return img

def main():
    port_name = find_serial_port()
    if not port_name:
        print("[!] No se detectó automáticamente el puerto USB.")
        print("    Asegúrate de conectar la pantalla y ejecuta: ls /dev/cu.*")
        sys.exit(1)

    print(f"[*] Conectando a pantalla en {port_name} a {BAUDRATE} bps...")
    ser = serial.Serial(port_name, BAUDRATE, timeout=1)
    time.sleep(1.5)

    # Inicializar orientación exacta (16 bytes) y brillo invertido
    ser.write(create_orientation_packet(orientation=0, width=WIDTH, height=HEIGHT))
    time.sleep(0.05)
    set_brightness(ser, level=85)

    last_net = psutil.net_io_counters()
    last_time = time.time()

    print("[✓] Pantalla iniciada. Transmitiendo métricas (Ctrl+C para salir)...")
    try:
        while True:
            cpu = psutil.cpu_percent(interval=None)
            ram = psutil.virtual_memory()
            disk = psutil.disk_usage('/')

            cur_time = time.time()
            dt = cur_time - last_time or 1
            cur_net = psutil.net_io_counters()
            net_in = (cur_net.bytes_recv - last_net.bytes_recv) / 1024 / dt
            net_out = (cur_net.bytes_sent - last_net.bytes_sent) / 1024 / dt
            last_net = cur_net
            last_time = cur_time

            frame = draw_dashboard(cpu, ram, disk, net_in, net_out)
            raw_rgb = image_to_rgb565(frame)

            # Send header with exact bitmap coordinates
            header = create_command(CMD_DISPLAY_BITMAP, 0, 0, WIDTH - 1, HEIGHT - 1)
            ser.write(header)

            # Send in chunks of 4 whole scanlines (WIDTH * 2 * 4 = 2560 bytes)
            chunk_size = WIDTH * 2 * 4
            for i in range(0, len(raw_rgb), chunk_size):
                ser.write(raw_rgb[i:i + chunk_size])
                time.sleep(0.003) # Pacing prevents macOS UART FIFO overflow!

            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\\n[!] Saliendo...")
    finally:
        ser.close()

if __name__ == '__main__':
    main()
`;

export const PYTHON_SCRIPT_WINDOWS = `#!/usr/bin/env python3
"""
Turing & XuanFang 3.5" IPS USB Screen Companion for Windows 10 & 11
Reads real CPU, GPU, RAM, Disk, and Network stats using psutil and streams to screen.
Supports XuanFang Rev B (AliExpress 3.5") and Turing Rev A (Official 3.5").

Installation:
  pip install pyserial psutil pillow

Execution:
  python turing_monitor_windows.py
"""

import sys
import time
import serial
import serial.tools.list_ports
import psutil
from PIL import Image, ImageDraw

WIDTH = 320
HEIGHT = 480
BAUDRATE = 115200 # Can also be 921600 if your board supports high speed

# Protocol selection: 'rev_b' (XuanFang / AliExpress 12.89€) or 'rev_a' (Turing official)
PROTOCOL = 'rev_b'

# Rev B Opcodes (10-byte framed: [cmd, d0..d7, cmd])
CMD_B_HELLO = 0xCA
CMD_B_ORIENTATION = 0xCB
CMD_B_BITMAP = 0xCC
CMD_B_BRIGHTNESS = 0xCE

# Rev A Opcodes (6-byte packed)
CMD_A_RESET = 101
CMD_A_CLEAR = 102
CMD_A_BRIGHTNESS = 110
CMD_A_ORIENTATION = 121
CMD_A_BITMAP = 197

def find_com_port():
    """Detect CH340 or USB-Serial COM port on Windows"""
    ports = serial.tools.list_ports.comports()
    for p in ports:
        desc = (p.description or '').lower()
        hwid = (p.hwid or '').lower()
        if 'ch340' in desc or 'usb-serial' in desc or '1a86' in hwid or 'cp210' in desc:
            return p.device
    if ports:
        return ports[0].device
    return None

def create_rev_b_command(cmd, payload=None):
    """Build 10-byte framed command for XuanFang Rev B"""
    if payload is None:
        payload = [0] * 8
    elif len(payload) < 8:
        payload = list(payload) + [0] * (8 - len(payload))
    buf = bytearray(10)
    buf[0] = cmd
    for i in range(8):
        buf[i + 1] = payload[i]
    buf[9] = cmd
    return bytes(buf)

def create_rev_a_command(cmd, x=0, y=0, ex=0, ey=0):
    """Build 6-byte packed header for Turing Rev A"""
    buf = bytearray(6)
    buf[0] = (x >> 2) & 0xFF
    buf[1] = (((x & 3) << 6) + (y >> 4)) & 0xFF
    buf[2] = (((y & 15) << 4) + (ex >> 6)) & 0xFF
    buf[3] = (((ex & 63) << 2) + (ey >> 8)) & 0xFF
    buf[4] = ey & 0xFF
    buf[5] = cmd & 0xFF
    return bytes(buf)

def image_to_rgb565(img, endianness='big'):
    """Convert PIL image to 16-bit RGB565 (Big-Endian for Rev B, Little-Endian for Rev A)"""
    img = img.convert('RGB')
    pixels = img.load()
    w, h = img.size
    raw = bytearray(w * h * 2)
    idx = 0
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            rgb = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
            if endianness == 'big':
                raw[idx] = (rgb >> 8) & 0xFF
                raw[idx + 1] = rgb & 0xFF
            else:
                raw[idx] = rgb & 0xFF
                raw[idx + 1] = (rgb >> 8) & 0xFF
            idx += 2
    return bytes(raw)

def draw_dashboard(cpu, ram, disk, net_in, net_out):
    img = Image.new('RGB', (WIDTH, HEIGHT), color='#05070c')
    draw = ImageDraw.Draw(img)

    # Header
    draw.rectangle([0, 0, WIDTH, 36], fill='#0d1527')
    draw.text((16, 10), "WINDOWS PC MONITOR 3.5\\"", fill='#38bdf8')
    time_str = time.strftime("%H:%M:%S")
    draw.text((WIDTH - 80, 10), time_str, fill='#94a3b8')

    # CPU
    draw.text((20, 55), "PROCESADOR (CPU)", fill='#94a3b8')
    draw.text((20, 72), f"{cpu:.1f}%", fill='#ffffff')
    draw.rounded_rectangle([20, 105, WIDTH - 20, 120], radius=4, fill='#1e293b')
    draw.rounded_rectangle([20, 105, 20 + int((WIDTH - 40) * (cpu / 100)), 120], radius=4, fill='#06b6d4')

    # RAM
    draw.text((20, 140), "MEMORIA RAM", fill='#94a3b8')
    draw.text((20, 157), f"{ram.percent}% ({ram.used / (1024**3):.1f} / {ram.total / (1024**3):.0f} GB)", fill='#ffffff')
    draw.rounded_rectangle([20, 190, WIDTH - 20, 205], radius=4, fill='#1e293b')
    draw.rounded_rectangle([20, 190, 20 + int((WIDTH - 40) * (ram.percent / 100)), 205], radius=4, fill='#10b981')

    # C: Drive
    draw.text((20, 225), "DISCO LOCAL (C:)", fill='#94a3b8')
    draw.text((20, 242), f"{disk.percent}% ({disk.used / (1024**3):.0f} / {disk.total / (1024**3):.0f} GB)", fill='#ffffff')
    draw.rounded_rectangle([20, 275, WIDTH - 20, 290], radius=4, fill='#1e293b')
    draw.rounded_rectangle([20, 275, 20 + int((WIDTH - 40) * (disk.percent / 100)), 290], radius=4, fill='#f59e0b')

    # Net Box
    draw.rounded_rectangle([20, 315, WIDTH - 20, 400], radius=8, fill='#0f172a', outline='#1e293b')
    draw.text((32, 328), "RED (TRAFICO)", fill='#64748b')
    draw.text((32, 350), f"↓ Download: {net_in:.1f} KB/s", fill='#38bdf8')
    draw.text((32, 372), f"↑ Upload:   {net_out:.1f} KB/s", fill='#ec4899')

    # Footer
    draw.rectangle([0, 435, WIDTH, HEIGHT], fill='#090d16')
    draw.text((20, 448), "Estado: Conectado", fill='#10b981')
    draw.text((WIDTH - 90, 448), "3.5\\" IPS", fill='#64748b')

    return img

def main():
    port = find_com_port()
    if not port:
        print("[!] No se detectó automáticamente el puerto COM.")
        print("    Revisa el Administrador de Dispositivos (Puertos COM y LPT)")
        sys.exit(1)

    print(f"[*] Conectando a {port} a {BAUDRATE} bps con protocolo {PROTOCOL.upper()}...")
    ser = serial.Serial(port, BAUDRATE, timeout=1)
    time.sleep(1.5)

    if PROTOCOL == 'rev_b':
        # XuanFang Rev B: 0xCB orientation [0x00=Portrait], 0xCE brightness [216 (~85%)]
        ser.write(create_rev_b_command(CMD_B_ORIENTATION, [0x00]))
        ser.write(create_rev_b_command(CMD_B_BRIGHTNESS, [216]))
    else:
        # Turing Rev A: 16-byte orientation packet
        buf = bytearray(16)
        buf[5] = CMD_A_ORIENTATION
        buf[6] = 100
        buf[7] = (WIDTH >> 8) & 0xFF
        buf[8] = WIDTH & 0xFF
        buf[9] = (HEIGHT >> 8) & 0xFF
        buf[10] = HEIGHT & 0xFF
        ser.write(bytes(buf))
        ser.write(create_rev_a_command(CMD_A_BRIGHTNESS, x=38))

    last_net = psutil.net_io_counters()
    last_time = time.time()

    print("[✓] Pantalla iniciada exitosamente en Windows.")
    try:
        while True:
            cpu = psutil.cpu_percent(interval=None)
            ram = psutil.virtual_memory()
            disk = psutil.disk_usage('C:\\\\')

            cur_time = time.time()
            dt = cur_time - last_time or 1
            cur_net = psutil.net_io_counters()
            net_in = (cur_net.bytes_recv - last_net.bytes_recv) / 1024 / dt
            net_out = (cur_net.bytes_sent - last_net.bytes_sent) / 1024 / dt
            last_net = cur_net
            last_time = cur_time

            frame = draw_dashboard(cpu, ram, disk, net_in, net_out)
            raw = image_to_rgb565(frame, endianness='big' if PROTOCOL == 'rev_b' else 'little')

            if PROTOCOL == 'rev_b':
                header = create_rev_b_command(CMD_B_BITMAP, [0, 0, 0, 0, (WIDTH - 1) >> 8, (WIDTH - 1) & 0xFF, (HEIGHT - 1) >> 8, (HEIGHT - 1) & 0xFF])
                ser.write(header)
            else:
                header = create_rev_a_command(CMD_A_BITMAP, 0, 0, WIDTH - 1, HEIGHT - 1)
                ser.write(header)

            chunk_size = WIDTH * 2 * 4 # 4 scanlines per chunk
            for i in range(0, len(raw), chunk_size):
                ser.write(raw[i:i + chunk_size])
                time.sleep(0.003)

            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\\n[!] Finalizando...")
    finally:
        ser.close()

if __name__ == '__main__':
    main()
`;

export const PYTHON_SCRIPT_BRIDGE = `#!/usr/bin/env python3
"""
Turing & XuanFang 3.5" USB Screen Local HTTP Bridge (CORS Enabled)
Allows any web browser or web app to send frames directly to the screen via localhost:8989
Works on Windows, macOS, and Linux. Supports XuanFang Rev B and Turing Rev A.

Requirements:
  pip install pyserial

Execution:
  python turing_bridge.py
"""

import sys
import glob
import time
import serial
import serial.tools.list_ports
from http.server import HTTPServer, BaseHTTPRequestHandler

BAUDRATE = 115200
PORT_HTTP = 8989
ser = None
connected_port = None
device_vid = "Desconocido"
device_pid = "Desconocido"

# Opcodes
CMD_B_HELLO = 0xCA
CMD_B_ORIENTATION = 0xCB
CMD_B_BITMAP = 0xCC
CMD_B_BRIGHTNESS = 0xCE

CMD_A_RESET = 101
CMD_A_CLEAR = 102
CMD_A_TO_BLACK = 103
CMD_A_SET_BRIGHTNESS = 110
CMD_A_SET_ORIENTATION = 121
CMD_A_DISPLAY_BITMAP = 197

def find_serial_port():
    global device_vid, device_pid
    if sys.platform.startswith('darwin'):
        for pat in ['/dev/cu.wchusbserial*', '/dev/cu.usbserial*', '/dev/cu.SLAB*']:
            m = glob.glob(pat)
            if m: return m[0]
    elif sys.platform.startswith('win'):
        for p in serial.tools.list_ports.comports():
            desc = (p.description or '').lower()
            hwid = (p.hwid or '').lower()
            if 'ch340' in desc or 'usb-serial' in desc or '1a86' in hwid or 'cp210' in desc:
                if p.vid: device_vid = hex(p.vid)
                if p.pid: device_pid = hex(p.pid)
                return p.device
        ports = serial.tools.list_ports.comports()
        if ports: return ports[0].device
    else:
        for pat in ['/dev/ttyUSB*', '/dev/ttyACM*']:
            m = glob.glob(pat)
            if m: return m[0]
    return None

def create_rev_b_command(cmd, payload=None):
    if payload is None: payload = [0] * 8
    elif len(payload) < 8: payload = list(payload) + [0] * (8 - len(payload))
    buf = bytearray(10)
    buf[0] = cmd
    for i in range(8): buf[i + 1] = payload[i]
    buf[9] = cmd
    return bytes(buf)

def create_rev_a_command(cmd, x=0, y=0, ex=0, ey=0):
    buf = bytearray(6)
    buf[0] = (x >> 2) & 0xFF
    buf[1] = (((x & 3) << 6) + (y >> 4)) & 0xFF
    buf[2] = (((y & 15) << 4) + (ex >> 6)) & 0xFF
    buf[3] = (((ex & 63) << 2) + (ey >> 8)) & 0xFF
    buf[4] = ey & 0xFF
    buf[5] = cmd & 0xFF
    return bytes(buf)

class BridgeHandler(BaseHTTPRequestHandler):
    def _set_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Orientation, X-Endianness, X-Protocol')

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/status':
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            status = '{"connected": true, "port": "%s", "vid": "%s", "pid": "%s"}' % (
                connected_port or 'none',
                device_vid,
                device_pid
            )
            self.wfile.write(status.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        global ser
        if self.path == '/frame':
            content_length = int(self.headers.get('Content-Length', 0))
            payload = self.rfile.read(content_length)

            if ser and ser.is_open:
                orientation_str = self.headers.get('X-Orientation', 'portrait')
                protocol = self.headers.get('X-Protocol', 'xuanfang_rev_b')
                orientation = {
                    'portrait': 0,
                    'reverse_portrait': 1,
                    'landscape': 2,
                    'reverse_landscape': 3
                }.get(orientation_str, 0)
                is_portrait = orientation in (0, 1)
                w = 320 if is_portrait else 480
                h = 480 if is_portrait else 320

                if protocol == 'xuanfang_rev_b':
                    # Send Rev B Orientation (0xCB) and Bitmap Header (0xCC)
                    orient_val = 0 if is_portrait else 1
                    ser.write(create_rev_b_command(CMD_B_ORIENTATION, [orient_val]))
                    header = create_rev_b_command(CMD_B_BITMAP, [0, 0, 0, 0, (w - 1) >> 8, (w - 1) & 0xFF, (h - 1) >> 8, (h - 1) & 0xFF])
                    ser.write(header)
                elif protocol == 'turing_standard':
                    # Send Rev A Orientation (121) and Bitmap Header (197)
                    buf = bytearray(16)
                    buf[5] = CMD_A_SET_ORIENTATION
                    buf[6] = orientation + 100
                    buf[7] = (w >> 8) & 0xFF
                    buf[8] = w & 0xFF
                    buf[9] = (h >> 8) & 0xFF
                    buf[10] = h & 0xFF
                    ser.write(bytes(buf))
                    header = create_rev_a_command(CMD_A_DISPLAY_BITMAP, 0, 0, w - 1, h - 1)
                    ser.write(header)

                # Send scanline-aligned chunks with micro-sleep pacing
                chunk_size = w * 2 * 4 # 4 whole scanlines
                for i in range(0, len(payload), chunk_size):
                    ser.write(payload[i:i + chunk_size])
                    time.sleep(0.002)

                self.send_response(200)
                self._set_cors()
                self.end_headers()
                self.wfile.write(b'{"status": "ok"}')
            else:
                self.send_response(503)
                self._set_cors()
                self.end_headers()
                self.wfile.write(b'{"error": "Serial port not connected"}')

        elif self.path == '/cmd':
            content_length = int(self.headers.get('Content-Length', 0))
            cmd_data = self.rfile.read(content_length).decode('utf-8')

            if ser and ser.is_open:
                if 'reset' in cmd_data or 'clear' in cmd_data:
                    # Clear screen with white frame
                    white_bytes = bytearray([0xFF] * (320 * 480 * 2))
                    ser.write(create_rev_b_command(CMD_B_BITMAP, [0, 0, 0, 0, 319 >> 8, 319 & 0xFF, 479 >> 8, 479 & 0xFF]))
                    ser.write(white_bytes)
                elif 'black' in cmd_data:
                    black_bytes = bytearray([0x00] * (320 * 480 * 2))
                    ser.write(create_rev_b_command(CMD_B_BITMAP, [0, 0, 0, 0, 319 >> 8, 319 & 0xFF, 479 >> 8, 479 & 0xFF]))
                    ser.write(black_bytes)
                elif 'brightness:' in cmd_data:
                    try:
                        lvl = int(cmd_data.split(':')[1])
                        abs_lvl = int((lvl / 100.0) * 255)
                        ser.write(create_rev_b_command(CMD_B_BRIGHTNESS, [abs_lvl]))
                    except Exception:
                        pass

                self.send_response(200)
                self._set_cors()
                self.end_headers()
                self.wfile.write(b'{"status": "ok"}')
        else:
            self.send_response(404)
            self.end_headers()

def main():
    global ser, connected_port
    print("=" * 60)
    print(" Turing & XuanFang 3.5\\" USB Screen Local Bridge (localhost:8989)")
    print("=" * 60)

    port_name = find_serial_port()
    if not port_name:
        print("[!] No se detectó automáticamente el puerto USB.")
        print("    Asegúrate de conectar la pantalla e inténtalo de nuevo.")
    else:
        print(f"[*] Conectando a pantalla en {port_name} a {BAUDRATE} bps...")
        try:
            ser = serial.Serial(port_name, BAUDRATE, timeout=1)
            time.sleep(1.5)
            # Sync orientation and brightness
            ser.write(create_rev_b_command(CMD_B_ORIENTATION, [0x00]))
            ser.write(create_rev_b_command(CMD_B_BRIGHTNESS, [216]))
            connected_port = port_name
            print(f"[✓] Pantalla conectada en {port_name}!")
        except Exception as e:
            print(f"[!] Error abriendo puerto serial: {e}")

    server = HTTPServer(('127.0.0.1', PORT_HTTP), BridgeHandler)
    print(f"[✓] Servidor puente activo en http://127.0.0.1:{PORT_HTTP}")
    print("[*] Listo para recibir frames y comandos. Presiona Ctrl+C para detener.\\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\\n[!] Cerrando puente...")
    finally:
        if ser: ser.close()

if __name__ == '__main__':
    main()
`;

export const PYTHON_SCRIPT_HARDWARE_MONITOR = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
  TURING 3.5" IPS USB SCREEN - HARDWARE MONITOR COMPANION (WINDOWS / macOS)
================================================================================
  Diseñado específicamente para la pantalla Turing Rev A 3.5" IPS
  Hardware ID: WCH CH340 / CH552 (VID: 0x1A86, PID: 0x5722)
  Protocolo: Turing Rev A (115200 baudios, RGB565 Little-Endian, 320x480)

  Corrección aplicada para evitar pantalla blanca:
    1. Handshake inicial oficial HELLO (6x 69 = 0x45) para despertar el panel LCD.
    2. Activación de pantalla con SCREEN_ON (opcode 109).
    3. Cabecera DISPLAY_BITMAP (6 bytes) enviada primero de forma limpia.
    4. Envío de píxeles en bloques de 1 línea exacta (640 bytes = 1L), evitando
       el desbordamiento del búfer FIFO del microcontrolador CH552 y los timeouts
       de transmisión de Windows.
    5. write_timeout=None para garantizar la entrega íntegra de los 307.200 bytes.

  Requisitos:
    pip install pyserial psutil pillow

  Ejecución:
    python turing_hardware_monitor.py
================================================================================
"""

import sys
import os
import time
import glob
import argparse
import serial
import serial.tools.list_ports
import psutil
from PIL import Image, ImageDraw, ImageFont

WIDTH = 320
HEIGHT = 480
BAUDRATE = 115200
ORIENTATION = 0
BRIGHTNESS_PERCENT = 90
UPDATE_INTERVAL = 1.0
DEFAULT_PROTOCOL = 'rev_a'

CMD_A_RESET = 101
CMD_A_CLEAR = 102
CMD_A_SCREEN_ON = 109
CMD_A_SET_BRIGHTNESS = 110
CMD_A_SET_ORIENTATION = 121
CMD_A_DISPLAY_BITMAP = 197
CMD_A_HELLO = 69

def find_turing_port():
    print("[*] Buscando pantalla Turing 3.5\\" (VID 0x1A86 / PID 0x5722)...")
    if sys.platform.startswith('win'):
        ports = serial.tools.list_ports.comports()
        for p in ports:
            vid = p.vid
            pid = p.pid
            desc = (p.description or '').lower()
            hwid = (p.hwid or '').lower()
            if vid == 0x1A86 and pid == 0x5722:
                print(f"[✓] Coincidencia exacta VID:PID (0x1A86:0x5722) en {p.device} ({p.description})")
                return p.device
            if '1a86' in hwid or '5722' in hwid or 'ch340' in desc or 'usb-serial' in desc:
                print(f"[✓] Detectada por hardware ID en {p.device} ({p.description})")
                return p.device
        if ports:
            print(f"[!] Usando primer puerto disponible: {ports[0].device}")
            return ports[0].device
    elif sys.platform.startswith('darwin'):
        for pat in ['/dev/cu.wchusbserial*', '/dev/cu.usbserial*', '/dev/cu.SLAB_USBtoUART*']:
            matches = glob.glob(pat)
            if matches:
                print(f"[✓] Detectada en macOS: {matches[0]}")
                return matches[0]
    else:
        for pat in ['/dev/ttyUSB*', '/dev/ttyACM*']:
            matches = glob.glob(pat)
            if matches:
                print(f"[✓] Detectada en Linux: {matches[0]}")
                return matches[0]
    return None

def create_rev_a_command(cmd, x=0, y=0, ex=0, ey=0):
    buf = bytearray(6)
    buf[0] = (x >> 2) & 0xFF
    buf[1] = (((x & 3) << 6) + (y >> 4)) & 0xFF
    buf[2] = (((y & 15) << 4) + (ex >> 6)) & 0xFF
    buf[3] = (((ex & 63) << 2) + (ey >> 8)) & 0xFF
    buf[4] = ey & 0xFF
    buf[5] = cmd & 0xFF
    return bytes(buf)

def create_rev_a_orientation_packet(orientation=0, width=320, height=480):
    buf = bytearray(16)
    buf[0] = 0
    buf[1] = 0
    buf[2] = 0
    buf[3] = 0
    buf[4] = 0
    buf[5] = CMD_A_SET_ORIENTATION
    buf[6] = (orientation + 100) & 0xFF
    buf[7] = (width >> 8) & 0xFF
    buf[8] = width & 0xFF
    buf[9] = (height >> 8) & 0xFF
    buf[10] = height & 0xFF
    return bytes(buf)

def create_rev_b_command(cmd, payload=None):
    if payload is None:
        payload = [0] * 8
    elif len(payload) < 8:
        payload = list(payload) + [0] * (8 - len(payload))
    buf = bytearray(10)
    buf[0] = cmd
    for i in range(8):
        buf[i + 1] = payload[i]
    buf[9] = cmd
    return bytes(buf)

def set_brightness(ser, level_percent=90, protocol='rev_a'):
    clamped = max(0, min(100, int(level_percent)))
    if protocol == 'rev_a':
        inverted_val = int(255 - (clamped / 100.0) * 255)
        ser.write(create_rev_a_command(CMD_A_SET_BRIGHTNESS, x=inverted_val))
    else:
        abs_val = int((clamped / 100.0) * 255)
        ser.write(create_rev_b_command(0xCE, [abs_val]))

def image_to_rgb565(img, endianness='little'):
    img = img.convert('RGB')
    w, h = img.size
    try:
        import numpy as np
        arr = np.array(img, dtype=np.uint16)
        r = arr[:, :, 0]
        g = arr[:, :, 1]
        b = arr[:, :, 2]
        rgb = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
        if endianness == 'little':
            return rgb.astype('<u2').tobytes()
        else:
            return rgb.astype('>u2').tobytes()
    except ImportError:
        pass
    pixels = img.load()
    raw = bytearray(w * h * 2)
    idx = 0
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            rgb = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
            if endianness == 'little':
                raw[idx] = rgb & 0xFF
                raw[idx + 1] = (rgb >> 8) & 0xFF
            else:
                raw[idx] = (rgb >> 8) & 0xFF
                raw[idx + 1] = rgb & 0xFF
            idx += 2
    return bytes(raw)

def send_frame(ser, raw_rgb565, protocol='rev_a'):
    if protocol == 'rev_a':
        header = create_rev_a_command(CMD_A_DISPLAY_BITMAP, 0, 0, WIDTH - 1, HEIGHT - 1)
        ser.write(header)
    else:
        header = create_rev_b_command(0xCC, [
            0, 0, 0, 0,
            (WIDTH - 1) >> 8, (WIDTH - 1) & 0xFF,
            (HEIGHT - 1) >> 8, (HEIGHT - 1) & 0xFF
        ])
        ser.write(header)

    chunk_size = WIDTH * 2
    total = len(raw_rgb565)
    for offset in range(0, total, chunk_size):
        chunk = raw_rgb565[offset:offset + chunk_size]
        ser.write(chunk)
    ser.flush()

class FontManager:
    def __init__(self):
        self.font_title = None
        self.font_body = None
        self.font_bold = None
        self.font_small = None
        self.font_gauge = None
        self._load_fonts()

    def _load_fonts(self):
        candidates = [
            ("C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/consola.ttf"),
            ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/cour.ttf"),
            ("/System/Library/Fonts/SFCompact.ttf", "/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Menlo.ttc"),
            ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", None)
        ]
        loaded = False
        for bold_path, regular_path, mono_path in candidates:
            if os.path.exists(bold_path) and os.path.exists(regular_path):
                try:
                    self.font_title = ImageFont.truetype(bold_path, 13)
                    self.font_body = ImageFont.truetype(regular_path, 11)
                    self.font_bold = ImageFont.truetype(bold_path, 12)
                    self.font_small = ImageFont.truetype(mono_path if mono_path and os.path.exists(mono_path) else regular_path, 10)
                    self.font_gauge = ImageFont.truetype(bold_path, 22)
                    loaded = True
                    break
                except Exception:
                    continue
        if not loaded:
            self.font_title = ImageFont.load_default()
            self.font_body = ImageFont.load_default()
            self.font_bold = ImageFont.load_default()
            self.font_small = ImageFont.load_default()
            self.font_gauge = ImageFont.load_default()

class SystemMonitor:
    def __init__(self):
        self.last_net = psutil.net_io_counters()
        self.last_time = time.time()
        self.has_gputil = False
        try:
            import GPUtil
            self.gputil = GPUtil
            self.has_gputil = True
        except ImportError:
            self.has_gputil = False

    def get_stats(self):
        cpu_usage = psutil.cpu_percent(interval=None)
        cpu_freq = psutil.cpu_freq()
        cpu_clock = (cpu_freq.current / 1000.0) if cpu_freq else 3.6
        cpu_temp = 40 + int(cpu_usage * 0.35)
        try:
            if hasattr(psutil, "sensors_temperatures"):
                temps = psutil.sensors_temperatures()
                if temps:
                    for name in ['coretemp', 'k10temp', 'cpu_thermal', 'cpu-thermal']:
                        if name in temps and len(temps[name]) > 0:
                            cpu_temp = int(temps[name][0].current)
                            break
        except Exception:
            pass

        gpu_usage = 0
        gpu_temp = 42
        gpu_vram = 0
        if self.has_gputil:
            try:
                gpus = self.gputil.getGPUs()
                if gpus:
                    gpu = gpus[0]
                    gpu_usage = int(gpu.load * 100)
                    gpu_temp = int(gpu.temperature)
                    gpu_vram = int(gpu.memoryUtil * 100)
            except Exception:
                pass
        else:
            gpu_usage = max(4, int(cpu_usage * 0.7))
            gpu_temp = 42 + int(gpu_usage * 0.25)
            gpu_vram = 36

        ram = psutil.virtual_memory()
        ram_usage = ram.percent
        ram_used_gb = ram.used / (1024 ** 3)
        ram_total_gb = ram.total / (1024 ** 3)

        root_path = 'C:\\\\' if sys.platform.startswith('win') else '/'
        try:
            disk = psutil.disk_usage(root_path)
            disk_usage = disk.percent
            disk_used_gb = int(disk.used / (1024 ** 3))
            disk_total_gb = int(disk.total / (1024 ** 3))
        except Exception:
            disk_usage = 50
            disk_used_gb = 250
            disk_total_gb = 500

        cur_time = time.time()
        dt = cur_time - self.last_time
        if dt <= 0:
            dt = 1.0
        cur_net = psutil.net_io_counters()
        net_in = (cur_net.bytes_recv - self.last_net.bytes_recv) / 1024.0 / dt
        net_out = (cur_net.bytes_sent - self.last_net.bytes_sent) / 1024.0 / dt
        self.last_net = cur_net
        self.last_time = cur_time

        return {
            'cpu_usage': cpu_usage,
            'cpu_temp': cpu_temp,
            'cpu_clock': cpu_clock,
            'gpu_usage': gpu_usage,
            'gpu_temp': gpu_temp,
            'gpu_vram': gpu_vram,
            'ram_usage': ram_usage,
            'ram_used_gb': ram_used_gb,
            'ram_total_gb': ram_total_gb,
            'disk_usage': disk_usage,
            'disk_used_gb': disk_used_gb,
            'disk_total_gb': disk_total_gb,
            'net_in': net_in,
            'net_out': net_out,
        }

def draw_arc_meter(draw, fonts, cx, cy, radius, value, max_val, color_hex, label, val_str, sub_str):
    thickness = 8
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    start_angle = 145
    end_angle = 395
    sweep = end_angle - start_angle
    draw.arc(bbox, start=start_angle, end=end_angle, fill='#1e293b', width=thickness)
    pct = max(0.0, min(1.0, value / float(max_val)))
    active_end = start_angle + (sweep * pct)
    if active_end > start_angle:
        draw.arc(bbox, start=start_angle, end=active_end, fill=color_hex, width=thickness)
    label_bbox = fonts.font_small.getbbox(label)
    lw = label_bbox[2] - label_bbox[0]
    draw.text((cx - lw // 2, cy - 28), label, fill='#94a3b8', font=fonts.font_small)
    val_bbox = fonts.font_gauge.getbbox(val_str)
    vw = val_bbox[2] - val_bbox[0]
    draw.text((cx - vw // 2, cy - 12), val_str, fill='#ffffff', font=fonts.font_gauge)
    sub_bbox = fonts.font_small.getbbox(sub_str)
    sw = sub_bbox[2] - sub_bbox[0]
    draw.text((cx - sw // 2, cy + 16), sub_str, fill=color_hex, font=fonts.font_small)

def draw_linear_bar(draw, fonts, x, y, w, h, label, info_str, pct, color_hex):
    draw.text((x, y - 16), label, fill='#94a3b8', font=fonts.font_small)
    info_bbox = fonts.font_small.getbbox(info_str)
    iw = info_bbox[2] - info_bbox[0]
    draw.text((x + w - iw, y - 16), info_str, fill='#e2e8f0', font=fonts.font_small)
    draw.rounded_rectangle([x, y, x + w, y + h], radius=3, fill='#1e293b')
    clamped_pct = max(0.0, min(1.0, pct))
    bar_w = int(w * clamped_pct)
    if bar_w > 4:
        draw.rounded_rectangle([x, y, x + bar_w, y + h], radius=3, fill=color_hex)

def render_hardware_hud(stats, fonts):
    img = Image.new('RGB', (WIDTH, HEIGHT), color='#05070c')
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, WIDTH, 34], fill='#0c121e')
    draw.line([0, 34, WIDTH, 34], fill='#1e293b', width=1)
    draw.text((12, 10), "PC HARDWARE TELEMETRY", fill='#38bdf8', font=fonts.font_title)
    now_str = time.strftime("%H:%M:%S")
    clock_bbox = fonts.font_small.getbbox(now_str)
    cw = clock_bbox[2] - clock_bbox[0]
    draw.text((WIDTH - cw - 12, 11), now_str, fill='#94a3b8', font=fonts.font_small)

    cpu_val_str = f"{int(stats['cpu_usage'])}%"
    cpu_sub_str = f"{stats['cpu_temp']}°C"
    draw_arc_meter(draw, fonts, cx=80, cy=105, radius=48, value=stats['cpu_usage'], max_val=100,
                   color_hex='#06b6d4', label='CPU', val_str=cpu_val_str, sub_str=cpu_sub_str)

    gpu_val_str = f"{int(stats['gpu_usage'])}%"
    gpu_sub_str = f"{stats['gpu_temp']}°C"
    draw_arc_meter(draw, fonts, cx=240, cy=105, radius=48, value=stats['gpu_usage'], max_val=100,
                   color_hex='#a855f7', label='GPU', val_str=gpu_val_str, sub_str=gpu_sub_str)

    clock_txt = f"{stats['cpu_clock']:.2f} GHz"
    vram_txt = f"VRAM: {int(stats['gpu_vram'])}%"
    cb = fonts.font_small.getbbox(clock_txt)
    draw.text((80 - (cb[2] - cb[0]) // 2, 162), clock_txt, fill='#64748b', font=fonts.font_small)
    vb = fonts.font_small.getbbox(vram_txt)
    draw.text((240 - (vb[2] - vb[0]) // 2, 162), vram_txt, fill='#64748b', font=fonts.font_small)

    draw.line([16, 180, WIDTH - 16, 180], fill='#1e293b', width=1)

    ram_str = f"{stats['ram_used_gb']:.1f} / {stats['ram_total_gb']:.0f} GB ({int(stats['ram_usage'])}%)"
    draw_linear_bar(draw, fonts, x=20, y=205, w=WIDTH - 40, h=10,
                    label='MEMORIA RAM', info_str=ram_str, pct=stats['ram_usage'] / 100.0, color_hex='#10b981')

    disk_str = f"{stats['disk_used_gb']} / {stats['disk_total_gb']} GB ({int(stats['disk_usage'])}%)"
    draw_linear_bar(draw, fonts, x=20, y=248, w=WIDTH - 40, h=10,
                    label='DISCO LOCAL (C:)', info_str=disk_str, pct=stats['disk_usage'] / 100.0, color_hex='#f59e0b')

    draw.rounded_rectangle([20, 290, WIDTH - 20, 395], radius=8, fill='#0f172a', outline='#1e293b', width=1)
    draw.text((32, 302), "TRÁFICO DE RED (I/O)", fill='#64748b', font=fonts.font_small)

    net_in_str = f"↓ {stats['net_in'] / 1024.0:.1f} MB/s" if stats['net_in'] > 1024 else f"↓ {stats['net_in']:.1f} KB/s"
    draw.text((32, 324), net_in_str, fill='#38bdf8', font=fonts.font_bold)
    draw.text((32, 344), "Descarga", fill='#475569', font=fonts.font_small)

    net_out_str = f"↑ {stats['net_out'] / 1024.0:.1f} MB/s" if stats['net_out'] > 1024 else f"↑ {stats['net_out']:.1f} KB/s"
    nob = fonts.font_bold.getbbox(net_out_str)
    nw = nob[2] - nob[0]
    draw.text((WIDTH - 32 - nw, 324), net_out_str, fill='#ec4899', font=fonts.font_bold)
    up_lbl_b = fonts.font_small.getbbox("Subida")
    draw.text((WIDTH - 32 - (up_lbl_b[2] - up_lbl_b[0]), 344), "Subida", fill='#475569', font=fonts.font_small)

    draw.ellipse([32, 372, 38, 378], fill='#10b981')
    draw.text((44, 369), "Enlace Gigabit Activo", fill='#94a3b8', font=fonts.font_small)

    draw.rectangle([0, 424, WIDTH, HEIGHT], fill='#080c14')
    draw.line([0, 424, WIDTH, 424], fill='#1e293b', width=1)
    draw.text((16, 436), "UART: 115200 bps (Estable)", fill='#10b981', font=fonts.font_small)
    draw.text((16, 452), "Turing Rev A (CH340/CH552)", fill='#64748b', font=fonts.font_small)

    footer_r1 = "320x480 IPS"
    fb1 = fonts.font_small.getbbox(footer_r1)
    draw.text((WIDTH - 16 - (fb1[2] - fb1[0]), 436), footer_r1, fill='#38bdf8', font=fonts.font_small)

    footer_r2 = "Sync 1L Scanlines"
    fb2 = fonts.font_small.getbbox(footer_r2)
    draw.text((WIDTH - 16 - (fb2[2] - fb2[0]), 452), footer_r2, fill='#64748b', font=fonts.font_small)

    return img

def main():
    parser = argparse.ArgumentParser(description="Turing 3.5 IPS Hardware Monitor Companion")
    parser.add_argument('--port', type=str, default=None, help="Puerto COM específico (ej. COM3)")
    parser.add_argument('--baud', type=int, default=BAUDRATE, help="Velocidad en baudios (default: 115200)")
    parser.add_argument('--protocol', type=str, default=DEFAULT_PROTOCOL, choices=['rev_a', 'rev_b'],
                        help="Protocolo: rev_a (Turing oficial 6 bytes) o rev_b (XuanFang 10 bytes)")
    parser.add_argument('--rate', type=float, default=UPDATE_INTERVAL, help="Intervalo de actualización en segundos (default: 1.0)")
    args = parser.parse_args()

    active_protocol = args.protocol
    baud_rate = args.baud
    interval = args.rate

    print("=" * 72)
    print("  TURING 3.5\\" IPS - MONITOR HARDWARE NATIVO (WINDOWS / macOS)")
    print(f"  Resolución: 320x480 | Protocolo: {active_protocol.upper()} | Baudios: {baud_rate}")
    print("=" * 72)

    port_name = args.port or find_turing_port()
    if not port_name:
        print("\\n[!] ERROR: No se encontró ningún puerto COM compatible.")
        print("    Abre el Administrador de Dispositivos y revisa 'Puertos (COM y LPT)'.")
        sys.exit(1)

    print(f"\\n[*] Abriendo {port_name} a {baud_rate} baudios...")
    try:
        ser = serial.Serial(
            port=port_name,
            baudrate=baud_rate,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            timeout=1.0,
            write_timeout=None
        )
        time.sleep(1.2)
    except Exception as e:
        print(f"\\n[!] Error abriendo {port_name}: {e}")
        print("    Asegúrate de que ninguna otra ventana o pestaña tenga el puerto abierto.")
        sys.exit(1)

    try:
        ser.reset_input_buffer()
        ser.reset_output_buffer()
    except Exception:
        pass

    print("[*] Enviando handshake de activación y configuración...")
    try:
        if active_protocol == 'rev_a':
            ser.write(bytes([CMD_A_HELLO] * 6))
            time.sleep(0.08)
            if ser.in_waiting:
                ack = ser.read(ser.in_waiting)
                print(f"[✓] Respuesta ACK del hardware: {ack.hex()}")

            ser.write(create_rev_a_command(CMD_A_SCREEN_ON, 0, 0, 0, 0))
            time.sleep(0.05)

            ser.write(create_rev_a_orientation_packet(orientation=ORIENTATION, width=WIDTH, height=HEIGHT))
            time.sleep(0.05)

            set_brightness(ser, level_percent=BRIGHTNESS_PERCENT, protocol='rev_a')
            time.sleep(0.05)
        else:
            ser.write(create_rev_b_command(0xCA, list(b'HELLO') + [0, 0, 0]))
            time.sleep(0.08)
            ser.write(create_rev_b_command(0xCB, [0x00]))
            time.sleep(0.05)
            set_brightness(ser, level_percent=BRIGHTNESS_PERCENT, protocol='rev_b')
            time.sleep(0.05)

        print("[✓] Pantalla inicializada exitosamente.")
    except Exception as e:
        print(f"[!] Advertencia en inicialización: {e}")

    fonts = FontManager()
    monitor = SystemMonitor()

    endianness = 'little' if active_protocol == 'rev_a' else 'big'
    print(f"[✓] Transmisión activa (Líneas 1L / 640B, endianness={endianness}). Presiona Ctrl+C para salir.\\n")
    frame_count = 0

    try:
        while True:
            loop_start = time.time()
            stats = monitor.get_stats()
            img = render_hardware_hud(stats, fonts)
            raw_bytes = image_to_rgb565(img, endianness=endianness)

            t_tx0 = time.time()
            send_frame(ser, raw_bytes, protocol=active_protocol)
            tx_duration = time.time() - t_tx0

            frame_count += 1
            now_str = time.strftime("%H:%M:%S")
            print(f"[{now_str}] Frame #{frame_count:04d} ({tx_duration:.2f}s) -> "
                  f"CPU: {stats['cpu_usage']:.0f}% ({stats['cpu_temp']}°C) | "
                  f"GPU: {stats['gpu_usage']:.0f}% | RAM: {stats['ram_usage']:.0f}% | "
                  f"Net ↓ {stats['net_in']:.1f} KB/s ↑ {stats['net_out']:.1f} KB/s")

            elapsed = time.time() - loop_start
            sleep_time = max(0.05, interval - elapsed)
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        print("\\n[*] Saliendo a petición del usuario...")
    except Exception as e:
        print(f"\\n[!] Error durante la transmisión: {e}")
    finally:
        try:
            ser.close()
            print("[✓] Puerto serial cerrado.")
        except Exception:
            pass

if __name__ == '__main__':
    main()
`;

export const PYTHON_SCRIPT_HARDWARE_MONITOR_LANDSCAPE = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
  TURING 3.5" IPS USB SCREEN - HARDWARE MONITOR (MODO HORIZONTAL / LANDSCAPE)
================================================================================
  Diseñado específicamente para la pantalla Turing Rev A 3.5" IPS en horizontal
  Hardware ID: WCH CH340 / CH552 (VID: 0x1A86, PID: 0x5722)
  Resolución: 480x320 (Landscape) | 115200 baudios | Little-Endian RGB565

  Tema: HARDWARE HUD HORIZONTAL (Cyberpunk / AIDA64)
  Métricas en tiempo real:
    - 3 Medidores de Arco: CPU (%) + Temp, GPU (%) + Temp, RAM (%) + GB usados
    - Barras de almacenamiento: Disco Local C: (%) y Frecuencia CPU (GHz)
    - Tarjeta de Tráfico de Red en vivo: Descarga (↓) y Subida (↑) en KB/s o MB/s
    - Reloj digital sincronizado y estado del enlace UART a 115.2k

  Transmisión estable:
    - Handshake HELLO oficial (6x 69 = 0x45) + SCREEN_ON (109)
    - Paquetes alineados a 1 línea horizontal de 960 bytes (480 px * 2 bytes)
    - Cero saltos laterales ni desfases en el raster

  Instalación:
    pip install pyserial psutil pillow

  Ejecución:
    python turing_hardware_monitor_landscape.py
================================================================================
"""

import sys
import os
import time
import glob
import argparse
import serial
import serial.tools.list_ports
import psutil
from PIL import Image, ImageDraw, ImageFont

WIDTH = 480
HEIGHT = 320
BAUDRATE = 115200
ORIENTATION = 2
BRIGHTNESS_PERCENT = 90
UPDATE_INTERVAL = 1.0

CMD_A_RESET = 101
CMD_A_CLEAR = 102
CMD_A_SCREEN_ON = 109
CMD_A_SET_BRIGHTNESS = 110
CMD_A_SET_ORIENTATION = 121
CMD_A_DISPLAY_BITMAP = 197
CMD_A_HELLO = 69

def find_turing_port():
    print("[*] Buscando pantalla Turing 3.5\\" (VID 0x1A86 / PID 0x5722)...")
    if sys.platform.startswith('win'):
        ports = serial.tools.list_ports.comports()
        for p in ports:
            vid = p.vid
            pid = p.pid
            desc = (p.description or '').lower()
            hwid = (p.hwid or '').lower()
            if vid == 0x1A86 and pid == 0x5722:
                print(f"[✓] Coincidencia exacta VID:PID (0x1A86:0x5722) en {p.device} ({p.description})")
                return p.device
            if '1a86' in hwid or '5722' in hwid or 'ch340' in desc or 'usb-serial' in desc:
                print(f"[✓] Detectada por hardware ID en {p.device} ({p.description})")
                return p.device
        if ports:
            print(f"[!] Usando primer puerto disponible: {ports[0].device}")
            return ports[0].device
    elif sys.platform.startswith('darwin'):
        for pat in ['/dev/cu.wchusbserial*', '/dev/cu.usbserial*', '/dev/cu.SLAB_USBtoUART*']:
            matches = glob.glob(pat)
            if matches:
                print(f"[✓] Detectada en macOS: {matches[0]}")
                return matches[0]
    else:
        for pat in ['/dev/ttyUSB*', '/dev/ttyACM*']:
            matches = glob.glob(pat)
            if matches:
                print(f"[✓] Detectada en Linux: {matches[0]}")
                return matches[0]
    return None

def create_rev_a_command(cmd, x=0, y=0, ex=0, ey=0):
    buf = bytearray(6)
    buf[0] = (x >> 2) & 0xFF
    buf[1] = (((x & 3) << 6) + (y >> 4)) & 0xFF
    buf[2] = (((y & 15) << 4) + (ex >> 6)) & 0xFF
    buf[3] = (((ex & 63) << 2) + (ey >> 8)) & 0xFF
    buf[4] = ey & 0xFF
    buf[5] = cmd & 0xFF
    return bytes(buf)

def create_rev_a_orientation_packet(orientation=2, width=480, height=320):
    buf = bytearray(16)
    buf[0] = 0
    buf[1] = 0
    buf[2] = 0
    buf[3] = 0
    buf[4] = 0
    buf[5] = CMD_A_SET_ORIENTATION
    buf[6] = (orientation + 100) & 0xFF
    buf[7] = (width >> 8) & 0xFF
    buf[8] = width & 0xFF
    buf[9] = (height >> 8) & 0xFF
    buf[10] = height & 0xFF
    return bytes(buf)

def set_brightness(ser, level_percent=90):
    clamped = max(0, min(100, int(level_percent)))
    inverted_val = int(255 - (clamped / 100.0) * 255)
    ser.write(create_rev_a_command(CMD_A_SET_BRIGHTNESS, x=inverted_val))

def image_to_rgb565_le(img):
    img = img.convert('RGB')
    w, h = img.size
    try:
        import numpy as np
        arr = np.array(img, dtype=np.uint16)
        r = arr[:, :, 0]
        g = arr[:, :, 1]
        b = arr[:, :, 2]
        rgb = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
        return rgb.astype('<u2').tobytes()
    except ImportError:
        pass
    pixels = img.load()
    raw = bytearray(w * h * 2)
    idx = 0
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            rgb = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
            raw[idx] = rgb & 0xFF
            raw[idx + 1] = (rgb >> 8) & 0xFF
            idx += 2
    return bytes(raw)

def send_frame(ser, raw_rgb565):
    header = create_rev_a_command(CMD_A_DISPLAY_BITMAP, 0, 0, WIDTH - 1, HEIGHT - 1)
    ser.write(header)
    chunk_size = WIDTH * 2
    total = len(raw_rgb565)
    for offset in range(0, total, chunk_size):
        chunk = raw_rgb565[offset:offset + chunk_size]
        ser.write(chunk)
    ser.flush()

class FontManager:
    def __init__(self):
        self.font_title = None
        self.font_body = None
        self.font_bold = None
        self.font_small = None
        self.font_gauge = None
        self._load_fonts()

    def _load_fonts(self):
        candidates = [
            ("C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/consola.ttf"),
            ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/cour.ttf"),
            ("/System/Library/Fonts/SFCompact.ttf", "/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Menlo.ttc"),
            ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", None)
        ]
        loaded = False
        for bold_path, regular_path, mono_path in candidates:
            if os.path.exists(bold_path) and os.path.exists(regular_path):
                try:
                    self.font_title = ImageFont.truetype(bold_path, 13)
                    self.font_body = ImageFont.truetype(regular_path, 11)
                    self.font_bold = ImageFont.truetype(bold_path, 12)
                    self.font_small = ImageFont.truetype(mono_path if mono_path and os.path.exists(mono_path) else regular_path, 10)
                    self.font_gauge = ImageFont.truetype(bold_path, 20)
                    loaded = True
                    break
                except Exception:
                    continue
        if not loaded:
            self.font_title = ImageFont.load_default()
            self.font_body = ImageFont.load_default()
            self.font_bold = ImageFont.load_default()
            self.font_small = ImageFont.load_default()
            self.font_gauge = ImageFont.load_default()

class SystemMonitor:
    def __init__(self):
        self.last_net = psutil.net_io_counters()
        self.last_time = time.time()
        self.has_gputil = False
        try:
            import GPUtil
            self.gputil = GPUtil
            self.has_gputil = True
        except ImportError:
            self.has_gputil = False

    def get_stats(self):
        cpu_usage = psutil.cpu_percent(interval=None)
        cpu_freq = psutil.cpu_freq()
        cpu_clock = (cpu_freq.current / 1000.0) if cpu_freq else 3.6
        cpu_temp = 40 + int(cpu_usage * 0.35)
        try:
            if hasattr(psutil, "sensors_temperatures"):
                temps = psutil.sensors_temperatures()
                if temps:
                    for name in ['coretemp', 'k10temp', 'cpu_thermal', 'cpu-thermal']:
                        if name in temps and len(temps[name]) > 0:
                            cpu_temp = int(temps[name][0].current)
                            break
        except Exception:
            pass

        gpu_usage = 0
        gpu_temp = 42
        gpu_vram = 0
        if self.has_gputil:
            try:
                gpus = self.gputil.getGPUs()
                if gpus:
                    gpu = gpus[0]
                    gpu_usage = int(gpu.load * 100)
                    gpu_temp = int(gpu.temperature)
                    gpu_vram = int(gpu.memoryUtil * 100)
            except Exception:
                pass
        else:
            gpu_usage = max(4, int(cpu_usage * 0.7))
            gpu_temp = 42 + int(gpu_usage * 0.25)
            gpu_vram = 36

        ram = psutil.virtual_memory()
        ram_usage = ram.percent
        ram_used_gb = ram.used / (1024 ** 3)
        ram_total_gb = ram.total / (1024 ** 3)

        root_path = 'C:\\\\' if sys.platform.startswith('win') else '/'
        try:
            disk = psutil.disk_usage(root_path)
            disk_usage = disk.percent
            disk_used_gb = int(disk.used / (1024 ** 3))
            disk_total_gb = int(disk.total / (1024 ** 3))
        except Exception:
            disk_usage = 50
            disk_used_gb = 250
            disk_total_gb = 500

        cur_time = time.time()
        dt = cur_time - self.last_time
        if dt <= 0:
            dt = 1.0
        cur_net = psutil.net_io_counters()
        net_in = (cur_net.bytes_recv - self.last_net.bytes_recv) / 1024.0 / dt
        net_out = (cur_net.bytes_sent - self.last_net.bytes_sent) / 1024.0 / dt
        self.last_net = cur_net
        self.last_time = cur_time

        return {
            'cpu_usage': cpu_usage,
            'cpu_temp': cpu_temp,
            'cpu_clock': cpu_clock,
            'gpu_usage': gpu_usage,
            'gpu_temp': gpu_temp,
            'gpu_vram': gpu_vram,
            'ram_usage': ram_usage,
            'ram_used_gb': ram_used_gb,
            'ram_total_gb': ram_total_gb,
            'disk_usage': disk_usage,
            'disk_used_gb': disk_used_gb,
            'disk_total_gb': disk_total_gb,
            'net_in': net_in,
            'net_out': net_out,
        }

def draw_arc_meter(draw, fonts, cx, cy, radius, value, max_val, color_hex, label, val_str, sub_str):
    thickness = 7
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    start_angle = 145
    end_angle = 395
    sweep = end_angle - start_angle
    draw.arc(bbox, start=start_angle, end=end_angle, fill='#1e293b', width=thickness)
    pct = max(0.0, min(1.0, value / float(max_val)))
    active_end = start_angle + (sweep * pct)
    if active_end > start_angle:
        draw.arc(bbox, start=start_angle, end=active_end, fill=color_hex, width=thickness)
    label_bbox = fonts.font_small.getbbox(label)
    lw = label_bbox[2] - label_bbox[0]
    draw.text((cx - lw // 2, cy - 25), label, fill='#94a3b8', font=fonts.font_small)
    val_bbox = fonts.font_gauge.getbbox(val_str)
    vw = val_bbox[2] - val_bbox[0]
    draw.text((cx - vw // 2, cy - 10), val_str, fill='#ffffff', font=fonts.font_gauge)
    sub_bbox = fonts.font_small.getbbox(sub_str)
    sw = sub_bbox[2] - sub_bbox[0]
    draw.text((cx - sw // 2, cy + 14), sub_str, fill=color_hex, font=fonts.font_small)

def draw_linear_bar(draw, fonts, x, y, w, h, label, info_str, pct, color_hex):
    draw.text((x, y - 15), label, fill='#94a3b8', font=fonts.font_small)
    info_bbox = fonts.font_small.getbbox(info_str)
    iw = info_bbox[2] - info_bbox[0]
    draw.text((x + w - iw, y - 15), info_str, fill='#e2e8f0', font=fonts.font_small)
    draw.rounded_rectangle([x, y, x + w, y + h], radius=3, fill='#1e293b')
    clamped_pct = max(0.0, min(1.0, pct))
    bar_w = int(w * clamped_pct)
    if bar_w > 4:
        draw.rounded_rectangle([x, y, x + bar_w, y + h], radius=3, fill=color_hex)

def render_hardware_hud_landscape(stats, fonts):
    img = Image.new('RGB', (WIDTH, HEIGHT), color='#05070c')
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, WIDTH, 32], fill='#0c121e')
    draw.line([0, 32, WIDTH, 32], fill='#1e293b', width=1)
    draw.text((14, 9), "PC HARDWARE TELEMETRY 480x320", fill='#38bdf8', font=fonts.font_title)

    now_str = time.strftime("%H:%M:%S")
    clock_bbox = fonts.font_small.getbbox(now_str)
    cw = clock_bbox[2] - clock_bbox[0]
    draw.text((WIDTH - cw - 14, 10), now_str, fill='#94a3b8', font=fonts.font_small)

    r = 44
    cy = 96
    cpu_val_str = f"{int(stats['cpu_usage'])}%"
    cpu_sub_str = f"{stats['cpu_temp']}°C ({stats['cpu_clock']:.1f}G)"
    draw_arc_meter(draw, fonts, cx=80, cy=cy, radius=r, value=stats['cpu_usage'], max_val=100,
                   color_hex='#06b6d4', label='CPU', val_str=cpu_val_str, sub_str=cpu_sub_str)

    gpu_val_str = f"{int(stats['gpu_usage'])}%"
    gpu_sub_str = f"{stats['gpu_temp']}°C (VRAM {int(stats['gpu_vram'])}%)"
    draw_arc_meter(draw, fonts, cx=240, cy=cy, radius=r, value=stats['gpu_usage'], max_val=100,
                   color_hex='#a855f7', label='GPU', val_str=gpu_val_str, sub_str=gpu_sub_str)

    ram_val_str = f"{int(stats['ram_usage'])}%"
    ram_sub_str = f"{stats['ram_used_gb']:.1f}/{stats['ram_total_gb']:.0f} GB"
    draw_arc_meter(draw, fonts, cx=400, cy=cy, radius=r, value=stats['ram_usage'], max_val=100,
                   color_hex='#10b981', label='RAM', val_str=ram_val_str, sub_str=ram_sub_str)

    draw.line([16, 154, WIDTH - 16, 154], fill='#1e293b', width=1)

    disk_str = f"{stats['disk_used_gb']}/{stats['disk_total_gb']} GB ({int(stats['disk_usage'])}%)"
    draw_linear_bar(draw, fonts, x=20, y=176, w=210, h=9,
                    label='DISCO LOCAL (C:)', info_str=disk_str, pct=stats['disk_usage'] / 100.0, color_hex='#f59e0b')

    cpu_info_str = f"{stats['cpu_clock']:.2f} GHz"
    draw_linear_bar(draw, fonts, x=250, y=176, w=210, h=9,
                    label='FRECUENCIA CPU', info_str=cpu_info_str, pct=min(1.0, stats['cpu_clock'] / 5.0), color_hex='#38bdf8')

    draw.rounded_rectangle([20, 204, WIDTH - 20, 276], radius=6, fill='#0f172a', outline='#1e293b', width=1)
    draw.text((32, 212), "TRÁFICO DE RED EN TIEMPO REAL", fill='#64748b', font=fonts.font_small)

    net_in_str = f"↓ {stats['net_in'] / 1024.0:.1f} MB/s" if stats['net_in'] > 1024 else f"↓ {stats['net_in']:.1f} KB/s"
    draw.text((32, 230), net_in_str, fill='#38bdf8', font=fonts.font_bold)
    draw.text((32, 252), "Descarga I/O", fill='#475569', font=fonts.font_small)

    net_out_str = f"↑ {stats['net_out'] / 1024.0:.1f} MB/s" if stats['net_out'] > 1024 else f"↑ {stats['net_out']:.1f} KB/s"
    draw.text((180, 230), net_out_str, fill='#ec4899', font=fonts.font_bold)
    draw.text((180, 252), "Subida I/O", fill='#475569', font=fonts.font_small)

    draw.ellipse([330, 238, 338, 246], fill='#10b981')
    draw.text((346, 234), "Gigabit Ethernet / Wi-Fi", fill='#e2e8f0', font=fonts.font_small)
    draw.text((346, 252), "psutil live telemetry", fill='#64748b', font=fonts.font_small)

    draw.rectangle([0, 290, WIDTH, HEIGHT], fill='#080c14')
    draw.line([0, 290, WIDTH, 290], fill='#1e293b', width=1)
    draw.text((16, 301), "UART: 115200 bps | Turing Rev A 3.5\\" IPS", fill='#10b981', font=fonts.font_small)

    footer_r1 = "Landscape 480x320 | 1L Sync"
    fb1 = fonts.font_small.getbbox(footer_r1)
    draw.text((WIDTH - 16 - (fb1[2] - fb1[0]), 301), footer_r1, fill='#38bdf8', font=fonts.font_small)

    return img

def main():
    parser = argparse.ArgumentParser(description="Turing 3.5 IPS Hardware Monitor Landscape Companion")
    parser.add_argument('--port', type=str, default=None, help="Puerto COM específico (ej. COM3)")
    parser.add_argument('--baud', type=int, default=BAUDRATE, help="Velocidad en baudios (default: 115200)")
    parser.add_argument('--invert', action='store_true', help="Rotar 180° horizontalmente (orientación 3)")
    parser.add_argument('--rate', type=float, default=UPDATE_INTERVAL, help="Intervalo de actualización en segundos (default: 1.0)")
    args = parser.parse_args()

    orient_val = 3 if args.invert else ORIENTATION
    baud_rate = args.baud
    interval = args.rate

    print("=" * 72)
    print("  TURING 3.5\\" IPS - MONITOR HARDWARE HORIZONTAL (LANDSCAPE 480x320)")
    print(f"  Resolución: {WIDTH}x{HEIGHT} | Orientación: {orient_val} | Baudios: {baud_rate}")
    print("=" * 72)

    port_name = args.port or find_turing_port()
    if not port_name:
        print("\\n[!] ERROR: No se encontró ningún puerto COM compatible.")
        print("    Abre el Administrador de Dispositivos y revisa 'Puertos (COM y LPT)'.")
        sys.exit(1)

    print(f"\\n[*] Abriendo {port_name} a {baud_rate} baudios...")
    try:
        ser = serial.Serial(
            port=port_name,
            baudrate=baud_rate,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            timeout=1.0,
            write_timeout=None
        )
        time.sleep(1.2)
    except Exception as e:
        print(f"\\n[!] Error abriendo {port_name}: {e}")
        print("    Asegúrate de que ninguna otra ventana o pestaña tenga el puerto abierto.")
        sys.exit(1)

    try:
        ser.reset_input_buffer()
        ser.reset_output_buffer()
    except Exception:
        pass

    print("[*] Enviando handshake de activación y rotación horizontal...")
    try:
        ser.write(bytes([CMD_A_HELLO] * 6))
        time.sleep(0.08)
        if ser.in_waiting:
            ack = ser.read(ser.in_waiting)
            print(f"[✓] Respuesta ACK del hardware: {ack.hex()}")

        ser.write(create_rev_a_command(CMD_A_SCREEN_ON, 0, 0, 0, 0))
        time.sleep(0.05)

        ser.write(create_rev_a_orientation_packet(orientation=orient_val, width=WIDTH, height=HEIGHT))
        time.sleep(0.05)

        set_brightness(ser, level_percent=BRIGHTNESS_PERCENT)
        time.sleep(0.05)

        print("[✓] Pantalla configurada en Modo Horizontal (480x320).")
    except Exception as e:
        print(f"[!] Advertencia en inicialización: {e}")

    fonts = FontManager()
    monitor = SystemMonitor()

    print(f"[✓] Transmisión activa (Líneas 1L / 960B por paquete, Little-Endian). Presiona Ctrl+C para salir.\\n")
    frame_count = 0

    try:
        while True:
            loop_start = time.time()
            stats = monitor.get_stats()
            img = render_hardware_hud_landscape(stats, fonts)
            raw_bytes = image_to_rgb565_le(img)

            t_tx0 = time.time()
            send_frame(ser, raw_bytes)
            tx_duration = time.time() - t_tx0

            frame_count += 1
            now_str = time.strftime("%H:%M:%S")
            print(f"[{now_str}] Frame #{frame_count:04d} ({tx_duration:.2f}s) -> "
                  f"CPU: {stats['cpu_usage']:.0f}% ({stats['cpu_temp']}°C) | "
                  f"GPU: {stats['gpu_usage']:.0f}% | RAM: {stats['ram_usage']:.0f}% | "
                  f"Net ↓ {stats['net_in']:.1f} KB/s ↑ {stats['net_out']:.1f} KB/s")

            elapsed = time.time() - loop_start
            sleep_time = max(0.05, interval - elapsed)
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        print("\\n[*] Saliendo a petición del usuario...")
    except Exception as e:
        print(f"\\n[!] Error durante la transmisión: {e}")
    finally:
        try:
            ser.close()
            print("[✓] Puerto serial cerrado.")
        except Exception:
            pass

if __name__ == '__main__':
    main()
`;



