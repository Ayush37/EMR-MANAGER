#!/bin/bash

# Create logo192.svg
cat > public/logo192.svg << 'SVG'
<svg width="192" height="192" viewBox="0 0 192 192" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="192" height="192" fill="#FF9900"/>
  <text x="96" y="108" font-family="Arial" font-size="48" text-anchor="middle" fill="white">EMR</text>
</svg>
SVG

# Create logo512.svg
cat > public/logo512.svg << 'SVG'
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#FF9900"/>
  <text x="256" y="288" font-family="Arial" font-size="128" text-anchor="middle" fill="white">EMR</text>
</svg>
SVG

# Note: You would need to convert these SVGs to PNGs for use in manifest.json
# For a quick development setup, just copy them to .png files as placeholders
cp public/logo192.svg public/logo192.png
cp public/logo512.svg public/logo512.png

echo "Logo files created."
