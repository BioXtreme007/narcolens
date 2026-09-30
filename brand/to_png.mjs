// Render brand SVGs to the PNGs Expo needs (icons must be PNG). Run: node to_png.mjs  (uses sharp via npx cache)
import sharp from 'sharp';
import { readFileSync } from 'fs';
const jobs = [
  ['svg/app-icon.svg', 'png/icon.png', 1024],
  ['svg/adaptive-foreground.svg', 'png/android-icon-foreground.png', 1024],
  ['svg/adaptive-background.svg', 'png/android-icon-background.png', 1024],
  ['svg/adaptive-monochrome.svg', 'png/android-icon-monochrome.png', 1024],
  ['svg/splash-icon.svg', 'png/splash-icon.png', 512],
  ['svg/mark.svg', 'png/favicon.png', 96],
];
for (const [src, out, size] of jobs) {
  await sharp(readFileSync(src), { density: 600 }).resize(size, size).png().toFile(out);
  console.log('wrote', out);
}
