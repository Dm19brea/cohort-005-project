import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { courses, lessons, modules, notes } from "~/db/schema";
import { savedLessonColumns } from "~/lib/saved-lesson.server";
import { plainText } from "~/lib/text";
import { MAX_NOTE_LENGTH, type LessonNote } from "../index";

export type Db = BetterSQLite3Database<typeof schema>;

export type SaveNoteResult =
  | { ok: true; note: LessonNote }
  | { ok: false; error: string };

export type SaveNoteInput = {
  studentId: number;
  lessonId: number;
  body: string;
  now: Date;
};

export type NoteListItem = {
  id: number;
  body: string;
  updatedAt: string;
  lesson: {
    id: number;
    title: string;
    courseTitle: string;
    courseSlug: string;
  };
};

function toLessonNote(row: typeof notes.$inferSelect): LessonNote {
  return { body: row.body, updatedAt: row.updatedAt };
}

/** The Student's Note on the Lesson, if they have written one. */
export function getNote(
  db: Db,
  studentId: number,
  lessonId: number
): LessonNote | undefined {
  const row = db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, studentId), eq(notes.lessonId, lessonId)))
    .get();

  return row ? toLessonNote(row) : undefined;
}

/**
 * Writes the Student's Note on the Lesson. Saving again replaces the body and
 * moves `updatedAt` on; `createdAt` stays where it was.
 */
export function saveNote(db: Db, input: SaveNoteInput): SaveNoteResult {
  const { studentId, lessonId, body, now } = input;
  const trimmed = plainText(body.trim());
  if (trimmed.length === 0) {
    return { ok: false, error: "Write something before saving your note" };
  }
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer`,
    };
  }

  const at = now.toISOString();
  const row = db
    .insert(notes)
    .values({
      userId: studentId,
      lessonId,
      body: trimmed,
      createdAt: at,
      updatedAt: at,
    })
    .onConflictDoUpdate({
      target: [notes.userId, notes.lessonId],
      set: { body: trimmed, updatedAt: at },
    })
    .returning()
    .get();

  return { ok: true, note: toLessonNote(row) };
}

/** The Student's Notes, most recently edited first, each with its Lesson and Course. */
export function listNotes(db: Db, studentId: number): NoteListItem[] {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      updatedAt: notes.updatedAt,
      lesson: savedLessonColumns,
    })
    .from(notes)
    .innerJoin(lessons, eq(lessons.id, notes.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(eq(notes.userId, studentId))
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .all();
}
