import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/index.css', 'utf8');

function declarationsFor(selector) {
  return css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'i'))?.[1] ?? '';
}

function pixelDeclaration(declarations, property) {
  return Number(declarations.match(new RegExp(`${property}:\\s*(\\d+)px`, 'i'))?.[1]);
}

function settingsControlDeclarations() {
  return css.match(/\.settings-view\s*:is\(button,\s*input,\s*select\)\s*\{([^}]*)\}/i)?.[1] ?? '';
}

function workoutButtonDeclarations() {
  return css.match(/\.workout-view\s+button\s*\{([^}]*)\}/i)?.[1] ?? '';
}

describe('touch target stylesheet contract', () => {
  it('keeps measured controls at least 44px tall in every state', () => {
    expect(pixelDeclaration(declarationsFor('.exercise-toggle'), 'min-height')).toBeGreaterThanOrEqual(44);
    expect(pixelDeclaration(declarationsFor('.set-input input'), 'min-height')).toBeGreaterThanOrEqual(44);
    expect(pixelDeclaration(declarationsFor('.set-timing button'), 'min-height')).toBeGreaterThanOrEqual(44);
    expect(declarationsFor('.set-timing button:disabled')).not.toMatch(/min-height/i);
    expect(pixelDeclaration(declarationsFor('.settings-toggle'), 'min-height')).toBeGreaterThanOrEqual(44);
  });

  it('gives non-disclosure controls a 44px minimum width without constraining the full-width disclosure', () => {
    expect(pixelDeclaration(declarationsFor('.set-timing button'), 'min-width')).toBeGreaterThanOrEqual(44);
    expect(pixelDeclaration(declarationsFor('.settings-toggle'), 'min-width')).toBeGreaterThanOrEqual(44);
    expect(declarationsFor('.exercise-toggle')).not.toMatch(/min-width/i);
  });

  it('keeps every Settings button, input, and select at least 44px in both dimensions', () => {
    const declarations = settingsControlDeclarations();

    expect(pixelDeclaration(declarations, 'min-width')).toBeGreaterThanOrEqual(44);
    expect(pixelDeclaration(declarations, 'min-height')).toBeGreaterThanOrEqual(44);
  });

  it('keeps every Workout action button at least 44px in both dimensions', () => {
    const declarations = workoutButtonDeclarations();

    expect(pixelDeclaration(declarations, 'min-width')).toBeGreaterThanOrEqual(44);
    expect(pixelDeclaration(declarations, 'min-height')).toBeGreaterThanOrEqual(44);
  });

  it('wraps the active Workout phase header at narrow viewports so its elapsed timer stays contained', () => {
    const narrowHeader = css.match(/@media\s*\(max-width:\s*420px\)\s*\{[\s\S]*?\.workout-header\s*\{([^}]*)\}/i)?.[1] ?? '';
    const narrowHeading = css.match(/@media\s*\(max-width:\s*420px\)\s*\{[\s\S]*?\.workout-header h1\s*\{([^}]*)\}/i)?.[1] ?? '';

    expect(narrowHeader).toMatch(/flex-wrap:\s*wrap/i);
    expect(narrowHeading).toMatch(/flex-basis:\s*100%/i);
  });
});
