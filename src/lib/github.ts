import type { Env } from "../types";

export interface TranslationFeedbackForIssue {
  id: string;
  language: string;
  screen?: string | null;
  note?: string | null;
  correction?: string | null;
  platform?: string | null;
  app_version?: string | null;
}

/** Repo that translation issues are filed against when GITHUB_ISSUES_REPO is unset. */
const DEFAULT_REPO = "KeckerCo/true-confessions-compose-multiplatform";

/**
 * Opens a GitHub issue for an in-app translation-feedback submission so it can be
 * triaged and assigned (e.g. to Claude) to open a fix PR.
 *
 * Best-effort and self-contained: never throws. Call it via `ctx.waitUntil(...)`
 * so issue creation runs after the response and can never delay or fail the user's
 * submission. No-ops when GITHUB_TOKEN is not configured.
 */
export async function createTranslationFeedbackIssue(
  env: Env,
  fb: TranslationFeedbackForIssue,
): Promise<void> {
  try {
    const token = env.GITHUB_TOKEN;
    if (!token) return; // feature not configured

    // Skip empty/garbage submissions so they don't create noise issues.
    const primary = (fb.note ?? fb.correction ?? "").trim();
    if (primary.length < 3) return;

    const repo = env.GITHUB_ISSUES_REPO?.trim() || DEFAULT_REPO;
    const shortNote = primary.length > 60 ? `${primary.slice(0, 57)}…` : primary;
    const title = `[i18n] Translation issue (${fb.language})${
      fb.screen ? ` — ${fb.screen}` : ""
    }: ${shortNote}`;

    const body = [
      "A user reported a translation problem via the in-app **Report a translation issue** form.",
      "",
      "| Field | Value |",
      "|---|---|",
      `| Language | \`${fb.language}\` |`,
      `| Screen | ${fb.screen ? `\`${fb.screen}\`` : "—"} |`,
      `| Platform | ${fb.platform ?? "—"} |`,
      `| App version | ${fb.app_version ?? "—"} |`,
      `| Feedback id | \`${fb.id}\` |`,
      "",
      "**User's note**",
      codeFence(fb.note),
      ...(fb.correction
        ? ["", "**Suggested correction**", codeFence(fb.correction)]
        : []),
      "",
      "---",
      `Translations for \`${fb.language}\` live in the mobile app:`,
      "- Compose strings: `composeApp/src/commonMain/composeResources/values-<lang>/strings.xml`",
      "- Localized content JSON: `composeApp/src/commonMain/composeResources/files/*.<lang>.json`",
      "- Shared strings: `composeApp/src/commonMain/kotlin/org/irbsseminary/trueconfessions/i18n/AppStrings.kt`",
      "",
      `Fix the affected \`${fb.language}\` translation and open a PR.`,
    ].join("\n");

    const assignees = (env.GITHUB_ISSUE_ASSIGNEES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "parable-service-cloudflare",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body,
        labels: ["translation", "i18n", `lang:${fb.language}`],
        ...(assignees.length ? { assignees } : {}),
      }),
    });

    if (!res.ok) {
      console.error(
        `[translation-issue] GitHub returned ${res.status}: ${await res.text()}`,
      );
    }
  } catch (err) {
    // Never let issue creation affect the request.
    console.error("[translation-issue] failed to create issue", err);
  }
}

/**
 * Renders untrusted user text inside a fenced code block so it can't inject
 * Markdown or @mentions (mention-spam) into the issue. Strips any backtick fences
 * from the content so it can't break out of the block.
 */
function codeFence(text?: string | null): string {
  const t = (text ?? "").trim();
  if (!t) return "```\n(none)\n```";
  const safe = t.replace(/```/g, "'''");
  return `\`\`\`\n${safe}\n\`\`\``;
}
