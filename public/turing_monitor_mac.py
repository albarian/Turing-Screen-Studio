#!/usr/bin/env python3
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
    draw.text((16, 10), "macOS TELEMETRY 3.5\"", fill='#38bdf8')
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
    draw.text((WIDTH - 90, 448), "Turing 3.5\"", fill='#10b981')

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
        print("\n[!] Saliendo...")
    finally:
        ser.close()

if __name__ == '__main__':
    main()
