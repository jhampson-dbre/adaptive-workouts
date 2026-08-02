import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/App.css', 'utf8');
const indexCss = readFileSync('src/index.css', 'utf8');
const rootCss = indexCss.match(/:root\s*\{[\s\S]*?\}/)?.[0] ?? '';
const settings = readFileSync('src/components/Settings.jsx', 'utf8');
const login = readFileSync('src/components/Login.jsx', 'utf8');
const resolveColor = value => {
  const token = value.match(/^var\((--[^)]+)\)$/)?.[1];
  return token ? rootCss.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1].toLowerCase() : value;
};
const foregroundValue = css.match(/\.access-action-primary\s*\{[^}]*color:\s*([^;]+)/i)?.[1].trim().toLowerCase();
const foreground = { white: '#ffffff', black: '#000000' }[foregroundValue] ?? foregroundValue;
const errorRule = indexCss.match(/(?:^|})\s*(\.error-message\s*\{[^}]*})/i)?.[1] ?? '';
const errorForeground = resolveColor(errorRule.match(/color:\s*([^;]+)/i)?.[1].trim().toLowerCase());
const errorBackground = resolveColor(errorRule.match(/background:\s*([^;]+)/i)?.[1].trim().toLowerCase());
const channel = value => { const normalized = value / 255; return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4; };
const luminance = hex => 0.2126 * channel(parseInt(hex.slice(1, 3), 16)) + 0.7152 * channel(parseInt(hex.slice(3, 5), 16)) + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
const contrast = (left, right) => { const values = [luminance(left), luminance(right)].sort((a, b) => b - a); return (values[0] + 0.05) / (values[1] + 0.05); };

describe('private access primary action contrast', () => {
  it.each([['light', '#aa3bff'], ['dark', '#c084fc']])('meets WCAG AA against the %s accent', (_theme, accent) => {
    expect(foreground).toBeTruthy(); expect(contrast(accent, foreground)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Settings and Login error contrast', () => {
  it.each(['Settings Leg Day warning', 'Login sign-in error'])('uses the Nudge error treatment for %s', surface => {
    const source = surface.startsWith('Settings') ? settings : login;
    expect(source).toMatch(/className=.*error-message/);
    expect(errorForeground).toBe('#ffffff');
    expect(errorBackground).toBe('#721c24');
    expect(contrast(errorForeground, errorBackground)).toBeGreaterThanOrEqual(4.5);
  });
});
