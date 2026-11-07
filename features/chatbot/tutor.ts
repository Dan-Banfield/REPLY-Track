import { getSubject } from '@features/logic/stats';

import { openai, TUTOR_MODEL } from './openai';
import type { Session } from './sessions';

function tutorInstructions(subjectLabel: string): string {
  return [
    `You are a friendly ${subjectLabel} tutor for a school student.`,
    'Guide them with hints and questions first. Give a full worked answer once they have tried, or if they ask again.',
    `Only help with ${subjectLabel}. If they ask about something else, steer them back.`,
    'Keep replies short.',
    'Format replies with Markdown. Write all maths in LaTeX, with $...$ inline and $$...$$ on its own line. Never use \\( or \\[. Write a dollar amount as \\$5.',
  ].join('\n');
}

/** Streams the tutor's reply to the conversation so far, one piece of text at a time. */
export async function* streamTutorReply(session: Session): AsyncGenerator<string> {
  const stream = await openai().responses.create({
    model: TUTOR_MODEL,
    instructions: tutorInstructions(getSubject(session.subject).label),
    input: session.messages.map(({ role, content }) => ({ role, content })),
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      yield event.delta;
    }
  }
}
