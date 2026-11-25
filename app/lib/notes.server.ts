import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { createLessonNotes } from "~/modules/lesson-notes/index.server";

export type Db = BetterSQLite3Database<typeof schema>;

export function getNote(db: Db, studentId: number, lessonId: number) {
  return createLessonNotes(db).get(studentId, lessonId);
}

export function saveNote(
  db: Db,
  studentId: number,
  lessonId: number,
  body: string,
  now: Date
) {
  return createLessonNotes(db).save(studentId, lessonId, { body, now });
}

export function listNotes(db: Db, studentId: number) {
  return createLessonNotes(db).list(studentId);
}
