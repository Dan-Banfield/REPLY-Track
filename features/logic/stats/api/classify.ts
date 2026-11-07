import { resolveClassification, type ProvidedClassification } from '../service';
import { StatsError } from '../subjects';
import { handle, readJson, requireUser } from './http';

/** POST /api/stats/classify  { question, subject?, classification? } — dry run, writes nothing. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireUser();
    const body = await readJson<{
      question: string;
      subject: string;
      classification: ProvidedClassification;
    }>(req);
    if (typeof body.question !== 'string' || !body.question.trim()) {
      throw new StatsError('question is required', 400);
    }
    return resolveClassification(body.subject ?? 'maths', body.question, body.classification);
  });
}
