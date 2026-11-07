/**
 * The Markdown "stats file" for a user: JSON frontmatter (a copy of the
 * profile) followed by feedback, readable tables and recent activity.
 *
 * Stored in student_stats.markdown on every save and uploaded to
 * student_files when a session finishes. The jsonb `data` column is the
 * source of truth; parseUserMarkdown() exists for code that only has the text
 * (e.g. the teacher's Students page reading student_files).
 */
import { buildHexagon, migrateSubjectState } from './engine';
import { StatsError, SUBJECTS } from './subjects';
import type { UserProfile } from './types';

/** Read the profile back out of a stats file's frontmatter. */
export function parseUserMarkdown(md: string): UserProfile {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new StatsError('User file is missing frontmatter', 500);
  return normaliseProfile(JSON.parse(m[1]) as UserProfile);
}

/** Fill in fields added after a profile was written (new stats, new keys). */
export function normaliseProfile(profile: UserProfile): UserProfile {
  profile.subjects ??= {};
  profile.activity ??= [];
  for (const [id, state] of Object.entries(profile.subjects)) {
    const def = SUBJECTS[id];
    if (def) migrateSubjectState(def, state);
  }
  return profile;
}

export function renderUserMarkdown(profile: UserProfile): string {
  const lines: string[] = [];
  lines.push('---', JSON.stringify(profile, null, 2), '---', '');
  lines.push(`# ${profile.displayName} — Learning Stats`, '');
  lines.push(`_User ID: \`${profile.userId}\` · Last updated: ${profile.updatedAt}_`, '');
  lines.push(
    '> Auto-generated. The JSON frontmatter above mirrors the database; this body is rewritten on every save.',
    '',
  );

  if (profile.feedback) {
    const { summary, strengths, workOn, updatedAt } = profile.feedback;
    lines.push('## Feedback', '', `_Updated ${updatedAt.slice(0, 10)}_`, '', summary, '');
    if (strengths.length) lines.push('**Doing well**', '', ...strengths.map((s) => `- ${s}`), '');
    if (workOn.length) lines.push('**To work on**', '', ...workOn.map((s) => `- ${s}`), '');
  }

  for (const [id, state] of Object.entries(profile.subjects)) {
    const def = SUBJECTS[id];
    if (!def) continue;
    const hex = buildHexagon(def, state);
    lines.push(
      `## ${hex.label}`,
      '',
      `Overall rank **${hex.overallRank}** · ${hex.totalXp} XP · ${hex.questions} questions`,
      '',
      '| Stat | Rank | Title | XP | Next rank at | Progress |',
      '|---|---|---|---|---|---|',
    );
    for (const a of hex.axes) {
      lines.push(
        `| ${a.label} | ${a.rank} | ${a.rankTitle} | ${a.xp} | ${a.xpForNextRank ?? 'MAX'} | ${bar(a.progressToNext)} |`,
      );
    }
    lines.push('');
  }

  if (profile.activity.length) {
    lines.push('## Recent activity', '');
    for (const e of profile.activity.slice(0, 20)) {
      const gains =
        Object.entries(e.gains)
          .map(([s, g]) => `${g > 0 ? '+' : ''}${g} ${s}`)
          .join(', ') || 'no XP';
      const ups = e.rankUps.length
        ? ` · ⬆ ${e.rankUps.map((r) => `${r.stat} → ${r.title}`).join(', ')}`
        : '';
      const q = e.question.replace(/\s+/g, ' ').replace(/\|/g, '/');
      lines.push(
        `- ${e.at.slice(0, 16).replace('T', ' ')} · ${e.subject} · ${e.depth} · ${gains}${ups} — "${q}"`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** The stats and activity sections of a user file: no frontmatter, title or feedback. */
export function userFileDetails(md: string): string {
  return md
    .split(/\n(?=## )/)
    .slice(1)
    .filter((section) => !section.startsWith('## Feedback'))
    .join('\n');
}

function bar(p: number): string {
  const n = Math.round(Math.min(Math.max(p, 0), 1) * 10);
  return '█'.repeat(n) + '░'.repeat(10 - n);
}
