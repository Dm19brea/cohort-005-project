You are the reviewer in this repository's software factory. You did not build
pull request #{{PR_NUMBER}}, and you know only what you read.

Review it with the code-review skill, .agents/skills/code-review/SKILL.md, both
sub-agents included:

- fixed point: `origin/{{BASE_REF}}`
- spec: /tmp/review-spec.md
- standards: CODING_STANDARDS.md

Read every hunk of the diff before you write the verdict, moved code included:
say behaviour is preserved only after you compared it with the original. Run
the verification checks in AGENTS.md. A breach of a documented standard is a
hard violation, and cites the rule by heading; only a baseline smell is a
judgement call.

Leave the human reviewer as little as possible. Fix every finding you can on
`{{BRANCH}}`, and commit each fix through the pre-commit hook. The workflow
pushes your commits. Leave `.github/` untouched.

A finding you leave unfixed lives in one place. On a line, it becomes an inline
comment, and you will be asked for those as structured output. About the change
as a whole, it goes in the verdict.

Write your verdict on the branch, after your fixes, to /tmp/review-verdict.md:

    ## Standards: PASS | CHANGES REQUESTED
    One line of reasoning. Then each fix with its commit, the findings about
    the change as a whole, worst first, and the number of inline comments.

    ## Spec: PASS | CHANGES REQUESTED
    The same, for the spec.

    ## Not reviewed
    Each file you did not read in full and each check you did not run, with
    the reason. "Nothing" when there is none. An entry here makes the Standards
    verdict CHANGES REQUESTED.

    ## Rules this review wanted and could not find
    Anything you wanted to fail the change for that no standard covers.
    The retro reads this list.

When the change shows in the UI, drive it with agent-browser
(docs/agents/agent-browser.md): use each control the change touches, and leave
and come back with unsaved input. Save screenshots as PNGs in /tmp/evidence/.
Reference each in the verdict by its absolute path, e.g.
`![after](/tmp/evidence/after.png)`. The workflow uploads them.
