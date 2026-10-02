#!/usr/bin/env python3
"""
generate_brand_assets.py

Processes the NovaSaas Enterprise Solutions brand logo:
1. Extracts the transparent logo (full and emblem icon).
2. Generates Google Play Store 512x512 App Icon.
3. Generates Google Play Store 1024x500 Feature Graphic.
4. Generates Website Favicons, Banners, and App Icons.
5. Updates Android App launcher icons across all mipmap densities.
"""

import os
import shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SOURCE_IMAGE = r"C:\Users\lokes\.gemini\antigravity-ide\brain\6a12acf0-b53c-46ec-8fac-826eaaf3cc7f\.user_uploaded\media_1790842515873.png"
OUTPUT_DIR = r"c:\novapos\playstore-assets"
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("--> Loading source brand image...")
src = Image.open(SOURCE_IMAGE).convert("RGBA")
w, h = src.size

# 1. Create transparent logo
print("--> Generating transparent logo...")
arr = np.array(src, dtype=np.float32)
r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

# The background is characterized by high brightness and light cyan/blue/white tint
# Logo foreground elements have strong saturation and darker blues
# Compute luminance / brightness
luminance = 0.299 * r + 0.587 * g + 0.114 * b

# In the logo:
# Background has high luminance (> 180) and low color difference compared to background gradient
# Foreground (text and rocket emblem) has darker colors (luminance < 165)
# Compute alpha mask
alpha = np.zeros_like(luminance, dtype=np.uint8)

# Foreground mask
is_fg = luminance < 168
alpha[is_fg] = 255

# Smooth edges (anti-aliasing)
trans_band = (luminance >= 168) & (luminance < 195)
alpha[trans_band] = np.clip((195 - luminance[trans_band]) / 27.0 * 255, 0, 255).astype(np.uint8)

# Where alpha is active, keep original RGB, or enhance color depth slightly
clean_arr = np.dstack([arr[:, :, :3].astype(np.uint8), alpha])
logo_transparent = Image.fromarray(clean_arr, mode="RGBA")

# Crop to non-transparent bounding box
bbox = logo_transparent.getbbox()
if bbox:
    logo_cropped = logo_transparent.crop(bbox)
else:
    logo_cropped = logo_transparent

logo_trans_path = os.path.join(OUTPUT_DIR, "novasaas-logo-transparent.png")
logo_cropped.save(logo_trans_path, "PNG")
print(f"    Saved: {logo_trans_path} (size: {logo_cropped.size})")

# 2. Extract Emblem Only (Rocket + Cloud)
print("--> Extracting Rocket emblem icon...")
# Emblem is on the left roughly in x: 0 to 300 in cropped
emblem_w = int(logo_cropped.width * 0.32)
emblem = logo_cropped.crop((0, 0, emblem_w, logo_cropped.height))
emblem_bbox = emblem.getbbox()
if emblem_bbox:
    emblem = emblem.crop(emblem_bbox)

emblem_trans_path = os.path.join(OUTPUT_DIR, "novasaas-emblem-transparent.png")
emblem.save(emblem_trans_path, "PNG")
print(f"    Saved: {emblem_trans_path} (size: {emblem.size})")

# 3. Generate Google Play Store 512x512 App Icon
# Google Play requires EXACTLY 512x512, 32-bit PNG, NO transparency on icon
print("--> Generating Google Play 512x512 App Icon...")
icon_512 = Image.new("RGBA", (512, 512), (255, 255, 255, 255))
# Create modern smooth premium gradient background: crisp deep navy to royal cyan
draw_icon = ImageDraw.Draw(icon_512)
for y in range(512):
    ratio = y / 511.0
    # Gradient from rich deep navy #0f172a to sleek slate cyan #1e293b
    nr = int(15 * (1 - ratio) + 30 * ratio)
    ng = int(23 * (1 - ratio) + 41 * ratio)
    nb = int(42 * (1 - ratio) + 59 * ratio)
    draw_icon.line([(0, y), (512, y)], fill=(nr, ng, nb, 255))

# Fit emblem inside 512x512 (target ~340x340 for standard Google Play squircle margin)
target_emblem_size = 350
emblem_aspect = emblem.width / emblem.height
if emblem_aspect > 1:
    new_ew = target_emblem_size
    new_eh = int(target_emblem_size / emblem_aspect)
else:
    new_eh = target_emblem_size
    new_ew = int(target_emblem_size * emblem_aspect)

