import { recordQuestion, type ProvidedClassification } from '../service';
import { displayNameFor, handle, readJson, requireUser } from './http';

/**
 * POST /api/stats/me/questions  { question, subject?, classification? }
 * Record a question the logged-in user asked the chatbot and award XP.
 * Prefer calling recordQuestion() directly from the chatbot's server code.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson<{
      question: string;
      subject: string;
      classification: ProvidedClassification;
    }>(req);
    return recordQuestion({
      userId: user.id,
      question: body.question as string,
      subject: body.subject,
      classification: body.classification,
      displayName: displayNameFor(user),
    });
  });
}
