from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "images"
SIZE = 1024

image = Image.new("RGBA", (SIZE, SIZE), "#EAF6EC")
draw = ImageDraw.Draw(image)

# A deliberately simple, full-bleed Homlo mark: a deep-green location/search ring
# with a white H-like counter, designed to remain legible at launcher sizes.
draw.ellipse((196, 196, 828, 828), fill="#0F5C2B")
draw.ellipse((326, 326, 698, 698), fill="#EAF6EC")
draw.rounded_rectangle((415, 328, 520, 700), radius=46, fill="#22A447")
draw.rounded_rectangle((504, 328, 609, 700), radius=46, fill="#22A447")
draw.rounded_rectangle((415, 452, 609, 557), radius=42, fill="#22A447")
draw.polygon([(679, 686), (858, 858), (810, 906), (632, 727)], fill="#0F5C2B")

for filename in ("icon.png", "splash-icon.png", "favicon.png", "android-icon-foreground.png"):
    image.save(ASSET_DIR / filename, format="PNG", optimize=True)
