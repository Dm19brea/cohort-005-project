import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import {
  getNote,
  isBookmarked,
  listBookmarks,
  listNotes,
  saveNote,
  toggleBookmark,
} from "./saved.server";
import { MAX_NOTE_LENGTH, saveNoteSchema } from "./notes";
import { approveRefundRequest, raiseRefundRequest } from "./refunds.server";
import { fakeNotifications } from "./notifications.fake.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);
const LATER = new Date(2026, 9, 6, 13, 0, 0);
const LATEST = new Date(2026, 9, 6, 14, 0, 0);

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  lessonIds = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

function addStudent(name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase()}@example.com`,
      role: UserRole.Student,
    })
    .returning()
    .get();
}

describe("bookmarking a Lesson", () => {
  it("adds a Bookmark, then removes it on the next toggle", () => {
    expect(toggleBookmark(db, base.user.id, lessonIds[0], NOW)).toBe(true);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(true);

    expect(toggleBookmark(db, base.user.id, lessonIds[0], LATER)).toBe(false);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(false);
  });

  it("never leaves a Student with two Bookmarks on one Lesson", () => {
    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    expect(() =>
      db
        .insert(schema.bookmarks)
        .values({ userId: base.user.id, lessonId: lessonIds[0] })
        .run()
    ).toThrow();

    expect(listBookmarks(db, base.user.id)).toHaveLength(1);
  });
});

describe("saving a Note", () => {
  it("creates the Note when there is none", () => {
    expect(getNote(db, base.user.id, lessonIds[0])).toBeNull();

    saveNote(
      db,
      base.user.id,
      lessonIds[0],
      "Closures capture *variables*",
      NOW
    );

    expect(getNote(db, base.user.id, lessonIds[0])).toEqual({
      body: "Closures capture *variables*",
      updatedAt: NOW.toISOString(),
    });
  });

  it("replaces the body and moves the last-edited time on when saved again", () => {
    saveNote(db, base.user.id, lessonIds[0], "First draft", NOW);
    saveNote(db, base.user.id, lessonIds[0], "Second draft", LATER);

    expect(getNote(db, base.user.id, lessonIds[0])).toEqual({
      body: "Second draft",
      updatedAt: LATER.toISOString(),
    });
    expect(listNotes(db, base.user.id)).toHaveLength(1);
  });

  it("never leaves a Student with two Notes on one Lesson", () => {
    saveNote(db, base.user.id, lessonIds[0], "Mine", NOW);
    expect(() =>
      db
        .insert(schema.notes)
        .values({ userId: base.user.id, lessonId: lessonIds[0], body: "Dup" })
        .run()
    ).toThrow();
  });
});

describe("the Note length cap", () => {
  it("accepts a Note of exactly 2,000 characters", () => {
    const result = saveNoteSchema.safeParse({
      body: "a".repeat(MAX_NOTE_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("refuses a Note over 2,000 characters with a message", () => {
    const result = saveNoteSchema.safeParse({
      body: "a".repeat(MAX_NOTE_LENGTH + 1),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "A note can be at most 2,000 characters."
    );
  });

  it("trims the body before checking it", () => {
    expect(saveNoteSchema.parse({ body: "  hello  " })).toEqual({
      body: "hello",
    });
  });
});

describe("the Saved lists", () => {
  it("lists only the Student's own Bookmarks, newest first, with Lesson and Course", () => {
    const other = addStudent("Olive");
    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    toggleBookmark(db, base.user.id, lessonIds[1], LATER);
    toggleBookmark(db, other.id, lessonIds[0], LATEST);

    expect(listBookmarks(db, base.user.id)).toMatchObject([
      {
        lessonId: lessonIds[1],
        lessonTitle: "Lesson 2",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
      { lessonId: lessonIds[0], lessonTitle: "Lesson 1" },
    ]);
  });

  it("lists only the Student's own Notes, most recently edited first", () => {
    const other = addStudent("Olive");
    saveNote(db, base.user.id, lessonIds[0], "Older note", NOW);
    saveNote(db, base.user.id, lessonIds[1], "Newer note", LATER);
    saveNote(db, other.id, lessonIds[0], "Not yours", LATEST);
    saveNote(db, base.user.id, lessonIds[0], "Older note, edited", LATEST);

    expect(listNotes(db, base.user.id)).toMatchObject([
      {
        lessonId: lessonIds[0],
        body: "Older note, edited",
        courseTitle: "Test Course",
      },
      { lessonId: lessonIds[1], body: "Newer note" },
    ]);
  });
});

describe("approving a Refund", () => {
  it("keeps the Student's Bookmarks and Notes", async () => {
    const admin = db
      .insert(schema.users)
      .values({
        name: "Pat Admin",
        email: "pat@example.com",
        role: UserRole.Admin,
      })
      .returning()
      .get();
    const purchase = db
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        amountPaid: 7900,
        createdAt: NOW.toISOString(),
      })
      .returning()
      .get();
    db.insert(schema.enrollments)
      .values({ userId: base.user.id, courseId: base.course.id })
      .run();

    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    saveNote(db, base.user.id, lessonIds[0], "Keep me", NOW);

    const notifications = fakeNotifications();
    const raised = await raiseRefundRequest(
      db,
      purchase.id,
      base.user.id,
      "Not for me",
      NOW,
      notifications
    );
    if (!raised.ok) throw new Error(raised.error);
    const approved = await approveRefundRequest(
      db,
      raised.refundRequestId,
      admin.id,
      null,
      NOW,
      notifications
    );
    expect(approved.ok).toBe(true);

    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(true);
    expect(getNote(db, base.user.id, lessonIds[0])).toMatchObject({
      body: "Keep me",
    });
  });
});
