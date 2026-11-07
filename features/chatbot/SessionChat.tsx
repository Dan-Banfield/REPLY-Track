'use client';

import { memo, useEffect, useRef, useState, type ReactNode } from 'react';

import { Markdown } from '@features/ux/markdown/Markdown';
import { FormError } from '@features/ux/material/MaterialForm';

import { endSession, startSession, submitQuiz } from './actions';
import type { ChatEvent } from './chatRoute';
import styles from './chatbot.module.css';
import { Composer } from './Composer';
import { QuizForm } from './QuizForm';
import type { ChatMessage, ClientSession, MessageAward } from './sessions';

const FAILED = 'Something went wrong. Please try again.';

/** Scrolled less than this far from the bottom still counts as "at the bottom". */
const STICK_DISTANCE = 80;

const STARTERS = [
  'Why does the chain rule work?',
  'Help me factorise a quadratic',
  'What is an eigenvector, intuitively?',
  'How do I work out a conditional probability?',
];

const NO_MESSAGES: ChatMessage[] = [];

type StatLabels = Record<string, string>;

/** The study screen: chat, then the quiz, then a summary. The first message starts the session. */
export function SessionChat({
  initialSession,
  statLabels,
}: {
  initialSession: ClientSession | null;
  statLabels: StatLabels;
}) {
  const [session, setSession] = useState(initialSession);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<ClientSession>) {
    setPending(true);
    setError(null);
    try {
      setSession(await task());
    } catch (failure) {
      console.error(failure);
      setError(FAILED);
    }
    setPending(false);
  }

  if (session?.status === 'quiz') {
    return (
      <Screen>
        <div className={styles.thread}>
          <div className={styles.column}>
            <QuizForm
              quiz={session.quiz}
              pending={pending}
              onSubmit={(answers) => void run(() => submitQuiz(session.id, answers))}
            />
            <FormError message={error} />
          </div>
        </div>
      </Screen>
    );
  }

  if (session?.status === 'finished') {
    return (
      <Screen>
        <Summary session={session} onRestart={() => setSession(null)} />
      </Screen>
    );
  }

  return (
    <Chat
      session={session}
      statLabels={statLabels}
      ending={pending}
      endError={error}
      onSession={setSession}
      onEnd={(sessionId) => void run(() => endSession(sessionId))}
    />
  );
}

/** Fills the window under a slim header. `action` sits at the right of the header. */
function Screen({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className="md-typescale-title-large">Study</h1>
        {action}
      </header>
      {children}
    </div>
  );
}

