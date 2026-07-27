import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/App.css', 'utf8');
const foregroundValue = css.match(/\.access-action-primary\s*\{[^}]*color:\s*([^;]+)/i)?.[1].trim().toLowerCase();
const foreground = { white: '#ffffff', black: '#000000' }[foregroundValue] ?? foregroundValue;
const channel = value => { const normalized = value / 255; return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4; };
const luminance = hex => 0.2126 * channel(parseInt(hex.slice(1, 3), 16)) + 0.7152 * channel(parseInt(hex.slice(3, 5), 16)) + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
const contrast = (left, right) => { const values = [luminance(left), luminance(right)].sort((a, b) => b - a); return (values[0] + 0.05) / (values[1] + 0.05); };

describe('private access primary action contrast', () => {
  it.each([['light', '#aa3bff'], ['dark', '#c084fc']])('meets WCAG AA against the %s accent', (_theme, accent) => {
    expect(foreground).toBeTruthy(); expect(contrast(accent, foreground)).toBeGreaterThanOrEqual(4.5);
  });
});
