import { db } from "~/db";
import { getNote, listNotes, saveNote, type Db } from "./lib/lesson-notes";

export type {
  Db,
  NoteListItem,
  SaveNoteInput,
  SaveNoteResult,
} from "./lib/lesson-notes";

/**
 * A Student's private Notes bound to a database. The app uses `lessonNotes`,
 * which reads the app database; tests build their own against a test database.
 *
 * Nothing outside the owning Student's Lesson page and Saved page may read a
 * Note body: no Instructor or Platform Admin view.
 */
export function createLessonNotes(database: Db) {
  return {
    /** The Student's Note on the Lesson, if they have written one. */
    get(studentId: number, lessonId: number) {
      return getNote(database, studentId, lessonId);
    },

    /**
     * Writes the Student's Note on the Lesson. Saving again replaces the body
     * and moves `updatedAt` on; `createdAt` stays where it was.
     */
    save(
      studentId: number,
      lessonId: number,
      input: { body: string; now: Date }
    ) {
      return saveNote(database, {
        studentId,
        lessonId,
        body: input.body,
        now: input.now,
      });
    },

    /** The Student's Notes, most recently edited first, with their Lessons. */
    list(studentId: number) {
      return listNotes(database, studentId);
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const lessonNotes = /* @__PURE__ */ createLessonNotes(db);
