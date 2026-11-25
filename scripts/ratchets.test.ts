import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Each script runs as the hook runs it, in a repository of its own. Git sets
// GIT_DIR and friends inside a hook, and they would point at this repository.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_"))
);

let repo: string;

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, env, stdio: "ignore" });

const commitAll = () => {
  git("add", "-A");
  git(
    "-c",
    "user.name=test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "--no-verify",
    "-m",
    "base"
  );
};

const run = (script: string, ...args: string[]) => {
  const path = resolve(import.meta.dirname, script);
  const result = spawnSync("node", [path, ...args], {
    cwd: repo,
    env,
    encoding: "utf8",
  });
  return { status: result.status, stderr: result.stderr };
};

const write = (file: string, tokens: number) =>
  writeFileSync(join(repo, file), "x".repeat(tokens * 4));

beforeEach(() => {
  // The real path: macOS symlinks its temp directory, and git does not.
  repo = realpathSync(mkdtempSync(join(tmpdir(), "ratchets-")));
  git("init");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("check-file-tokens", () => {
  const check = (...files: string[]) => run("check-file-tokens.js", ...files);

  beforeEach(() => {
    write("old.ts", 6000);
    write("small.ts", 100);
    commitAll();
  });

  it("lets a file that was over the limit change without growing", () => {
    writeFileSync(join(repo, "old.ts"), "y".repeat(6000 * 4));
    expect(check("old.ts").status).toBe(0);
  });

  it("refuses a file that was over the limit and grew", () => {
    write("old.ts", 6001);
    const { status, stderr } = check("old.ts");
    expect(status).toBe(1);
    expect(stderr).toContain("old.ts: ~6000 tokens at HEAD, ~6001 now");
  });

  it("refuses a file that crosses the limit, and takes one at it", () => {
    write("small.ts", 5000);
    expect(check("small.ts").status).toBe(0);
    write("small.ts", 5001);
    expect(check("small.ts").status).toBe(1);
  });

  it("takes the absolute paths lint-staged passes", () => {
    write("old.ts", 5999);
    expect(check(join(repo, "old.ts")).status).toBe(0);
  });

  it("checks every changed and untracked file when it gets none", () => {
    expect(check().status).toBe(0);
    write("new.ts", 5001);
    expect(check().stderr).toContain("new.ts");
  });

  it("skips a file the change deletes", () => {
    rmSync(join(repo, "old.ts"));
    expect(check().status).toBe(0);
  });

  it("keeps the size of a renamed file", () => {
    git("mv", "old.ts", "renamed.ts");
    expect(check("renamed.ts").status).toBe(0);
  });
});

describe("check-lint-exemptions", () => {
  const check = () => run("check-lint-exemptions.js");

  const config = (files: string[], rule = "max-lines") =>
    writeFileSync(
      join(repo, ".oxlintrc.json"),
      `{
        // Files already over a size limit.
        "overrides": [{ "files": ${JSON.stringify(files)}, "rules": { "${rule}": "off" } }]
      }`
    );

  beforeEach(() => {
    mkdirSync(join(repo, "app"));
    write("app/a.ts", 1);
    write("app/b.ts", 1);
    config(["app/a.ts", "app/b.ts"]);
    commitAll();
  });

  it("lets the list shrink and change order", () => {
    config(["app/b.ts", "app/a.ts"]);
    expect(check().status).toBe(0);
    config(["app/b.ts"]);
    expect(check().status).toBe(0);
  });

  it("refuses a new file", () => {
    config(["app/a.ts", "app/b.ts", "app/c.ts"]);
    const { status, stderr } = check();
    expect(status).toBe(1);
    expect(stderr).toContain("app/c.ts: max-lines");
  });

  it("refuses a swap while the old file still exists", () => {
    config(["app/a.ts", "app/c.ts"]);
    expect(check().status).toBe(1);
  });

  it("lets a renamed file keep its exemption, and only that one", () => {
    renameSync(join(repo, "app/b.ts"), join(repo, "app/c.ts"));
    config(["app/a.ts", "app/c.ts"]);
    expect(check().status).toBe(0);
    config(["app/a.ts", "app/c.ts", "app/d.ts"]);
    expect(check().status).toBe(1);
  });

  it("leaves an exemption from any other rule alone", () => {
    config(["app/c.ts"], "no-console");
    expect(check().status).toBe(0);
  });
});
