import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { plainText } from "~/lib/text";
import { createLessonNotes } from "../index.server";
import { MAX_NOTE_LENGTH, saveNoteSchema } from "../index";

const NOW = new Date(2026, 9, 6, 12, 0, 0);

function minutesAfterNow(minutes: number) {
  return new Date(NOW.getTime() + minutes * 60_000);
}

let db: TestDb;
let notes: ReturnType<typeof createLessonNotes>;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  notes = createLessonNotes(db);
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

describe("saving a Note", () => {
  it("writes a Note with the body trimmed", () => {
    const saved = notes.save(base.user.id, lessonIds[0], {
      body: "  Rewatch at 4:20  ",
      now: NOW,
    });

    expect(saved).toEqual({
      ok: true,
      note: {
        body: "Rewatch at 4:20",
        updatedAt: NOW.toISOString(),
      },
    });
    expect(notes.get(base.user.id, lessonIds[0])).toEqual({
      body: "Rewatch at 4:20",
      updatedAt: NOW.toISOString(),
    });
  });

  it("replaces the body and moves the last-edited time on when saved again", () => {
    notes.save(base.user.id, lessonIds[0], {
      body: "First thought",
      now: NOW,
    });
    notes.save(base.user.id, lessonIds[0], {
      body: "Second thought",
      now: minutesAfterNow(5),
    });

    expect(notes.get(base.user.id, lessonIds[0])).toEqual({
      body: "Second thought",
      updatedAt: minutesAfterNow(5).toISOString(),
    });
  });

  it("never leaves a Student with two Notes on the same Lesson", () => {
    notes.save(base.user.id, lessonIds[0], {
      body: "First thought",
      now: NOW,
    });
    notes.save(base.user.id, lessonIds[0], {
      body: "Second thought",
      now: NOW,
    });

    expect(notes.list(base.user.id)).toHaveLength(1);
    expect(() =>
      db
        .insert(schema.notes)
        .values({
          userId: base.user.id,
          lessonId: lessonIds[0],
          body: plainText("Dupe"),
        })
        .run()
    ).toThrow();
  });

  it(`accepts a Note of exactly ${MAX_NOTE_LENGTH} characters`, () => {
    expect(
      notes.save(base.user.id, lessonIds[0], {
        body: "a".repeat(MAX_NOTE_LENGTH),
        now: NOW,
      })
    ).toMatchObject({
      ok: true,
    });
  });

  it(`refuses a Note over ${MAX_NOTE_LENGTH} characters`, () => {
    expect(
      notes.save(base.user.id, lessonIds[0], {
        body: "a".repeat(MAX_NOTE_LENGTH + 1),
        now: NOW,
      })
    ).toEqual({
      ok: false,
      error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer`,
    });
    expect(notes.get(base.user.id, lessonIds[0])).toBeUndefined();
  });

  it("refuses a Note that is only whitespace", () => {
    expect(
      notes.save(base.user.id, lessonIds[0], {
        body: "   ",
        now: NOW,
      })
    ).toEqual({
      ok: false,
      error: "Write something before saving your note",
    });
    expect(notes.get(base.user.id, lessonIds[0])).toBeUndefined();
  });

  it("keeps the body exactly as typed, Markdown characters included", () => {
    notes.save(base.user.id, lessonIds[0], {
      body: "# not a heading\n*not bold*",
      now: NOW,
    });

    expect(notes.get(base.user.id, lessonIds[0])?.body).toBe(
      "# not a heading\n*not bold*"
    );
  });
});

describe("validating Note input", () => {
  it("trims the body before it is saved", () => {
    expect(saveNoteSchema.parse({ body: "  Remember this  " })).toEqual({
      body: "Remember this",
    });
  });

  it("refuses an empty body and says what to do before it reaches the store", () => {
    const result = saveNoteSchema.safeParse({ body: "   " });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Write something before saving your note."
    );
  });

  it(`refuses a body over ${MAX_NOTE_LENGTH} characters and says the limit`, () => {
    const result = saveNoteSchema.safeParse({
      body: "a".repeat(MAX_NOTE_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Your note is over ${MAX_NOTE_LENGTH} characters, so it was not saved.`
    );
  });
});

describe("reading a Note", () => {
  it("returns nothing when the Student has not written one", () => {
    expect(notes.get(base.user.id, lessonIds[0])).toBeUndefined();
  });
});

describe("listing Notes", () => {
  it("lists only the Student's own Notes, most recently edited first, with their Lesson and Course", () => {
    const other = db
      .insert(schema.users)
      .values({
        name: "Other",
        email: "other@example.com",
        role: UserRole.Student,
      })
      .returning()
      .get();
    notes.save(base.user.id, lessonIds[0], {
      body: "On lesson 1",
      now: NOW,
    });
    notes.save(base.user.id, lessonIds[1], {
      body: "On lesson 2",
      now: minutesAfterNow(5),
    });
    notes.save(base.user.id, lessonIds[0], {
      body: "On lesson 1, edited",
      now: minutesAfterNow(10),
    });
    notes.save(other.id, lessonIds[0], {
      body: "Someone else's",
      now: minutesAfterNow(15),
    });

    expect(notes.list(base.user.id)).toMatchObject([
      {
        body: "On lesson 1, edited",
        lesson: {
          id: lessonIds[0],
          title: "Lesson 1",
          courseTitle: "Test Course",
          courseSlug: "test-course",
        },
      },
      {
        body: "On lesson 2",
        lesson: {
          id: lessonIds[1],
          title: "Lesson 2",
          courseTitle: "Test Course",
          courseSlug: "test-course",
        },
      },
    ]);
  });
});
