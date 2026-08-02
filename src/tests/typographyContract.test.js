import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/index.css', 'utf8');
const login = readFileSync('src/components/Login.jsx', 'utf8');

describe('Nudge typography roles', () => {
  it('inherits the approved body typography for every Settings select', () => {
    const settings = readFileSync('src/components/Settings.jsx', 'utf8');

    expect(settings).toMatch(/<select\b/);
    expect(css).toMatch(/button,\s*input,\s*select\s*\{\s*font:\s*inherit;/);
  });

  it('defines and applies the approved display, headline, body, label, metadata, and numeric roles', () => {
    expect(css).toMatch(/--type-display:\s*clamp\(2\.8rem,\s*11vw,\s*5rem\)/);
    expect(css).toMatch(/--type-headline:\s*clamp\(1\.9rem,\s*8vw,\s*3rem\)/);
    expect(css).toMatch(/--type-title:\s*1\.45rem/);
    expect(css).toMatch(/--type-body:\s*1rem/);
    expect(css).toMatch(/:root\s*\{[^}]*font-size:\s*112\.5%[^}]*line-height:\s*1\.4/);
    expect(css).toMatch(/--type-label:\s*\.72rem/);
    expect(css).toMatch(/--type-metadata:\s*\.875rem/);
    expect(css).toMatch(/--type-wordmark:\s*clamp\(2\.4rem,\s*9vw,\s*3\.4rem\)/);
    expect(css).toMatch(/--type-timer:\s*clamp\(1\.7rem,\s*7vw,\s*2\.6rem\)/);
    expect(css).toMatch(/--type-exercise-number:\s*2\.5rem/);
    expect(css).toMatch(/--type-set-value:\s*1\.6rem/);

    expect(css).toMatch(/\.app-header h1\s*\{[^}]*font-size:\s*var\(--type-wordmark\)/);
    expect(css).toMatch(/\.plan-intro h2\s*\{[^}]*font-size:\s*var\(--type-display\)/);
    expect(css).toMatch(/\.workout-header \.workout-title\s*\{[^}]*font-size:\s*var\(--type-display\)[^}]*text-wrap:\s*balance/);
    expect(css).toMatch(/\.generate-btn,[\s\S]*?\.workout-summary \.finish-btn\s*\{[^}]*font-size:\s*var\(--type-headline\)/);
    expect(css).toMatch(/\.workout-help\s*\{[^}]*font-size:\s*var\(--type-body\)[^}]*line-height:\s*1\.5[^}]*letter-spacing:\s*\.01em/);
    expect(css).toMatch(/\.exercise-status\s*\{[^}]*font-size:\s*var\(--type-metadata\)/);
    expect(css).toMatch(/\.journey-progress li\s*\{[^}]*font-size:\s*var\(--type-label\)/);
    expect(css).toMatch(/\.timer\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
    expect(css).toMatch(/\.set-timing\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
    expect(css).toMatch(/\.history-phase-durations,\s*\.completed-set-details\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
    expect(css).toMatch(/\.settings-header\s*\{[^}]*flex-wrap:\s*wrap[^}]*gap:\s*12px/);
    expect(css).toMatch(/\.close-btn\s*\{[^}]*flex-shrink:\s*0/);
    expect(login).not.toMatch(/fontSize:\s*'1\.2rem'/);
  });
});
