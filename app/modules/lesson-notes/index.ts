import { z } from "zod";

/** The most characters a Note may hold. */
export const MAX_NOTE_LENGTH = 2000;

/** A Student's private Note on a Lesson, as the pages that show it need it. */
export type LessonNote = {
  body: string;
  updatedAt: string;
};

/** Form input for saving a Note, parsed once at the action boundary. */
export const saveNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something before saving your note.")
    .max(
      MAX_NOTE_LENGTH,
      `Your note is over ${MAX_NOTE_LENGTH} characters, so it was not saved.`
    ),
});
