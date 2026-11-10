#!/usr/bin/env python3
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
    print(" Turing & XuanFang 3.5\" USB Screen Local Bridge (localhost:8989)")
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
    print("[*] Listo para recibir frames y comandos. Presiona Ctrl+C para detener.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Cerrando puente...")
    finally:
        if ser: ser.close()

if __name__ == '__main__':
    main()
