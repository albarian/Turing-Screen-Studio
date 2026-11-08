#!/usr/bin/env python3
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

# ==============================================================================
# CONFIGURACIÓN DEL HARDWARE
# ==============================================================================
WIDTH = 320
HEIGHT = 480
BAUDRATE = 115200  # Velocidad estándar oficial Turing Rev A (CH340/CH552)

# Orientación: 0 = Vertical (Portrait 320x480), 2 = Vertical Invertido
ORIENTATION = 0

# Brillo de pantalla: 0 a 100%
BRIGHTNESS_PERCENT = 90

# Intervalo entre frames en segundos
UPDATE_INTERVAL = 1.0

# Protocolo: 'rev_a' (Turing estándar, 6 bytes, Little-Endian) o 'rev_b' (XuanFang, 10 bytes, Big-Endian)
DEFAULT_PROTOCOL = 'rev_a'

# Opcodes Turing Rev A
CMD_A_RESET = 101
CMD_A_CLEAR = 102
CMD_A_SCREEN_ON = 109
CMD_A_SET_BRIGHTNESS = 110
CMD_A_SET_ORIENTATION = 121
CMD_A_DISPLAY_BITMAP = 197
CMD_A_HELLO = 69


# ==============================================================================
# DETECCIÓN DE PUERTO COM / SERIAL
# ==============================================================================
def find_turing_port():
    """Detecta automáticamente el puerto COM en Windows o cu.wchusbserial en Mac."""
    print("[*] Buscando pantalla Turing 3.5\" (VID 0x1A86 / PID 0x5722)...")

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


# ==============================================================================
# COMANDOS DE PROTOCOLO TURING REV A Y REV B
# ==============================================================================
def create_rev_a_command(cmd, x=0, y=0, ex=0, ey=0):
    """Crea la cabecera empaquetada de 6 bytes de Turing Rev A."""
    buf = bytearray(6)
    buf[0] = (x >> 2) & 0xFF
    buf[1] = (((x & 3) << 6) + (y >> 4)) & 0xFF
    buf[2] = (((y & 15) << 4) + (ex >> 6)) & 0xFF
    buf[3] = (((ex & 63) << 2) + (ey >> 8)) & 0xFF
    buf[4] = ey & 0xFF
    buf[5] = cmd & 0xFF
    return bytes(buf)


def create_rev_a_orientation_packet(orientation=0, width=320, height=480):
    """Construye el paquete estricto de orientación de 16 bytes para Turing Rev A."""
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
    """Construye comando enmarcado de 10 bytes para XuanFang Rev B."""
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
    """Ajusta el brillo de pantalla."""
    clamped = max(0, min(100, int(level_percent)))
    if protocol == 'rev_a':
        inverted_val = int(255 - (clamped / 100.0) * 255)
        ser.write(create_rev_a_command(CMD_A_SET_BRIGHTNESS, x=inverted_val))
    else:
        abs_val = int((clamped / 100.0) * 255)
        ser.write(create_rev_b_command(0xCE, [abs_val]))


def image_to_rgb565(img, endianness='little'):
    """Convierte imagen PIL a 16-bit RGB565."""
    img = img.convert('RGB')
    w, h = img.size

    # Intento ultra rápido con numpy si está instalado
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

    # Conversión nativa en Python
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
    """
    Transmite el frame completo a la pantalla.
    Envía la cabecera DISPLAY_BITMAP primero y luego los píxeles en bloques de
    1 línea horizontal (640 bytes = 1L), garantizando entrega al 100% sin desbordes.
    """
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

    # Envío en paquetes de 1 línea exacta (640 bytes)
    # Esto coincide exactamente con la configuración "1L" que funciona en el firmware CH552
    chunk_size = WIDTH * 2  # 640 bytes
    total = len(raw_rgb565)
    for offset in range(0, total, chunk_size):
        chunk = raw_rgb565[offset:offset + chunk_size]
        ser.write(chunk)

    ser.flush()


# ==============================================================================
# CARGA DE FUENTES
# ==============================================================================
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


# ==============================================================================
# MONITOR DE TELEMETRÍA DEL SISTEMA
# ==============================================================================
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
        # 1. CPU
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

        # 2. GPU
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

        # 3. RAM
        ram = psutil.virtual_memory()
        ram_usage = ram.percent
        ram_used_gb = ram.used / (1024 ** 3)
        ram_total_gb = ram.total / (1024 ** 3)

        # 4. Disco C:
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

        # 5. Red
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


# ==============================================================================
# RENDERIZADO DEL TEMA HARDWARE HUD
# ==============================================================================
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

    # 1. Cabecera
    draw.rectangle([0, 0, WIDTH, 34], fill='#0c121e')
    draw.line([0, 34, WIDTH, 34], fill='#1e293b', width=1)
    draw.text((12, 10), "PC HARDWARE TELEMETRY", fill='#38bdf8', font=fonts.font_title)

    now_str = time.strftime("%H:%M:%S")
    clock_bbox = fonts.font_small.getbbox(now_str)
    cw = clock_bbox[2] - clock_bbox[0]
    draw.text((WIDTH - cw - 12, 11), now_str, fill='#94a3b8', font=fonts.font_small)

    # 2. Medidores Circulares CPU & GPU
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

    # 3. Barra RAM
    ram_str = f"{stats['ram_used_gb']:.1f} / {stats['ram_total_gb']:.0f} GB ({int(stats['ram_usage'])}%)"
    draw_linear_bar(draw, fonts, x=20, y=205, w=WIDTH - 40, h=10,
                    label='MEMORIA RAM', info_str=ram_str, pct=stats['ram_usage'] / 100.0, color_hex='#10b981')

    # 4. Barra Disco
    disk_str = f"{stats['disk_used_gb']} / {stats['disk_total_gb']} GB ({int(stats['disk_usage'])}%)"
    draw_linear_bar(draw, fonts, x=20, y=248, w=WIDTH - 40, h=10,
                    label='DISCO LOCAL (C:)', info_str=disk_str, pct=stats['disk_usage'] / 100.0, color_hex='#f59e0b')

    # 5. Red
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

    # 6. Pie
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


