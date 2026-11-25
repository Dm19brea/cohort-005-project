// Fails when .oxlintrc.json exempts a file from a size rule that did not have
// the exemption at HEAD. The lists hold the files that were over a limit when
// the rule arrived, so they only shrink. A renamed file keeps its exemption.
//
// Usage: node scripts/check-lint-exemptions.js

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

const CONFIG = ".oxlintrc.json";
const SIZE_RULES = new Set([
  "max-lines",
  "max-lines-per-function",
  "max-params",
  "max-depth",
]);

const exemptions = (text) => {
  const { config, error } = ts.parseConfigFileTextToJson(CONFIG, text);
  if (error) {
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
  }
  return (config.overrides ?? []).flatMap(({ files, rules = {} }) =>
    Object.keys(rules)
      .filter((rule) => SIZE_RULES.has(rule))
      .flatMap((rule) => files.map((file) => ({ rule, file })))
  );
};

const without = (some, others) =>
  some.filter(
    (one) =>
      !others.some(({ rule, file }) => rule === one.rule && file === one.file)
  );

const before = exemptions(
  execFileSync("git", ["show", `HEAD:${CONFIG}`], { encoding: "utf8" })
);
const after = exemptions(readFileSync(CONFIG, "utf8"));

// Each exemption that left with its file pays for one under a new name.
const credit = new Map();
for (const { rule, file } of without(before, after)) {
  if (!existsSync(file)) credit.set(rule, (credit.get(rule) ?? 0) + 1);
}

const added = without(after, before).filter(({ rule }) => {
  const left = credit.get(rule) ?? 0;
  credit.set(rule, left - 1);
  return left <= 0;
});

if (added.length > 0) {
  console.error(`${CONFIG} has new exemptions from a size rule:\n`);
  for (const { rule, file } of added) console.error(`  ${file}: ${rule}`);
  console.error(`
Take each one out and make the code fit the rule. Moved code counts: a function
that moves to a new file is split there, or stays where it was.`);
  process.exit(1);
}