emblem_resized = emblem.resize((new_ew, new_eh), Image.Resampling.LANCZOS)

# Create a subtle glowing backdrop for the emblem
glow = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow)
glow_draw.ellipse(
    [256 - 190, 256 - 190, 256 + 190, 256 + 190],
    fill=(56, 189, 248, 55) # Cyan glow
)
glow = glow.filter(ImageFilter.GaussianBlur(35))
icon_512.paste(glow, (0, 0), glow)

# Center the emblem
pos_x = (512 - new_ew) // 2
pos_y = (512 - new_eh) // 2
icon_512.paste(emblem_resized, (pos_x, pos_y), emblem_resized)

# Convert to RGB (No alpha channel for Play Store Icon)
icon_512_rgb = icon_512.convert("RGB")
icon_512_path = os.path.join(OUTPUT_DIR, "google-play-icon-512x512.png")
icon_512_rgb.save(icon_512_path, "PNG")
print(f"    Saved: {icon_512_path}")

# Also create White-Background 512x512 version (Clean Minimalist Option)
icon_512_white = Image.new("RGB", (512, 512), (255, 255, 255))
icon_512_white.paste(emblem_resized, (pos_x, pos_y), emblem_resized)
icon_512_white_path = os.path.join(OUTPUT_DIR, "google-play-icon-512x512-white.png")
icon_512_white.save(icon_512_white_path, "PNG")
print(f"    Saved: {icon_512_white_path}")

# 4. Generate Google Play 1024x500 Feature Graphic
# Google Play requires EXACTLY 1024x500 px, JPEG or 24-bit PNG (no alpha)
print("--> Generating Google Play 1024x500 Feature Graphic...")
feat = src.resize((1024, 590), Image.Resampling.LANCZOS)
# Crop 590 height to 500 height centered
top = (590 - 500) // 2
feat_cropped = feat.crop((0, top, 1024, top + 500)).convert("RGB")
feat_path = os.path.join(OUTPUT_DIR, "google-play-feature-graphic-1024x500.png")
feat_cropped.save(feat_path, "PNG")
print(f"    Saved: {feat_path}")

# 5. Generate Favicons and Web Assets
print("--> Generating Web Favicons...")
for sz in [16, 32, 64, 192, 512]:
    fav = emblem.resize((sz, sz), Image.Resampling.LANCZOS)
    fav_path = os.path.join(OUTPUT_DIR, f"favicon-{sz}x{sz}.png")
    fav.save(fav_path, "PNG")

# ICO file
emblem.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(OUTPUT_DIR, "favicon.ico"), format="ICO")
print("    Saved favicons in all standard web dimensions.")

# 6. Copy assets to project public directories
print("--> Copying assets to Web App & Android App directories...")
# Landing
shutil.copy2(logo_trans_path, r"c:\novapos\apps\landing\public\brand-logo.png")
shutil.copy2(icon_512_path, r"c:\novapos\apps\landing\public\app-icon.png")
shutil.copy2(os.path.join(OUTPUT_DIR, "favicon-32x32.png"), r"c:\novapos\apps\landing\public\favicon.png")

# Admin
shutil.copy2(logo_trans_path, r"c:\novapos\apps\admin\public\brand-logo.png")
shutil.copy2(icon_512_path, r"c:\novapos\apps\admin\public\app-icon.png")
shutil.copy2(os.path.join(OUTPUT_DIR, "favicon-32x32.png"), r"c:\novapos\apps\admin\public\favicon.png")

# POS
shutil.copy2(logo_trans_path, r"c:\novapos\apps\pos\public\brand-logo.png")
shutil.copy2(icon_512_path, r"c:\novapos\apps\pos\public\app-icon.png")

# Android mipmap launcher icons
res_dir = r"c:\novapos\apps\pos\android\app\src\main\res"
densities = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

for folder, size in densities.items():
    target_folder = os.path.join(res_dir, folder)
    if os.path.isdir(target_folder):
        ic = icon_512.resize((size, size), Image.Resampling.LANCZOS)
        ic.save(os.path.join(target_folder, "ic_launcher.png"), "PNG")
        ic.save(os.path.join(target_folder, "ic_launcher_round.png"), "PNG")
        print(f"    Updated Android icon {folder} ({size}x{size})")

print("\n✓ ALL BRAND & PLAY STORE ASSETS GENERATED SUCCESSFULLY!")
