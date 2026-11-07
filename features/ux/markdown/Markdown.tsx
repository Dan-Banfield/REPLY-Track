// Keep the katex package on the version rehype-katex uses: class names change
// between versions, and a mismatched stylesheet draws \boxed and ≠ wrongly.
import 'katex/dist/katex.min.css';

import ReactMarkdown, { type Options } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import styles from './Markdown.module.css';

const REMARK_PLUGINS = [remarkGfm, remarkMath];

/** The text can include what a student typed, so never let it load images or show links. */
const DISALLOWED_ELEMENTS = ['a', 'img'];

/** Half-streamed maths fails to parse for a moment, so show it as plain text, not in red. */
const REHYPE_PLUGINS: Options['rehypePlugins'] = [[rehypeKatex, { errorColor: 'currentColor' }]];

/**
 * remark-math only treats $$ as display maths when each delimiter sits on its
 * own line. Models often write `$$x = 1$$`, sometimes across several lines, and
 * one such block breaks every equation after it. Keeps the indent so an
 * equation inside a list stays in the list.
 */
function displayMathOnOwnLines(text: string): string {
  return text.replace(
    /([ \t]*)\$\$([\s\S]+?)\$\$/g,
    (_match, indent: string, maths: string) =>
      `\n\n${indent}$$\n${indent}${maths.trim()}\n${indent}$$\n\n`,
  );
}

/** Renders Markdown, with LaTeX maths between $ or $$. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className={`md-typescale-body-large ${styles.markdown}`}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        disallowedElements={DISALLOWED_ELEMENTS}
        unwrapDisallowed
      >
        {displayMathOnOwnLines(children)}
      </ReactMarkdown>
    </div>
  );
}
