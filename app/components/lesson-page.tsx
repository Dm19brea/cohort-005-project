import { useCallback, useEffect, useState } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import type { loader } from "~/routes/courses.$slug.lessons.$lessonId";
import { CommentThread } from "~/components/comment-thread";
import { NoteEditor } from "~/components/lesson-note-editor";
import { CurriculumSidebar } from "~/components/lesson-curriculum-sidebar";
import { QuizSection } from "~/components/lesson-quiz";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Github,
  MapPin,
  MessageSquare,
  NotebookPen,
  ShieldAlert,
} from "lucide-react";
import { formatDuration } from "~/lib/utils";
import { LessonProgressStatus } from "~/db/schema";
import { countryName } from "~/lib/ppp";
import { YouTubePlayer } from "~/components/youtube-player";

const AUTOPLAY_KEY = "cadence-autoplay";

function useAutoplay() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(AUTOPLAY_KEY) === "true");
    } catch {
      /* silently fail */
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTOPLAY_KEY, String(next));
      } catch {
        /* silently fail */
      }
      return next;
    });
  }, []);

  return [enabled, toggle] as const;
}

type LessonLoaderData = Awaited<ReturnType<typeof loader>>;

export function LessonViewer({ loaderData }: { loaderData: LessonLoaderData }) {
  if (loaderData.view === "locked") {
    return <LockedLesson data={loaderData} />;
  }
  return <FullLesson data={loaderData} />;
}

