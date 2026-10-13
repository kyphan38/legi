import { Fragment } from 'react';

import { parseEmph } from '@/lib/emph';

/** Quote text with **emphasis** and a hanging opening quote mark. `marks` = [start, end) grapheme-free char ranges to bold (search). */
export default function QuoteText({ text, marks }: { text: string; marks?: [number, number][] }) {
  if (marks && marks.length) return <Marked text={text} marks={marks} />;
  const runs = parseEmph(text);
  const first = runs[0];
  const hang = first && /^[“"‘]/.test(first.text);
  return (
    <>
      {runs.map((r, i) => {
        const content =
          i === 0 && hang ? (
            <>
              <span className="hang">{r.text[0]}</span>
              {r.text.slice(1)}
            </>
          ) : (
            r.text
          );
        return r.strong ? (
          <strong key={i} className="font-semibold">
            {content}
          </strong>
        ) : (
          <Fragment key={i}>{content}</Fragment>
        );
      })}
    </>
  );
}

/** Search results: bold the matched parts, show ** as plain text-free. */
function Marked({ text, marks }: { text: string; marks: [number, number][] }) {
  const out: React.ReactNode[] = [];
  let at = 0;
  marks.forEach(([a, b], i) => {
    if (a > at) out.push(<Fragment key={`t${i}`}>{text.slice(at, a)}</Fragment>);
    out.push(
      <strong key={`m${i}`} className="font-semibold">
        {text.slice(a, b)}
      </strong>,
    );
    at = b;
  });
  if (at < text.length) out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{out}</>;
}
