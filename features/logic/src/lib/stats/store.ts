/**
 * Persistence: one Markdown file per user at  <DATA_DIR>/<userId>.md
 *
 * File layout:
 *   ---
 *   { ...UserProfile as JSON... }      <- source of truth (JSON is valid YAML frontmatter)
 *   ---
 *   # <name> — Learning Stats          <- human-readable summary, regenerated on every save
 *   ...
 *
 * Only the frontmatter is read back. Never hand-edit the body; edit the JSON if needed.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { MAX_ACTIVITY } from "./config";
import { buildHexagon, migrateSubjectState } from "./engine";
import { SUBJECTS, StatsError } from "./subjects";
import type { UserProfile } from "./types";

export const DATA_DIR = process.env.STATS_DATA_DIR
  ? path.resolve(process.env.STATS_DATA_DIR)
  : path.join(process.cwd(), "data", "users");

const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function assertValidUserId(userId: string): void {
  if (!USER_ID_RE.test(userId)) {
    throw new StatsError("userId must be 1-64 chars of letters, digits, '_' or '-'", 400);
  }
}

function userFile(userId: string): string {
  assertValidUserId(userId); // also prevents path traversal
  return path.join(DATA_DIR, `${userId}.md`);
}

// ---------- per-user write lock (single Node process) ----------

const locks = new Map<string, Promise<unknown>>();

/** Serialise read-modify-write cycles per user so concurrent requests don't lose XP. */
export async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(userId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => undefined);
  locks.set(userId, tail);
  try {
    return await run;
  } finally {
    if (locks.get(userId) === tail) locks.delete(userId);
  }
}

// ---------- parse / serialise ----------

export function parseUserMarkdown(md: string): UserProfile {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new StatsError("User file is missing frontmatter", 500);
  const profile = JSON.parse(m[1]) as UserProfile;
  for (const [id, state] of Object.entries(profile.subjects)) {
    const def = SUBJECTS[id];
    if (def) migrateSubjectState(def, state);
  }
  profile.activity ??= [];
  return profile;
}

export function renderUserMarkdown(profile: UserProfile): string {
  const lines: string[] = [];
  lines.push("---", JSON.stringify(profile, null, 2), "---", "");
  lines.push(`# ${profile.displayName} — Learning Stats`, "");
  lines.push(`_User ID: \`${profile.userId}\` · Last updated: ${profile.updatedAt}_`, "");
  lines.push("> Auto-generated. The JSON frontmatter above is the source of truth; this body is rewritten on every save.", "");

  for (const [id, state] of Object.entries(profile.subjects)) {
    const def = SUBJECTS[id];
    if (!def) continue;
    const hex = buildHexagon(def, state);
    lines.push(
      `## ${hex.label}`,
      "",
      `Overall rank **${hex.overallRank}** · ${hex.totalXp} XP · ${hex.questions} questions`,
      "",
      "| Stat | Rank | Title | XP | Next rank at | Progress |",
      "|---|---|---|---|---|---|",
    );
    for (const a of hex.axes) {
      lines.push(
        `| ${a.label} | ${a.rank} | ${a.rankTitle} | ${a.xp} | ${a.xpForNextRank ?? "MAX"} | ${bar(a.progressToNext)} |`,
      );
    }
    lines.push("");
  }

  if (profile.activity.length) {
    lines.push("## Recent activity", "");
    for (const e of profile.activity.slice(0, 20)) {
      const gains = Object.entries(e.gains).map(([s, g]) => `+${g} ${s}`).join(", ") || "no XP";
      const ups = e.rankUps.length ? ` · ⬆ ${e.rankUps.map((r) => `${r.stat} → ${r.title}`).join(", ")}` : "";
      const q = e.question.replace(/\s+/g, " ").replace(/\|/g, "/");
      lines.push(`- ${e.at.slice(0, 16).replace("T", " ")} · ${e.subject} · ${e.depth} · ${gains}${ups} — "${q}"`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function bar(p: number): string {
  const n = Math.round(p * 10);
  return "█".repeat(n) + "░".repeat(10 - n);
}

// ---------- file I/O ----------

export async function readUser(userId: string): Promise<UserProfile | null> {
  try {
    const md = await fs.readFile(userFile(userId), "utf8");
    return parseUserMarkdown(md);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeUser(profile: UserProfile): Promise<void> {
  const file = userFile(profile.userId);
  profile.activity = profile.activity.slice(0, MAX_ACTIVITY);
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, renderUserMarkdown(profile), "utf8");
  await fs.rename(tmp, file); // atomic replace
}

export async function listUserIds(): Promise<string[]> {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.slice(0, -3))
      .filter((id) => USER_ID_RE.test(id));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}
