import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve('src/design-system/design-system.css');
const css = fs.readFileSync(cssPath, 'utf8');

const readToken = (tokenName) => {
  const match = css.match(new RegExp(`--ds-${tokenName}:\\s*([^;]+);`));
  if (!match) return null;
  return match[1].trim();
};

const hexToRgb = (hex) => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
};

const srgbToLinear = (channel) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
};

const contrastRatio = (fg, bg) => {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

const lightTokens = {
  main: ['#111827', '#f5f7fb'],
  muted: ['#5b6475', '#f5f7fb'],
  primary: ['#ffffff', '#2946c6'],
  success: ['#0f6b4c', '#f5f7fb'],
  warning: ['#7a4d00', '#f5f7fb'],
  danger: ['#9f1837', '#f5f7fb'],
};

const darkTokens = {
  main: ['#edf2ff', '#0b1320'],
  muted: ['#c8d3ea', '#0b1320'],
  primary: ['#ffffff', '#2946c6'],
  success: ['#78e6a5', '#0b1320'],
  warning: ['#f7c35e', '#0b1320'],
  danger: ['#ff8b8b', '#0b1320'],
};

const printSummary = (label, pairs) => {
  console.log(`${label}`);
  for (const [key, [fg, bg]] of Object.entries(pairs)) {
    const ratio = contrastRatio(fg, bg);
    console.log(`  ${key}: ${ratio.toFixed(2)}:1`);
  }
};

printSummary('Light theme', lightTokens);
printSummary('Dark theme', darkTokens);
