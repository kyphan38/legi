import TopBar from '@/components/TopBar';

// legi - In-app guide. Plain English, one block per feature.
// Keep it in sync when a feature changes.

type Block = { title: string; lines: string[] };

const BLOCKS: Block[] = [
  {
    title: 'Opening the app',
    lines: [
      'The first open of the day shows the Daily quote. A legi day starts at 04:00.',
      'Later opens go to the last book, cursor ready.',
    ],
  },
  {
    title: 'Daily',
    lines: [
      'One quote or thought from your books. Open questions are left out.',
      'open in book goes to it. another picks a different one. continue goes back to writing.',
      'Below, a quote saved on this date in an earlier year, if there is one.',
      'Daily in the top bar shows today\'s quote again.',
      'Tap a book title to edit the book. daily off leaves that book out.',
    ],
  },
  {
    title: 'Shelf',
    lines: [
      'Books sit in three piles: reading, finished, later. Switch between shelf and list.',
      'A thicker spine has more quotes. A longer one has more pages.',
      'elsewhere holds sources that are not books: a video, a web page or a person.',
      'Inbox holds quotes with no book yet. Long press to select, then move them into a book.',
    ],
  },
  {
    title: 'Writing quotes',
    lines: [
      'Type in the box at the bottom of a book. Pick Quote, Thought or Question.',
      'A blank line starts a new quote. Enter on an empty last line saves. ⌘Enter saves anywhere.',
      'Add p52 at the end to set the page. The page carries over to the next quote.',
      'Pasted text with blank lines asks if you want to split it. Lines starting with # become sections.',
      'Pasted PDF text is cleaned: broken lines are joined and page numbers dropped.',
      '-> becomes →. ⌘B makes the selection bold.',
      'The dot shows where it is saved. Hollow: on this device. Filled: in the cloud.',
    ],
  },
  {
    title: 'Voice',
    lines: [
      'Tap the mic to start, tap again to stop. Up to 2 minutes.',
      'Say "xuống dòng" for a new line, "đoạn mới" for a new paragraph.',
    ],
  },
  {
    title: 'Photos of pages',
    lines: [
      'Take or pick photos of pages with pencil marks. Crop each one to the part you need.',
      'legi reads the marked passages. Check the list, untick what you do not want, then save.',
      'Offline, photos wait in Snaps until you are back online.',
    ],
  },
  {
    title: 'Sections',
    lines: [
      'Pick where the next quote goes, or add a section. A new section comes right after the current one.',
      'contents shows the outline of the book. On a wide screen it sits on the left.',
    ],
  },
  {
    title: 'One quote',
    lines: [
      'Long press (or right click) a quote for: edit, star, move, move up or down, select, read slowly from here, delete.',
      'Select several to move them together.',
    ],
  },
  {
    title: 'Questions',
    lines: [
      'questions on the Shelf lists open questions by book.',
      'Answer one by picking the quote that answers it.',
    ],
  },
  {
    title: 'Read slowly',
    lines: [
      'One quote per screen. Swipe or tap the right half for the next one.',
      'all or starred picks which quotes. listen reads them aloud and moves on.',
      'Esc goes back to the book at this quote.',
    ],
  },
  {
    title: 'Finishing a book',
    lines: ['When a book is finished, legi asks what stays with you. The answer shows under the header.'],
  },
  {
    title: 'Search',
    lines: [
      'Search ignores Vietnamese marks: "thoi quen" finds "thói quen".',
      'On Mac, ⌘K or / opens search and commands.',
    ],
  },
  {
    title: 'Delete and Trash',
    lines: [
      'Delete moves to Trash. Undo works for 5 seconds (or ⌘Z).',
      'Trash keeps things for 30 days. Restore them from Settings.',
    ],
  },
  {
    title: 'Settings',
    lines: ['Theme, text size and the typewriter effect.', 'Export all quotes as Markdown or JSON.'],
  },
  {
    title: 'Keys on Mac',
    lines: [
      'n new quote · j / k next and previous · e edit · f star · x select · m move · ⌫ delete.',
      '[ and ] fold and unfold all · ? shows all keys.',
    ],
  },
];

export default function GuidePage() {
  return (
    <main className="paper pb-24">
      <TopBar current="settings" />

      <h1 className="mt-10 text-[15px] text-ink">Guide</h1>

      {BLOCKS.map((b) => (
        <section key={b.title} className="mt-8">
          <h2 className="text-[13px] text-faint">{b.title}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {b.lines.map((line) => (
              <li key={line} className="text-[15px] leading-relaxed text-muted">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
