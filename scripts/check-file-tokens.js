// Fails when a file is too big for an agent to read and edit in one go.
// Tokens are estimated as bytes / 4, which is close enough for code.
//
// The limit is a ratchet. A file that was already over it at HEAD may change,
// but may not grow: a small change to an old file must not turn into a
// refactor of that file.
//
// Usage: node scripts/check-file-tokens.js [<file>...]
// With no files, it checks everything that differs from HEAD.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";

const MAX_TOKENS = 5000;
const BYTES_PER_TOKEN = 4;

// Generated files that nobody edits by hand, and workflow files, which
// GitHub reads as one file each and which cannot be split.
const IGNORED = [
  /(^|\/)package-lock\.json$/,
  /^drizzle\//,
  /^\.github\/workflows\/[^/]+\.yml$/,
];

const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });

const list = (...args) =>
  git(...args)
    .split("\0")
    .filter(Boolean);

const changedFiles = () => [
  ...list("diff", "--name-only", "--relative", "-z", "HEAD"),
  ...list("ls-files", "--others", "--exclude-standard", "-z"),
];

// A renamed file keeps the size it had under its old name.
const renames = () => {
  const fields = list(
    "diff",
    "--name-status",
    "--diff-filter=R",
    "-M",
    "-z",
    "HEAD"
  );
  const oldNames = new Map();
  for (let i = 0; i < fields.length; i += 3) {
    oldNames.set(fields[i + 2], fields[i + 1]);
  }
  return oldNames;
};

const tokensIn = (bytes) => Math.ceil(bytes / BYTES_PER_TOKEN);

const tokensAtHead = (file) => {
  try {
    return tokensIn(Number(git("cat-file", "-s", `HEAD:${file}`)));
  } catch {
    return 0; // a new file
  }
};

const isBinary = (contents) => contents.subarray(0, 8000).includes(0);

const args = process.argv.slice(2);
const oldNames = renames();

const oversized = (args.length > 0 ? args : changedFiles())
  .map((file) => relative(process.cwd(), file).replaceAll("\\", "/"))
  .filter((file) => !IGNORED.some((pattern) => pattern.test(file)))
  .filter((file) => existsSync(file) && statSync(file).isFile())
  .map((file) => ({ file, contents: readFileSync(file) }))
  .filter(({ contents }) => !isBinary(contents))
  .map(({ file, contents }) => ({ file, tokens: tokensIn(contents.length) }))
  .filter(({ tokens }) => tokens > MAX_TOKENS)
  .map(({ file, tokens }) => ({
    file,
    tokens,
    before: tokensAtHead(oldNames.get(file) ?? file),
  }))
  .filter(({ tokens, before }) => tokens > Math.max(MAX_TOKENS, before));

const grown = oversized.filter(({ before }) => before > MAX_TOKENS);
const tooBig = oversized.filter(({ before }) => before <= MAX_TOKENS);

if (grown.length > 0) {
  console.error(
    `These files were already over ${MAX_TOKENS} tokens (bytes / 4), and grew:\n`
  );
  for (const { file, tokens, before } of grown) {
    console.error(`  ${file}: ~${before} tokens at HEAD, ~${tokens} now`);
  }
  console.error(`
Move what you added into another file, until this one is no bigger than it was.
Leave the rest of it where it is: splitting it is a separate ticket.
`);
}

if (tooBig.length > 0) {
  console.error(`These files are over ${MAX_TOKENS} tokens (bytes / 4):\n`);
  for (const { file, tokens } of tooBig) {
    console.error(`  ${file}: ~${tokens} tokens`);
  }
  console.error(`
Split each file before you commit. Do not delete code or squash it onto fewer
lines to get under the limit.

How to split:
- Find the seams. Look for groups of functions, components, or tests that
  change together and share little with the rest of the file.
- Route modules (app/routes/*): keep the loader, action, and page component in
  the route file. Move the business logic into a module in app/modules/ and
  sub-components into their own files in app/components/.
- Logic that is already in a module (app/modules/<name>/): split it into more
  files under lib/. Keep the entry points (index.ts, index.server.ts) small. Do
  not add a barrel file. See app/modules/README.md.
- Tests: split by the behaviour under test, one file per area (for example
  <name>.refunds.test.ts, <name>.permissions.test.ts). Move shared fixtures
  into a fixtures file in the same tests/ folder.
- Scripts and seed data: move large data literals into their own files and
  import them.
`);
}

if (oversized.length > 0) {
  console.error("When you are done, run `npm run check` and commit again.");
  process.exit(1);
}
