# Nudge concept generation manifest

Generate these in ordinary ChatGPT web Chat. Use a fresh chat for each row.
Use the same visible model and image-generation mode for all three rows.

| Order | Exact prompt file | Downloaded original filename | Source chat URL | Visible model/mode |
| --- | --- | --- | --- | --- |
| 1 | `prompt-a.md` | `nudge-concept-a.png` | Return with image | Record before generating |
| 2 | `prompt-b.md` | `nudge-concept-b.png` | Return with image | Same as row 1 |
| 3 | `prompt-c.md` | `nudge-concept-c.png` | Return with image | Same as row 1 |

For each concept:

1. Copy everything below the prompt file's title and paste it unchanged.
2. Generate one contact sheet.
3. Do not request a variant or refinement.
4. Download the original image using the filename in the table.
5. Copy the browser URL for that source chat. A public share link is not required.
6. If a required frame is missing or unusable, attach that result to the Codex task
   before spending another generation. Codex will provide the smallest repair prompt.

After all three generations, attach the three original PNG files and return the three
source chat URLs plus the common visible model/mode label to this Codex task. This lets
Codex verify that each unchanged prompt produced one first output in its own fresh chat.
