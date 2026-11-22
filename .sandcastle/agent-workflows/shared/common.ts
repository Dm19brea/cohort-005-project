import * as fs from "node:fs";
import * as path from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";

export const outputDir = (): string => process.env.OUTPUT_DIR ?? "/tmp";

export const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
};

export const writeJson = (filename: string, value: unknown): void => {
  fs.mkdirSync(outputDir(), { recursive: true });
  fs.writeFileSync(
    path.join(outputDir(), filename),
    JSON.stringify(value, null, 2)
  );
};

// The agent a factory workflow runs. Each workflow job picks one with
// AGENT_PROVIDER, set from a repository variable (see the workflow's
// WHAT IT NEEDS), and each job sets its own default there: explore and
// review default to claude, implement and implement-spec to opencode. With
// AGENT_PROVIDER unset (running a script by hand), it is claude.
//
//   claude    Claude Code on a Claude subscription: CLAUDE_CODE_OAUTH_TOKEN.
//             The model comes from CLAUDE_MODEL, falling back to
//             DEFAULT_CLAUDE_MODEL. To bill the API instead, pass ANTHROPIC_API_KEY here and in the
//             workflow's env in place of CLAUDE_CODE_OAUTH_TOKEN.
//   opencode  OpenCode on an OpenCode Go subscription: OPENCODE_API_KEY, a
//             personal key from the OpenCode Console. The model comes from
//             OPENCODE_MODEL, falling back to DEFAULT_OPENCODE_MODEL. The
//             workflows install OpenCode 1.x (`opencode-ai@1`), because
//             Sandcastle 0.14 drives the V1 command line.
//
// Sandcastle runs every agent with its permission checks skipped, so it can
// use any tool. Claude Code also accepts `permissionMode: "auto"` here for
// AI-mediated approvals instead (Claude only; other agents don't offer it).
export const AGENT_PROVIDERS = ["claude", "opencode"] as const;
export type AgentProviderName = (typeof AGENT_PROVIDERS)[number];

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5";
export const DEFAULT_OPENCODE_MODEL = "opencode-go/deepseek-v4.1-flash";

export const agentProviderName = (
  value: string | undefined
): AgentProviderName => {
  const name = value || "claude";
  if (!(AGENT_PROVIDERS as readonly string[]).includes(name)) {
    console.error(
      `Unknown AGENT_PROVIDER: ${name}. Use one of: ${AGENT_PROVIDERS.join(", ")}.`
    );
    process.exit(1);
  }
  return name as AgentProviderName;
};

const claudeAgent = () =>
  sandcastle.claudeCode(process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL, {
    env: {
      CLAUDE_CODE_OAUTH_TOKEN: required("CLAUDE_CODE_OAUTH_TOKEN"),
    },
  });

const opencodeAgent = () =>
  sandcastle.opencode(process.env.OPENCODE_MODEL || DEFAULT_OPENCODE_MODEL, {
    env: {
      OPENCODE_API_KEY: required("OPENCODE_API_KEY"),
    },
  });

export const factoryAgent = () => {
  switch (agentProviderName(process.env.AGENT_PROVIDER)) {
    case "claude":
      return claudeAgent();
    case "opencode":
      return opencodeAgent();
  }
};
