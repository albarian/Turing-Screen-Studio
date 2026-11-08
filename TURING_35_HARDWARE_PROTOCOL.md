# Technical Hardware & Protocol Specification: Turing 3.5" IPS USB Screen

This documentation contains low-level specifications, firmware peculiarities, binary packet structures, and reverse-engineering findings for the **3.5-inch IPS USB secondary display (Turing Smart Screen Rev A / Turzx / XuanFang)**.

---

## 1. Hardware Identification & Architecture

| Parameter | Technical Specification |
| :--- | :--- |
| **LCD Panel** | 3.5" IPS (Physical resolution: 320 × 480 pixels, 65,536 colors) |
| **Display Controller** | ILI9488 or ST7796 (internal 16-bit parallel/SPI bus) |
| **MCU & USB Bridge** | WCH CH552 (enhanced 8051 MCU with Full-Speed 12 Mbps USB transceiver) + WCH CH340 (USB-to-UART bridge) |
| **USB Vendor ID (VID)** | `0x1A86` (QinHeng Electronics / WCH) |
| **USB Product ID (PID)** | `0x5722` (Turing Smart Screen Rev A) |
| **Standard UART Baud Rate** | **115200 bps** (8 data bits, no parity, 1 stop bit: `8N1`) |
| **Flow Control** | `None` (Simplex transmission from PC to display during active rendering) |
| **Physical Ports** | 2 × USB Type-C ports: **Bottom** (portrait mount) and **Side** (landscape desk stand). **Never connect both cables simultaneously!** |

---

## 2. Color Format & Pixel Frame Buffer

- **Pixel Format:** 16-bit **RGB565 Little-Endian**.
- **Bit Allocation:** 5 bits Red (bits 11–15), 6 bits Green (bits 5–10), 5 bits Blue (bits 0–4).
- **Byte Order:** **Little-Endian (LSB first, MSB second)**.
  - Byte 0 (low): `rgb & 0xFF`
  - Byte 1 (high): `(rgb >> 8) & 0xFF`
- *(Note: Chinese clone firmwares such as XuanFang Rev B expect Big-Endian; official Turing Rev A screens strictly require Little-Endian).*

### RGB565 Bit-Packing Formula (Python / C / TypeScript):
```python
# Pack standard 24-bit RGB into 16-bit RGB565 integer
rgb = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)

# Little-Endian byte splitting for Turing Rev A:
byte_lsb = rgb & 0xFF
byte_msb = (rgb >> 8) & 0xFF
```

### Buffer Dimensions & Scanline Chunk Sizes:
- **Portrait Mode (Vertical):** 320 width × 480 height = 153,600 pixels = **307,200 bytes**.
  - Scanline chunk (`1L`): $320 \times 2 = \mathbf{640\text{ bytes}}$.
- **Landscape Mode (Horizontal):** 480 width × 320 height = 153,600 pixels = **307,200 bytes**.
  - Scanline chunk (`1L`): $480 \times 2 = \mathbf{960\text{ bytes}}$.

---

## 3. Opcodes & Command Sequences (Turing Rev A)

The Turing Rev A architecture uses compact **6-byte bit-packed** packets for general commands, and a specialized **16-byte** packet for display rotation and raster geometry.

### 3.1. 6-Byte Bit-Packed Header Format
For commands accepting coordinate bounding boxes `(x, y, ex, ey)`:
```
Byte 0: (x >> 2) & 0xFF
Byte 1: (((x & 3) << 6) + (y >> 4)) & 0xFF
Byte 2: (((y & 15) << 4) + (ex >> 6)) & 0xFF
Byte 3: (((ex & 63) << 2) + (ey >> 8)) & 0xFF
Byte 4: ey & 0xFF
Byte 5: opcode & 0xFF
```

### 3.2. Official Command Reference (Rev A)

| Opcode (Dec) | Opcode (Hex) | Command Name | Description & Parameters |
| :---: | :---: | :--- | :--- |
| **`69`** | `0x45` | **HELLO** | Wake-up handshake. Transmitted as a 6-byte burst: `[69, 69, 69, 69, 69, 69]`. Wakes the controller from sleep mode. |
| **`109`** | `0x6D` | **SCREEN_ON** | Enables video output to the LCD panel. Header: `[0, 0, 0, 0, 0, 109]`. |
| **`108`** | `0x6C` | **SCREEN_OFF** | Puts LCD panel into power-saving blank mode: `[0, 0, 0, 0, 0, 108]`. |
| **`110`** | `0x6E` | **SET_BRIGHTNESS** | Adjusts LED backlight duty cycle. **Inverted scale:** `0 = 100% full brightness`, `255 = 0% backlight off`. Stored in the `x` coordinate parameter. |
| **`121`** | `0x79` | **SET_ORIENTATION** | Sets raster orientation and pixel dimensions. Requires 16-byte configuration packet. |
| **`197`** | `0xC5` | **DISPLAY_BITMAP** | Initiates frame transmission. Bounding box: `x=0, y=0, ex=width-1, ey=height-1`. Must be immediately followed by exactly 307,200 pixel bytes. |
| **`101`** | `0x65` | **RESET** | Software reset for the CH552 microcontroller. |
| **`102`** | `0x66` | **CLEAR** | Clears the entire frame buffer to pure white (`0xFFFF`). |

---

## 4. 16-Byte Orientation Packet Structure

To configure physical display rotation on the Turing Rev A:

