'use client';

import { MaterialForm, SubmitButton } from '@features/ux/material/MaterialForm';

import styles from './chatbot.module.css';
import type { ClientSession } from './sessions';

/** The end-of-session quiz: one radio group per question, all required. */
export function QuizForm({
  quiz,
  pending,
  onSubmit,
}: {
  quiz: ClientSession['quiz'];
  pending: boolean;
  onSubmit: (answers: number[]) => void;
}) {
  return (
    <MaterialForm
      action={(formData) => {
        onSubmit(quiz.map((_, index) => Number(formData.get(`question-${index}`))));
      }}
    >
      <h2 className="md-typescale-title-large">Session quiz</h2>
      {quiz.map((question, questionIndex) => (
        <fieldset key={questionIndex} className={styles.question}>
          <legend className="md-typescale-title-medium">
            {questionIndex + 1}. {question.question}
          </legend>
          {question.options.map((option, optionIndex) => {
            const id = `question-${questionIndex}-${optionIndex}`;
            return (
              <div key={id} className={styles.option}>
                {/* suppressHydrationWarning: md-radio adds tabindex on startup (see MaterialWeb.tsx). */}
                <md-radio
                  id={id}
                  name={`question-${questionIndex}`}
                  value={String(optionIndex)}
                  required
                  suppressHydrationWarning
                />
                <label htmlFor={id} className="md-typescale-body-large">
                  {option}
                </label>
              </div>
            );
          })}
        </fieldset>
      ))}
      <SubmitButton pending={pending} pendingLabel="Marking…">
        Submit answers
      </SubmitButton>
    </MaterialForm>
  );
}
