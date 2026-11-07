import type {
  Classification,
  QuestionDepth,
  StatId,
  StatWeights,
  SubjectDefinition,
} from "./types";

/**
 * Fallback, dependency-free classifier.
 *
 * The preferred path is for the chatbot/LLM to send its own classification
 * (weights + depth) with the question. This exists so the system still works
 * when it doesn't, and for quick demos.
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Keyword -> regex cache, keyed by keyword. */
const regexCache = new Map<string, RegExp>();
function keywordRegex(keyword: string): RegExp {
  let re = regexCache.get(keyword);
  if (!re) {
    // Allow optional plural "s"/"es" on the final word; whole-word match.
    re = new RegExp(`\\b${escapeRegex(keyword)}(?:e?s)?\\b`, "gi");
    regexCache.set(keyword, re);
  }
  re.lastIndex = 0;
  return re;
}

/**
 * Score each stat by keyword hits. Longer phrases are matched first and their
 * text is consumed, so "linear algebra" doesn't also count as "algebra".
 * A phrase of N words scores N.
 */
export function classifyStats(
  subject: SubjectDefinition,
  question: string,
): { weights: StatWeights; matches: Record<StatId, string[]> } {
  let text = ` ${question.toLowerCase()} `;

  const all: { stat: StatId; keyword: string }[] = [];
  for (const stat of subject.stats) {
    for (const keyword of stat.keywords) all.push({ stat: stat.id, keyword });
  }
  all.sort((a, b) => b.keyword.length - a.keyword.length);

  const scores: Record<StatId, number> = {};
  const matches: Record<StatId, string[]> = {};

  for (const { stat, keyword } of all) {
    const re = keywordRegex(keyword);
    let hit = false;
    text = text.replace(re, (m) => {
      hit = true;
      return " ".repeat(m.length);
    });
    if (hit) {
      scores[stat] = (scores[stat] ?? 0) + keyword.split(/\s+/).length;
      (matches[stat] ??= []).push(keyword);
    }
  }

  return { weights: scores, matches };
}

const DEPTH_PATTERNS: [QuestionDepth, RegExp][] = [
  [
    "conceptual",
    /\b(why|how come|intuition|intuitively|prove|proof of|relate|relationship|difference between|what if|derive|where does .* come from)\b/i,
  ],
  [
    "apply",
    /\b(how (do|would|can|should) (i|you|we)|solve|calculate|compute|find|work out|evaluate|determine|show that|example)\b/i,
  ],
  [
    "clarify",
    /\b(confused|don'?t (get|understand)|explain|clarify|what does .* mean|makes? no sense|stuck|lost)\b/i,
  ],
  ["recall", /\b(what is|what's|what are|define|definition|formula for|name of|list)\b/i],
];

export function classifyDepth(question: string): QuestionDepth {
  for (const [depth, re] of DEPTH_PATTERNS) {
    if (re.test(question)) return depth;
  }
  return "clarify";
}

export function classifyQuestion(
  subject: SubjectDefinition,
  question: string,
): Classification {
  const { weights, matches } = classifyStats(subject, question);
  const depth = classifyDepth(question);
  const hasHits = Object.keys(weights).length > 0;
  return {
    weights,
    depth,
    source: hasHits ? "keyword" : "none",
    matches,
  };
}
