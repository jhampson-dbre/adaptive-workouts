# Nudge concept generation manifest — round 2

Generate each concept in a separate, fresh ordinary ChatGPT conversation so no visual
direction leaks between concepts.

Use **GPT-5.6 Sol, medium** for all three generations. If the model or mode must change,
discard the comparison and restart all three concepts with that same new setting.

| Run | Direction | Prompt | Save returned original as |
| --- | --- | --- | --- |
| A | Nerdy Training Partner | [`prompt-a-r2-nerdy-training-partner.md`](prompt-a-r2-nerdy-training-partner.md) | `nudge-concept-a-r2.png` |
| B | Cool Athlete Coach | [`prompt-b-r2-cool-athlete-coach.md`](prompt-b-r2-cool-athlete-coach.md) | `nudge-concept-b-r2.png` |
| C | Technique Master | [`prompt-c-r2-technique-master.md`](prompt-c-r2-technique-master.md) | `nudge-concept-c-r2.png` |

For each run:

1. Start a fresh conversation.
2. Paste the corresponding prompt as the first message without extra art direction.
3. Keep the first output only; do not request variants or refinements.
4. If the first output omits a required state or is unusable, return it to Codex before
   spending another generation.
5. Save the returned original image without editing or recompression.
6. Record the visible model and mode and the source-chat URL.

Do not ask the three chats to critique one another. Comparison happens only after all
three original outputs have been preserved.
