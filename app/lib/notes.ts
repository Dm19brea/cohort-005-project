import { z } from "zod";

export const MAX_NOTE_LENGTH = 2000;

/** The Save-note form: plain text, trimmed, 1–2,000 characters. Over-long Notes are refused, never truncated. */
export const saveNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something before saving your note.")
    .max(
      MAX_NOTE_LENGTH,
      `A note can be at most ${MAX_NOTE_LENGTH.toLocaleString("en-US")} characters.`
    ),
});