```python
buf = bytearray(16)
buf[0] = 0
buf[1] = 0
buf[2] = 0
buf[3] = 0
buf[4] = 0
buf[5] = 121                     # CMD_SET_ORIENTATION
buf[6] = (orientation + 100)     # Rotation code (+100)
buf[7] = (width >> 8) & 0xFF     # Width High Byte
buf[8] = width & 0xFF            # Width Low Byte
buf[9] = (height >> 8) & 0xFF    # Height High Byte
buf[10] = height & 0xFF          # Height Low Byte
# Bytes 11 through 15 must be 0x00
```

### Orientation Index Values:
- `orientation = 0`: **Default Portrait** (320 × 480) -> `buf[6] = 100`.
- `orientation = 1`: **Reverse Portrait** (320 × 480) -> `buf[6] = 101`.
- `orientation = 2`: **Default Landscape** (480 × 320) -> `buf[6] = 102`.
- `orientation = 3`: **Reverse Landscape** (480 × 320) -> `buf[6] = 103`.

---

## 5. Critical Engineering Findings (White Screen & Horizontal Jitter)

### 5.1. Why Does the Screen Stay Pure White?
1. **Missing `HELLO` & `SCREEN_ON` Handshake:**
   Upon USB connection, the ST7796/ILI9488 panel initializes in sleep mode with backlight enabled, appearing as **pure blank white**. If the software fails to send the wake burst `[69, 69, 69, 69, 69, 69]` followed by opcode `109` (`SCREEN_ON`), the controller discards incoming `DISPLAY_BITMAP` frames.
2. **Win32 `write_timeout` Buffer Dropping:**
   If a COM port is opened with `write_timeout=2.0` (or another small non-zero value) and software attempts to write the entire 307,206-byte payload in a single synchronous call, the Windows Win32 `WriteFile` driver silently drops the transfer after writing ~8–16 KB.
   Because the CH552 MCU strictly waits for all 307,200 bytes before committing the raster, it hangs indefinitely and **the screen never updates**.

### 5.2. Why Did Horizontal Drift & Periodic Jumps Occur?
1. **CH552 USB FIFO Overflow:**
   The CH552 is an 8-bit 8051-derivative microcontroller with 64-byte USB endpoints.
   If the 6-byte header is merged into the pixel payload or arbitrary buffer cuts occur across scanline boundaries, circular buffer underruns occur. Losing just **2 bytes** (1 pixel) shifts all subsequent scanlines by 1 pixel, producing **diagonal tearing or zigzag raster distortion**.
2. **The 1L Scanline Rule (Strict Synchronization):**
   - **Step 1:** Transmit the 6-byte `DISPLAY_BITMAP` header independently.
   - **Step 2:** Transmit raw RGB565 bytes partitioned into exact single scanlines (`1L`):
     - In Portrait: exact chunks of **640 bytes** (320 pixels × 2).
     - In Landscape: exact chunks of **960 bytes** (480 pixels × 2).
   - **Step 3:** In Python `pyserial`, configure `write_timeout=None` to ensure atomic OS delivery of all 307,200 bytes.

---

## 6. Clone Hardware Comparison (XuanFang Rev B)

If using a variant manufactured by XuanFang:
- **Packet Structure:** Uses 10-byte framed packets: `[CMD, d0, d1, d2, d3, d4, d5, d6, d7, CMD]`.
- **Rev B Opcodes:**
  - `HELLO`: `0xCA` (with ASCII payload `'H','E','L','L','O'`)
  - `SET_ORIENTATION`: `0xCB` (`[0x00]` for portrait, `[0x01]` for landscape)
  - `DISPLAY_BITMAP`: `0xCC` (`[0, 0, 0, 0, x1_h, x1_l, y1_h, y1_l]`)
  - `SET_BRIGHTNESS`: `0xCE` (`[0-255]`, 255 = maximum brightness)
- **Pixel Byte Order:** **Big-Endian** (MSB first, LSB second).

---

## 7. Minimal Python Transmission Script (Quick Reference)

```python
import serial
import time

WIDTH = 320   # Use 480 for landscape
HEIGHT = 480  # Use 320 for landscape
BAUDRATE = 115200

# 1. Open COM port with write_timeout=None
ser = serial.Serial("COM3", BAUDRATE, timeout=1.0, write_timeout=None)
time.sleep(1.2)

# 2. Wake-up handshake
ser.write(bytes([69, 69, 69, 69, 69, 69]))  # HELLO burst
time.sleep(0.08)
ser.write(bytes([0, 0, 0, 0, 0, 109]))       # SCREEN_ON opcode
time.sleep(0.05)

# 3. Configure orientation (16 bytes)
orient_pkt = bytearray(16)
orient_pkt[5] = 121
orient_pkt[6] = 100  # 100=Portrait 320x480, 102=Landscape 480x320
orient_pkt[7] = (WIDTH >> 8) & 0xFF
orient_pkt[8] = WIDTH & 0xFF
orient_pkt[9] = (HEIGHT >> 8) & 0xFF
orient_pkt[10] = HEIGHT & 0xFF
ser.write(bytes(orient_pkt))
time.sleep(0.05)

# 4. Transmit Bitmap
# 4.1 6-Byte DISPLAY_BITMAP header
header = bytearray(6)
header[0] = 0
header[1] = 0
header[2] = (((WIDTH - 1) >> 6)) & 0xFF
header[3] = ((((WIDTH - 1) & 63) << 2) + ((HEIGHT - 1) >> 8)) & 0xFF
header[4] = (HEIGHT - 1) & 0xFF
header[5] = 197
ser.write(bytes(header))

# 4.2 Stream RGB565 Little-Endian bytes in 1L chunks (WIDTH * 2 bytes)
line_chunk = WIDTH * 2
for offset in range(0, len(raw_rgb565_bytes), line_chunk):
    ser.write(raw_rgb565_bytes[offset:offset + line_chunk])
ser.flush()
```