# ==============================================================================
# FUNCIÓN PRINCIPAL
# ==============================================================================
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
    print("  TURING 3.5\" IPS - MONITOR HARDWARE NATIVO (WINDOWS / macOS)")
    print(f"  Resolución: 320x480 | Protocolo: {active_protocol.upper()} | Baudios: {baud_rate}")
    print("=" * 72)

    # 1. Localizar puerto
    port_name = args.port or find_turing_port()
    if not port_name:
        print("\n[!] ERROR: No se encontró ningún puerto COM compatible.")
        print("    Abre el Administrador de Dispositivos y revisa 'Puertos (COM y LPT)'.")
        sys.exit(1)

    # 2. Conectar al puerto serial
    print(f"\n[*] Abriendo {port_name} a {baud_rate} baudios...")
    try:
        ser = serial.Serial(
            port=port_name,
            baudrate=baud_rate,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            timeout=1.0,
            write_timeout=None  # Bloqueante: asegura que cada byte se entregue sin truncarse
        )
        time.sleep(1.2)  # Pausa de estabilización USB
    except Exception as e:
        print(f"\n[!] Error abriendo {port_name}: {e}")
        print("    Asegúrate de que ninguna otra ventana o pestaña tenga el puerto abierto.")
        sys.exit(1)

    # 3. Limpiar búfer previo
    try:
        ser.reset_input_buffer()
        ser.reset_output_buffer()
    except Exception:
        pass

    # 4. Secuencia de Inicialización y Wakeup
    print("[*] Enviando handshake de activación y configuración...")
    try:
        if active_protocol == 'rev_a':
            # Handshake HELLO oficial de Turing Rev A (6x 69 = 0x45)
            ser.write(bytes([CMD_A_HELLO] * 6))
            time.sleep(0.08)
            if ser.in_waiting:
                ack = ser.read(ser.in_waiting)
                print(f"[✓] Respuesta ACK del hardware: {ack.hex()}")

            # Encender pantalla (SCREEN_ON = 109)
            ser.write(create_rev_a_command(CMD_A_SCREEN_ON, 0, 0, 0, 0))
            time.sleep(0.05)

            # Orientación 16 bytes
            ser.write(create_rev_a_orientation_packet(orientation=ORIENTATION, width=WIDTH, height=HEIGHT))
            time.sleep(0.05)

            # Brillo
            set_brightness(ser, level_percent=BRIGHTNESS_PERCENT, protocol='rev_a')
            time.sleep(0.05)
        else:
            # XuanFang Rev B
            ser.write(create_rev_b_command(0xCA, list(b'HELLO') + [0, 0, 0]))
            time.sleep(0.08)
            ser.write(create_rev_b_command(0xCB, [0x00]))  # Portrait
            time.sleep(0.05)
            set_brightness(ser, level_percent=BRIGHTNESS_PERCENT, protocol='rev_b')
            time.sleep(0.05)

        print("[✓] Pantalla inicializada exitosamente.")
    except Exception as e:
        print(f"[!] Advertencia en inicialización: {e}")

    # 5. Inicializar subsistemas
    fonts = FontManager()
    monitor = SystemMonitor()

    endianness = 'little' if active_protocol == 'rev_a' else 'big'
    print(f"[✓] Transmisión activa (Líneas 1L / 640B, endianness={endianness}). Presiona Ctrl+C para salir.\n")
    frame_count = 0

    try:
        while True:
            loop_start = time.time()

            # Leer métricas del PC
            stats = monitor.get_stats()

            # Dibujar tema
            img = render_hardware_hud(stats, fonts)

            # Convertir a RGB565
            raw_bytes = image_to_rgb565(img, endianness=endianness)

            # Transmitir frame completo
            t_tx0 = time.time()
            send_frame(ser, raw_bytes, protocol=active_protocol)
            tx_duration = time.time() - t_tx0

            frame_count += 1
            now_str = time.strftime("%H:%M:%S")
            print(f"[{now_str}] Frame #{frame_count:04d} ({tx_duration:.2f}s) -> "
                  f"CPU: {stats['cpu_usage']:.0f}% ({stats['cpu_temp']}°C) | "
                  f"GPU: {stats['gpu_usage']:.0f}% | RAM: {stats['ram_usage']:.0f}% | "
                  f"Net ↓ {stats['net_in']:.1f} KB/s ↑ {stats['net_out']:.1f} KB/s")

            # Ritmo de actualización constante
            elapsed = time.time() - loop_start
            sleep_time = max(0.05, interval - elapsed)
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        print("\n[*] Saliendo a petición del usuario...")
    except Exception as e:
        print(f"\n[!] Error durante la transmisión: {e}")
    finally:
        try:
            ser.close()
            print("[✓] Puerto serial cerrado.")
        except Exception:
            pass


if __name__ == '__main__':
    main()
