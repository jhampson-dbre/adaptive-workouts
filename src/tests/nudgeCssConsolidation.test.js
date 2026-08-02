import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appCss = readFileSync('src/App.css', 'utf8');
const indexCss = readFileSync('src/index.css', 'utf8');
const palette = {
  text: '#454545',
  'text-h': '#050505',
  bg: '#f0eee7',
  border: '#101010',
  'code-bg': '#ffffff',
  accent: '#ffd400',
  'accent-bg': '#fff2a8',
  'accent-border': '#8a7200',
  'social-bg': '#e5e2d9',
  focus: '#1261a0',
  error: '#721c24',
};

describe('Nudge CSS consolidation', () => {
  it('does not ship the superseded starter layers', () => {
    expect(indexCss).not.toContain('/* Generator & App Styles */');
    expect(indexCss).not.toContain('/* WorkoutView Styles */');
    expect(appCss).not.toContain('.hero {');
    expect(appCss).not.toContain('#next-steps {');
  });

  it('keeps active utility and private-access rules on Nudge tokens', () => {
    expect(indexCss).toMatch(/\.visually-hidden\s*\{/);
    expect(indexCss).toMatch(/--accent:\s*#ffd400/);
    expect(appCss).toMatch(/\.access-action-primary\s*\{[^}]*background:\s*var\(--accent\)/);
  });

  it('uses palette tokens outside the root definitions', () => {
    const rootCss = indexCss.match(/:root\s*\{[\s\S]*?\}/)?.[0] ?? '';
    const downstreamCss = indexCss.replace(rootCss, '');

    for (const [token, color] of Object.entries(palette)) {
      expect(rootCss).toMatch(new RegExp(`--${token}:\\s*${color}`, 'i'));
      expect(downstreamCss).not.toContain(color);
    }
  });

  it('keeps the live Settings catalog list and action layout rules', () => {
    expect(indexCss).toMatch(/\.catalog-list ul\s*\{[^}]*list-style:\s*none[^}]*padding:\s*0[^}]*margin:\s*0/s);
    expect(indexCss).toMatch(/\.item-display\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between[^}]*align-items:\s*center[^}]*flex-wrap:\s*wrap[^}]*gap:\s*12px/s);
  });

  it('keeps the live Settings tracking field layout', () => {
    expect(indexCss).toMatch(/\.tracking-fields\s*\{[^}]*display:\s*flex[^}]*flex:\s*1\s+1\s+100%[^}]*gap:\s*12px[^}]*flex-wrap:\s*wrap[^}]*align-items:\s*end/s);
    expect(indexCss).toMatch(/\.add-form \.tracking-field:has\(select\),\s*\.edit-form \.tracking-field:has\(select\)\s*\{[^}]*flex:\s*1\s+1\s+200px/s);
  });
});
