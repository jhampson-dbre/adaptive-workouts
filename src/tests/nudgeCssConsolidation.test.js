import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appCss = readFileSync('src/App.css', 'utf8');
const indexCss = readFileSync('src/index.css', 'utf8');

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

  it('keeps the live Settings catalog list and action layout rules', () => {
    expect(indexCss).toMatch(/\.catalog-list ul\s*\{[^}]*list-style:\s*none[^}]*padding:\s*0[^}]*margin:\s*0/s);
    expect(indexCss).toMatch(/\.item-display\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between[^}]*align-items:\s*center[^}]*flex-wrap:\s*wrap[^}]*gap:\s*12px/s);
  });

  it('keeps the live Settings tracking field layout', () => {
    expect(indexCss).toMatch(/\.tracking-fields\s*\{[^}]*display:\s*flex[^}]*flex:\s*1\s+1\s+100%[^}]*gap:\s*12px[^}]*flex-wrap:\s*wrap[^}]*align-items:\s*end/s);
    expect(indexCss).toMatch(/\.add-form \.tracking-field:has\(select\),\s*\.edit-form \.tracking-field:has\(select\)\s*\{[^}]*flex:\s*1\s+1\s+200px/s);
  });
});
