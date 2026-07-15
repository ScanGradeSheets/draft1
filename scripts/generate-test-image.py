#!/usr/bin/env python3
"""Generate calibrated test worksheet with markers at 5%/95% coordinates."""
from PIL import Image, ImageDraw

WIDTH = 1920
HEIGHT = 1080
MARKER_SIZE = 100

# Create white background
img = Image.new('RGB', (WIDTH, HEIGHT), 'WHITE')
draw = ImageDraw.Draw(img)

# Calculate marker positions (5% and 95%)
tlX = WIDTH * 0.05
tlY = HEIGHT * 0.05
trX = WIDTH * 0.95
trY = HEIGHT * 0.05
brX = WIDTH * 0.95
brY = HEIGHT * 0.95
blX = WIDTH * 0.05
blY = HEIGHT * 0.95

# Draw black square markers
draw.rectangle([tlX - MARKER_SIZE//2, tlY - MARKER_SIZE//2,
                tlX + MARKER_SIZE//2, tlY + MARKER_SIZE//2], fill='BLACK')
draw.rectangle([trX - MARKER_SIZE//2, trY - MARKER_SIZE//2,
                trX + MARKER_SIZE//2, trY + MARKER_SIZE//2], fill='BLACK')
draw.rectangle([brX - MARKER_SIZE//2, brY - MARKER_SIZE//2,
                brX + MARKER_SIZE//2, brY + MARKER_SIZE//2], fill='BLACK')
draw.rectangle([blX - MARKER_SIZE//2, blY - MARKER_SIZE//2,
                blX + MARKER_SIZE//2, blY + MARKER_SIZE//2], fill='BLACK')

# Add fake digit boxes for visual reference
for row in range(2):
    for col in range(5):
        boxX = WIDTH * 0.2 + col * (WIDTH * 0.12)
        boxY = HEIGHT * 0.2 + row * (HEIGHT * 0.25)
        draw.rectangle([boxX, boxY, boxX + 100, boxY + 100], outline='#CCCCCC', width=2)

# Save
output_path = '/Users/openclaw/.openclaw/workspace/scan-grade/public/test-worksheet-calibrated.png'
img.save(output_path, 'PNG')
print(f'✅ Generated: {output_path}')
print(f'   Markers at: 5% and 95% coordinates')
print(f'   TL: {tlX}, {tlY}')
print(f'   TR: {trX}, {trY}')
print(f'   BR: {brX}, {brY}')
print(f'   BL: {blX}, {blY}')
