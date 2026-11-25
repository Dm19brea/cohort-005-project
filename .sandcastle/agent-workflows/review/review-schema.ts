import { z } from "zod/v4";

// The findings the review left unfixed on a line. The workflow posts each one
// as an inline comment on the pull request. A finding about the change as a
// whole is in the verdict instead.
export const reviewSchema = z
  .strictObject({
    comments: z
      .array(
        z.strictObject({
          path: z
            .string()
            .min(1)
            .describe("The file, relative to the repository root."),
          line: z
            .number()
            .int()
            .positive()
            .describe(
              "A line in the file as it is now, inside a hunk of the diff against the base. A finding outside the hunks goes to the end of the verdict."
            ),
          body: z
            .string()
            .min(1)
            .describe(
              "The finding, in Markdown: the rule or spec line it breaks, and what to do instead."
            ),
        })
      )
      .describe(
        "One entry per finding you left unfixed on a line. A finding about the change as a whole stays in the verdict. Empty is fine."
      ),
  })
  .describe("The review's inline comments.");
