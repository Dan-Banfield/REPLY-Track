import { getCurrentUser } from '@features/logic/auth/session';
import { recordQuestion } from '@features/logic/stats';

import { scoreQuestion, type QuestionScore } from './scorer';
import { readSession, saveSession, type MessageAward, type Session } from './sessions';
import { streamTutorReply } from './tutor';

/** One line of the /api/chat response stream. */
export type ChatEvent =
  | { type: 'delta'; text: string }
  | { type: 'scoring' }
  | { type: 'award'; award: MessageAward }
  | { type: 'error' };

/**
 * POST /api/chat { sessionId, message }
 *
 * Streams newline-delimited JSON: the tutor's reply as `delta` events, `scoring`
 * when it has finished, then one `award` event once the XP has been recorded.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user.role !== 'student') {
    return Response.json({ error: 'Only students can run learning sessions.' }, { status: 403 });
  }

  const { sessionId, message } = await request.json();
  const session = await readSession(user.id, String(sessionId));
  if (!session || session.status !== 'active') {
    return Response.json({ error: 'Session not found.' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await answerQuestion(session, String(message), send);
      } catch (error) {
        console.error('Chat failed:', error);
        send({ type: 'error' });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

async function answerQuestion(
  session: Session,
  question: string,
  send: (event: ChatEvent) => void,
): Promise<void> {
  session.messages.push({ role: 'user', content: question });

  let reply = '';
  for await (const text of streamTutorReply(session)) {
    reply += text;
    send({ type: 'delta', text });
  }
  send({ type: 'scoring' });

  // Without the scorer, recordQuestion falls back to its keyword classifier.
  let score: QuestionScore | undefined;
  try {
    score = await scoreQuestion(session, question, reply);
  } catch (error) {
    console.error('Scoring failed, using the keyword classifier:', error);
  }

  const { gains, rankUps } = await recordQuestion({
    userId: session.userId,
    subject: session.subject,
    question,
    classification: score,
  });

  const award = { gains, rankUps, reason: score?.reason };
  session.messages.push({ role: 'assistant', content: reply, award });
  await saveSession(session);
  send({ type: 'award', award });
}
