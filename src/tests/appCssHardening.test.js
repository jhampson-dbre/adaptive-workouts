import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/App.css', 'utf8');
const declarationsFor = selector => css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'i'))?.[1] ?? '';

describe('baseline and private-access CSS hardening', () => {
  it('keeps programmatic focus aligned with the approved focus treatment', () => {
    const baselineFocus = declarationsFor('.baseline-bootstrap h2:focus,\n.baseline-bootstrap:focus,\n.baseline-focus-target:focus');

    expect(baselineFocus).toMatch(/outline:\s*4px solid #1261a0/i);
    expect(baselineFocus).not.toMatch(/var\(--accent/i);
    expect(baselineFocus).toMatch(/outline-offset:\s*3px/i);
    const accessFocus = declarationsFor('.access-surface h1:focus');
    expect(accessFocus).toMatch(/outline:\s*4px solid #1261a0/i);
    expect(accessFocus).not.toMatch(/var\(--accent/i);
  });

  it('keeps baseline and access surfaces contained in dynamic viewports', () => {
    for (const selector of ['.baseline-bootstrap', '.access-surface']) {
      const declarations = declarationsFor(selector);

      expect(declarations).toMatch(/min-height:\s*100dvh/i);
      expect(declarations).toMatch(/overflow-wrap:\s*anywhere/i);
    }
  });

  it('allows identity and action content to shrink and wrap under long translations', () => {
    const identity = declarationsFor('.access-identity');
    expect(identity).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 2fr\)/i);
    expect(identity).not.toMatch(/max-content/i);
    expect(declarationsFor('.access-identity :is(dt, dd)')).toMatch(/min-inline-size:\s*0/i);
    expect(declarationsFor('.access-identity dd')).not.toMatch(/overflow-wrap/i);
    expect(declarationsFor('.access-actions button')).toMatch(/min-inline-size:\s*44px[^}]*min-block-size:\s*44px[^}]*max-inline-size:\s*100%[^}]*overflow-wrap:\s*anywhere/is);
    expect(declarationsFor('.baseline-retry')).toMatch(/min-inline-size:\s*44px[^}]*min-block-size:\s*44px[^}]*max-inline-size:\s*100%[^}]*overflow-wrap:\s*anywhere/is);
    expect(declarationsFor('.access-actions')).toMatch(/margin-block-start:\s*1\.5rem/i);
  });
});