function Chat({
  session,
  statLabels,
  ending,
  endError,
  onSession,
  onEnd,
}: {
  session: ClientSession | null;
  statLabels: StatLabels;
  ending: boolean;
  endError: string | null;
  onSession: (session: ClientSession) => void;
  onEnd: (sessionId: string) => void;
}) {
  const [input, setInput] = useState('');
  /** The question in flight, and the reply so far. The server saves them together at the end. */
  const [asked, setAsked] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thread = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const messages = session?.messages ?? NO_MESSAGES;
  const sending = asked !== null;
  const empty = messages.length === 0 && !sending;

  useEffect(() => {
    if (stickToBottom.current) {
      thread.current?.scrollTo({ top: thread.current.scrollHeight });
    }
  }, [messages, asked, draft, scoring]);

  async function send(text: string) {
    const question = text.trim();
    stickToBottom.current = true;
    setInput('');
    setError(null);
    setDraft('');
    setAsked(question);

    try {
      const current = session ?? (await startSession());
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: current.id, message: question }),
      });
      if (!response.ok || !response.body) throw new Error(`Chat failed: ${response.status}`);

      let reply = '';
      let award: MessageAward | undefined;
      for await (const event of readEvents(response.body)) {
        if (event.type === 'delta') {
          reply += event.text;
          setDraft(reply);
        } else if (event.type === 'scoring') {
          setScoring(true);
        } else if (event.type === 'award') {
          award = event.award;
        } else {
          throw new Error('Chat failed on the server.');
        }
      }
      if (!award) throw new Error('Chat ended early.');

      onSession({
        ...current,
        messages: [
          ...current.messages,
          { role: 'user', content: question },
          { role: 'assistant', content: reply, award },
        ],
      });
    } catch (failure) {
      console.error(failure);
      setInput(question);
      setError(FAILED);
    }
    setAsked(null);
    setScoring(false);
  }

  return (
    <Screen
      action={
        session &&
        messages.length > 0 && (
          <md-outlined-button disabled={sending || ending} onClick={() => onEnd(session.id)}>
            {ending ? 'Writing your quiz…' : 'End & take quiz'}
          </md-outlined-button>
        )
      }
    >
      <div className={styles.chat} data-empty={empty || undefined}>
        {empty ? (
          <h2 className={`md-typescale-headline-medium ${styles.greeting}`}>
            What would you like to work on?
          </h2>
        ) : (
          <div
            ref={thread}
            className={styles.thread}
            role="log"
            onScroll={({ currentTarget: { scrollHeight, scrollTop, clientHeight } }) => {
              stickToBottom.current = scrollHeight - scrollTop - clientHeight < STICK_DISTANCE;
            }}
          >
            <div className={styles.column}>
              {messages.map((message, index) => (
                <Message key={index} message={message} statLabels={statLabels} />
              ))}
              {sending && (
                <>
                  <StudentMessage content={asked} />
                  <div className={styles.tutor}>
                    {draft ? <Markdown>{draft}</Markdown> : <Thinking />}
                    {scoring && (
                      <p className={`md-typescale-label-medium ${styles.scoring}`}>
                        Scoring your question…
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className={styles.dock}>
          <FormError message={error ?? endError} />
          <Composer value={input} busy={sending} onChange={setInput} onSend={send} />
          {!empty && (
            <p className={`md-typescale-body-small ${styles.disclaimer}`}>
              The tutor can make mistakes, so check important answers.
            </p>
          )}
        </div>

        {empty && (
          <ul className={styles.starters}>
            {STARTERS.map((starter) => (
              <li key={starter}>
                <button
                  type="button"
                  className={`md-typescale-label-large ${styles.starter}`}
                  onClick={() => void send(starter)}
                >
                  {starter}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
}

/** Memoised so typing or a streaming reply doesn't re-render every earlier message. */
const Message = memo(function Message({
  message,
  statLabels,
}: {
  message: ChatMessage;
  statLabels: StatLabels;
}) {
  if (message.role === 'user') {
    return <StudentMessage content={message.content} />;
  }
  return (
    <div className={styles.tutor}>
      <Markdown>{message.content}</Markdown>
      {message.award && <AwardLine award={message.award} statLabels={statLabels} />}
    </div>
  );
});

function StudentMessage({ content }: { content: string }) {
  return <p className={`md-typescale-body-large ${styles.student}`}>{content}</p>;
}

function Thinking() {
  return <span className={styles.thinking} role="status" aria-label="The tutor is thinking" />;
}

/** e.g. "+13 Discrete · Rank up: Discrete is now Apprentice". Renders nothing for a question worth no XP. */
function AwardLine({ award, statLabels }: { award: MessageAward; statLabels: StatLabels }) {
  const parts = [
    ...Object.entries(award.gains).map(([stat, xp]) => `+${xp} ${statLabels[stat] ?? stat}`),
    ...award.rankUps.map(
      (rankUp) => `Rank up: ${statLabels[rankUp.stat] ?? rankUp.stat} is now ${rankUp.title}`,
    ),
  ];
  if (parts.length === 0) return null;

  return <p className={`md-typescale-label-medium ${styles.award}`}>{parts.join(' · ')}</p>;
}

function Summary({ session, onRestart }: { session: ClientSession; onRestart: () => void }) {
  const questionXp = session.messages
    .flatMap((message) => Object.values(message.award?.gains ?? {}))
    .reduce((sum, xp) => sum + xp, 0);
  const result = session.result;

  return (
    <section className={styles.summary}>
      <h2 className="md-typescale-headline-small">Session complete</h2>
      {result && (
        <p className="md-typescale-body-large">
          Quiz: {result.correct} of {result.total} correct (
          {result.xp < 0 ? `−${-result.xp}` : `+${result.xp}`} XP). Questions: +{questionXp} XP.
        </p>
      )}
      <div className={styles.actions}>
        <md-filled-button onClick={onRestart}>Start another session</md-filled-button>
        <md-outlined-button href="/dashboard">See my progress</md-outlined-button>
      </div>
    </section>
  );
}

/** Reads the newline-delimited JSON stream from /api/chat. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      yield JSON.parse(line) as ChatEvent;
    }
  }
}
