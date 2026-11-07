import OpenAI from 'openai';

/** The model that talks to the student. */
export const TUTOR_MODEL = process.env.OPENAI_TUTOR_MODEL ?? 'gpt-6.1-sol';

/** The cheaper model that scores questions and writes quizzes. */
export const SCORER_MODEL = process.env.OPENAI_SCORER_MODEL ?? 'gpt-6-luna';

let client: OpenAI | undefined;

/** Created on first use, so a missing OPENAI_API_KEY only fails the chat, not every page. */
export function openai(): OpenAI {
  client ??= new OpenAI();
  return client;
}

/** Asks the scorer model for JSON matching `schema` (OpenAI Structured Outputs). */
export async function structuredResponse<T>(request: {
  name: string;
  schema: Record<string, unknown>;
  instructions: string;
  input: string;
}): Promise<T> {
  const response = await openai().responses.create({
    model: SCORER_MODEL,
    instructions: request.instructions,
    input: request.input,
    text: {
      format: { type: 'json_schema', name: request.name, strict: true, schema: request.schema },
    },
  });
  return JSON.parse(response.output_text) as T;
}
