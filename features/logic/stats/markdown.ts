import { buildHexagon } from './engine';
import { SUBJECTS } from './subjects';
import type { UserProfile } from './types';

/**
 * Render a user's stats as a Markdown document: JSON frontmatter (a copy of
 * the profile) followed by human-readable tables and the recent activity.
 * Stored in student_stats.markdown on every save. The jsonb `data` column is
 * the source of truth; this is a readable/exportable copy and is never parsed.
 */
export function renderUserMarkdown(profile: UserProfile): string {
  const lines: string[] = [];
  lines.push('---', JSON.stringify(profile, null, 2), '---', '');
  lines.push(`# ${profile.displayName} — Learning Stats`, '');
  lines.push(`_User ID: \`${profile.userId}\` · Last updated: ${profile.updatedAt}_`, '');

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
      const gains = Object.entries(e.gains).map(([s, g]) => `+${g} ${s}`).join(', ') || 'no XP';
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

function bar(p: number): string {
  const n = Math.round(p * 10);
  return '█'.repeat(n) + '░'.repeat(10 - n);
}
