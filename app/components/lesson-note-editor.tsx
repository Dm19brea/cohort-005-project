import { useState } from "react";
import { useFetcher } from "react-router";
import { NotebookPen, Save } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  MAX_NOTE_LENGTH,
  type LessonNote as LessonNoteData,
} from "~/modules/lesson-notes";
import { cn, formatRelativeTime } from "~/lib/utils";

type SaveNoteFetcherData =
  | { ok: true; note: LessonNoteData }
  | { ok: false; error: string };

export function NoteEditor({
  note,
}: {
  note: LessonNoteData | null | undefined;
}) {
  const fetcher = useFetcher<SaveNoteFetcherData>();
  const [body, setBody] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const savedNote = fetcher.data?.ok ? fetcher.data.note : note;
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const tooLong = body.length > MAX_NOTE_LENGTH;
  const empty = body.trim().length === 0;
  const unchanged = body.trim() === (savedNote?.body ?? "");
  const justSaved = fetcher.state === "idle" && fetcher.data?.ok && unchanged;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <NotebookPen className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Your notes</h3>
            <p className="text-sm text-muted-foreground">
              Private to you. Only you can read these.
            </p>
          </div>
        </div>
        {savedNote && (
          <span
            suppressHydrationWarning
            className="text-xs text-muted-foreground"
          >
            Edited {formatRelativeTime(savedNote.updatedAt)}
          </span>
        )}
      </div>

      <fetcher.Form method="post" className="space-y-3">
        <input type="hidden" name="intent" value="save-note" />
        <Textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
          aria-label="Your notes"
          placeholder="Add a note for yourself — a timestamp, a question to revisit, or a summary."
          className={cn("resize-y", tooLong && "border-destructive")}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="sm"
            disabled={isSaving || empty || tooLong}
          >
            <Save className="size-4" />
            {isSaving ? "Saving..." : savedNote ? "Update note" : "Save note"}
          </Button>
          {error && <span className="text-sm text-red-600">{error}</span>}
          {!error && justSaved && (
            <output className="text-sm text-green-600">Saved</output>
          )}
          <span
            className={cn(
              "ml-auto text-xs",
              tooLong ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {body.length} / {MAX_NOTE_LENGTH}
          </span>
        </div>
      </fetcher.Form>
    </div>
  );
}