function LockedLesson({
  data: { course, curriculum, module: mod, lesson, enrolled, lockedReason },
}: {
  data: Extract<LessonLoaderData, { view: "locked" }>;
}) {
  const purchasePath = `/courses/${course.slug}/purchase`;

  return (
    <div className="flex">
      <CurriculumSidebar
        course={course}
        curriculum={curriculum}
        currentLessonId={lesson.id}
        lessonProgressMap={{}}
        enrolled={enrolled}
      />

      <div className="flex-1 p-6 lg:p-8">
        <LessonBreadcrumb
          course={course}
          mod={mod}
          lessonTitle={lesson.title}
        />

        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-3xl font-bold">{lesson.title}</h1>

          <Card className="mb-8">
            <CardContent className="py-10 text-center">
              {lockedReason.kind === "country-lock" ? (
                <>
                  <ShieldAlert className="mx-auto mb-4 size-12 text-amber-500" />
                  <h2 className="mb-3 text-xl font-semibold">Country Lock</h2>
                  <p className="mb-4 text-muted-foreground">
                    You bought this course at a Purchasing-Power Price in{" "}
                    <strong>{countryName(lockedReason.purchaseCountry)}</strong>
                    , but you're currently in{" "}
                    <strong>{countryName(lockedReason.currentCountry)}</strong>.
                  </p>
                  <p className="mb-6 text-sm text-muted-foreground">
                    A course bought at a Purchasing-Power Price only works from
                    the country it was bought in. This helps keep courses
                    affordable for students in lower-income regions.
                  </p>
                  <Link to={`/courses/${course.slug}`}>
                    <Button variant="outline">
                      <MapPin className="mr-2 size-4" />
                      Back to Course
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="mb-3 text-xl font-semibold">
                    Buy this course to watch this lesson
                  </h2>
                  <p className="mb-6 text-muted-foreground">
                    This lesson is part of <strong>{course.title}</strong>.
                    Enroll to get the full lesson, its video and every other
                    lesson in the course.
                  </p>
                  <Link
                    to={
                      lockedReason.kind === "signed-out"
                        ? `/signup?redirectTo=${encodeURIComponent(purchasePath)}`
                        : purchasePath
                    }
                  >
                    <Button size="lg">Buy the course</Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LessonBreadcrumb({
  course,
  mod,
  lessonTitle,
}: {
  course: { title: string; slug: string };
  mod: { id: number; title: string };
  lessonTitle: string;
}) {
  return (
    <nav className="mb-6 text-sm text-muted-foreground">
      <Link to="/courses" className="hover:text-foreground">
        Courses
      </Link>
      <span className="mx-2">/</span>
      <Link to={`/courses/${course.slug}`} className="hover:text-foreground">
        {course.title}
      </Link>
      <span className="mx-2">/</span>
      <Link
        to={`/courses/${course.slug}/${mod.id}`}
        className="hover:text-foreground"
      >
        {mod.title}
      </Link>
      <span className="mx-2">/</span>
      <span className="text-foreground">{lessonTitle}</span>
    </nav>
  );
}

function FullLesson({
  data,
}: {
  data: Extract<LessonLoaderData, { view: "full" }>;
}) {
  const {
    course,
    curriculum,
    module: mod,
    lesson,
    contentHtml,
    lessonStatus,
    enrolled,
    currentUserId,
    prevLesson,
    nextLesson,
    quiz,
    bestAttempt,
    lastWatchPosition,
    watchProgress,
    lessonProgressMap,
    comments,
    canModerate,
    instructorName,
    bookmarked,
    note,
  } = data;
  const [autoplay, toggleAutoplay] = useAutoplay();
  const fetcher = useFetcher({ key: `mark-complete-${lesson.id}` });
  const quizFetcher = useFetcher({ key: `quiz-${lesson.id}` });
  const navigate = useNavigate();

  const isMarking =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("intent") === "mark-complete";

  const justCompleted = fetcher.data?.success;

  const isCompleted =
    lessonStatus === LessonProgressStatus.Completed || justCompleted;

  // Navigate to next lesson after marking complete
  useEffect(() => {
    if (justCompleted && nextLesson) {
      navigate(`/courses/${course.slug}/lessons/${nextLesson.id}`);
    }
  }, [justCompleted, nextLesson, course.slug, navigate]);

  const quizResult = quizFetcher.data?.quizResult ?? null;
  const isSubmittingQuiz = quizFetcher.state !== "idle";

  return (
    <div className="flex">
      {/* Curriculum Sidebar */}
      <CurriculumSidebar
        course={course}
        curriculum={curriculum}
        currentLessonId={lesson.id}
        lessonProgressMap={lessonProgressMap}
        enrolled={enrolled}
      />

      <div className="flex-1 p-6 lg:p-8">
        <LessonBreadcrumb
          course={course}
          mod={mod}
          lessonTitle={lesson.title}
        />

        <div className="mx-auto max-w-4xl">
          {/* Lesson Title */}
          <div className="mb-2 flex items-start justify-between gap-3">
            <h1 className="text-3xl font-bold">{lesson.title}</h1>
            {currentUserId && <BookmarkToggle bookmarked={bookmarked} />}
          </div>
          <div className="mb-6 flex items-center gap-3">
            {lesson.durationMinutes && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="size-4" />
                {formatDuration(lesson.durationMinutes, true, false, false)}
              </div>
            )}
            {lesson.githubRepoUrl && (
              <a
                href={lesson.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <Github className="mr-1.5 size-4" />
                  Open Code
                </Button>
              </a>
            )}
          </div>

          {/* YouTube Video */}
          {lesson.videoUrl && (
            <YouTubePlayer
              videoUrl={lesson.videoUrl}
              lessonId={lesson.id}
              title={lesson.title}
              startPosition={lastWatchPosition}
              durationMinutes={lesson.durationMinutes}
              watchProgress={watchProgress}
              trackingEnabled={enrolled && !!currentUserId}
              autoplay={autoplay}
              onToggleAutoplay={toggleAutoplay}
            />
          )}

          {/* Lesson Content */}
          {contentHtml && (
            <div
              className="prose prose-neutral dark:prose-invert mb-8 max-w-none"
              // oxlint-disable-next-line react/no-danger -- the instructor wrote this Markdown
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          )}

          {!contentHtml && !lesson.videoUrl && (
            <Card className="mb-8">
              <CardContent className="py-12 text-center text-muted-foreground">
                No content has been added to this lesson yet.
              </CardContent>
            </Card>
          )}

          {/* Quiz Section */}
          {quiz && enrolled && currentUserId && (
            <QuizSection
              quiz={quiz}
              bestAttempt={bestAttempt}
              quizResult={quizResult}
              quizFetcher={quizFetcher}
              isSubmitting={isSubmittingQuiz}
            />
          )}

          {/* Mark Complete / Up Next */}
          {enrolled && currentUserId && (
            <div className="mb-8">
              {isCompleted ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="size-5" />
                    <span className="font-medium">Lesson completed</span>
                  </div>
                  {nextLesson && (
                    <Link
                      to={`/courses/${course.slug}/lessons/${nextLesson.id}`}
                    >
                      <Button variant="outline" size="sm">
                        Up next: {nextLesson.title}
                        <ChevronRight className="ml-1 size-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              ) : nextLesson ? (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="mark-complete" />
                  <Button disabled={isMarking}>
                    {isMarking ? (
                      "Completing..."
                    ) : (
                      <>
                        Up next: {nextLesson.title}
                        <ChevronRight className="ml-1 size-4" />
                      </>
                    )}
                  </Button>
                </fetcher.Form>
              ) : (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="mark-complete" />
                  <Button disabled={isMarking}>
                    <CheckCircle2 className="mr-2 size-4" />
                    {isMarking ? "Marking..." : "Mark as Complete"}
                  </Button>
                </fetcher.Form>
              )}
            </div>
          )}

          {/* Notes and Discussion — both confidential to people with access */}
          <Card id="lesson-workspace" className="mb-8 overflow-hidden">
            <Tabs
              defaultValue={currentUserId ? "notes" : "discussion"}
              className="gap-0"
            >
              <div className="flex flex-col gap-4 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Notes &amp; discussion
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {currentUserId
                      ? "Keep private notes, or ask a question about this lesson."
                      : "Ask a question or share what you found."}
                  </p>
                </div>
                <TabsList>
                  {currentUserId && (
                    <TabsTrigger value="notes">
                      <NotebookPen />
                      Notes
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="discussion">
                    <MessageSquare />
                    Discussion
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="p-6">
                {currentUserId && (
                  <TabsContent value="notes">
                    <NoteEditor key={lesson.id} note={note} />
                  </TabsContent>
                )}
                <TabsContent value="discussion">
                  <CommentThread
                    comments={comments}
                    currentUserId={currentUserId}
                    canModerate={canModerate}
                    canPost
                    instructorName={instructorName}
                    embedded
                  />
                </TabsContent>
              </div>
            </Tabs>
          </Card>

          {/* Prev/Next Navigation */}
          <div className="flex items-center justify-between border-t pt-6">
            {prevLesson ? (
              <Link
                to={`/courses/${course.slug}/lessons/${prevLesson.id}`}
                className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground"
              >
                <ChevronLeft className="size-4" />
                <div>
                  <div className="text-xs text-muted-foreground">Previous</div>
                  <div className="font-medium text-foreground">
                    {prevLesson.title}
                  </div>
                </div>
              </Link>
            ) : (
              <div />
            )}

            {nextLesson ? (
              <Link
                to={`/courses/${course.slug}/lessons/${nextLesson.id}`}
                className="flex items-center gap-2 text-right text-sm hover:text-foreground text-muted-foreground"
              >
                <div>
                  <div className="text-xs text-muted-foreground">Next</div>
                  <div className="font-medium text-foreground">
                    {nextLesson.title}
                  </div>
                </div>
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <Link
                to={`/courses/${course.slug}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <div>
                  <div className="text-xs text-muted-foreground">Back to</div>
                  <div className="font-medium text-foreground">
                    {course.title}
                  </div>
                </div>
                <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BookmarkToggle({ bookmarked }: { bookmarked: boolean }) {
  const fetcher = useFetcher<{ ok: boolean }>();
  const isSaving = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggle-bookmark" />
      <Button type="submit" variant="outline" size="sm" disabled={isSaving}>
        {bookmarked ? (
          <BookmarkCheck className="mr-1.5 size-4" />
        ) : (
          <Bookmark className="mr-1.5 size-4" />
        )}
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </Button>
    </fetcher.Form>
  );
}
