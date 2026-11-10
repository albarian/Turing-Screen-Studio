#!/usr/bin/env python3
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
    draw.text((16, 10), "WINDOWS PC MONITOR 3.5\"", fill='#38bdf8')
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
    draw.text((WIDTH - 90, 448), "3.5\" IPS", fill='#64748b')

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
            disk = psutil.disk_usage('C:\\')

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
        print("\n[!] Finalizando...")
    finally:
        ser.close()

if __name__ == '__main__':
    main()
