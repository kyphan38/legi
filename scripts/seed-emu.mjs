// ---------------------------------------------------------------------------
// legi - Seed sample books and quotes in the EMULATOR (never the real project)
//
//   npm run seed -- <uid>
//
// uid: localStorage 'legi.uid' in the browser after an emulator sign-in.
// Writes over REST with "Bearer owner" (emulator only, skips the rules).
// ---------------------------------------------------------------------------

const uid = process.argv[2];
if (!uid) {
  console.error('usage: npm run seed -- <uid>');
  process.exit(1);
}

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-legi/databases/(default)/documents';
const DAY = 86_400_000;
const now = Date.now();

function value(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { mapValue: { fields: fields(v) } };
}
function fields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, value(v)]));
}

async function put(path, data) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fields(data) }),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
}

const BOOKS = [
  {
    id: 'seed-habits',
    title: 'Atomic Habits',
    author: 'James Clear',
    status: 'reading',
    totalPages: 320,
    sections: [
      ['c1', 'Chương 1: Sức mạnh của thói quen nhỏ', null],
      ['c1a', '1.1 Vì sao thay đổi nhỏ tạo khác biệt lớn', 'c1'],
      ['c1b', '1.2 Quên mục tiêu, tập trung vào hệ thống', 'c1'],
      ['c2', 'Chương 2: Thói quen định hình bản thân', null],
      ['c3', 'Chương 3: Bốn bước xây dựng thói quen', null],
      ['c3a', '3.1 Tín hiệu', 'c3'],
      ['c3b', '3.2 Khao khát', 'c3'],
    ],
    quotes: [
      ['c1a', 'Thói quen là lãi kép của sự tự cải thiện.', 18, true],
      ['c1a', 'Thành công là kết quả của những thói quen hằng ngày, không phải của một lần thay đổi lớn.', 21, false],
      ['c1b', 'Bạn không vươn lên bằng mục tiêu, bạn rơi xuống bằng hệ thống của mình.', 27, true],
      ['c2', 'Mỗi hành động là một lá phiếu cho con người bạn muốn trở thành.', 38, true],
      ['c3a', 'Nếu muốn tập đàn, hãy đặt cây đàn giữa phòng khách.', 84, false],
      ['c3b', 'Chính sự mong đợi phần thưởng, không phải phần thưởng, khiến ta hành động.', 106, false],
    ],
  },
  {
    id: 'seed-sapiens',
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    status: 'finished',
    totalPages: 512,
    finishedDaysAgo: 7,
    sections: [
      ['p1', 'Phần 1: Cách mạng nhận thức', null],
      ['p2', 'Phần 2: Cách mạng nông nghiệp', null],
    ],
    quotes: [
      ['p1', 'Con người có thể hợp tác linh hoạt với vô số người lạ nhờ những câu chuyện chung.', 31, true],
      ['p2', 'Cách mạng nông nghiệp là trò lừa lớn nhất trong lịch sử.', 90, true],
      ['p2', 'Một xa xỉ phẩm có xu hướng trở thành nhu cầu và sinh ra nghĩa vụ mới.', 101, false],
    ],
  },
  { id: 'seed-deep', title: 'Deep Work', author: 'Cal Newport', status: 'reading', totalPages: 296, sections: [], quotes: [['', 'Làm việc sâu là kỹ năng ngày càng hiếm và ngày càng có giá trị.', 14, false]] },
  { id: 'seed-nguoi', title: 'Nhà giả kim', author: 'Paulo Coelho', status: 'finished', totalPages: 228, sections: [], quotes: [['', 'Khi bạn thật lòng mong muốn điều gì, cả vũ trụ sẽ hợp lực giúp bạn đạt được nó.', 22, true]] },
  { id: 'seed-thinking', title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', status: 'later', totalPages: 499, sections: [], quotes: [] },
  { id: 'seed-dac', title: 'Đắc nhân tâm', author: 'Dale Carnegie', status: 'later', totalPages: null, sections: [], quotes: [] },
];

let n = 0;
for (const [bi, b] of BOOKS.entries()) {
  const sections = b.sections.map(([id, title, parentId], i) => ({ id, title, parentId, order: i + 1 }));
  const finishedAt = b.finishedDaysAgo ? now - b.finishedDaysAgo * DAY : b.status === 'finished' ? now - 60 * DAY : null;
  const maxPage = Math.max(0, ...b.quotes.map((q) => q[2]));
  await put(`users/${uid}/books/${b.id}`, {
    title: b.title,
    author: b.author,
    status: b.status,
    format: 'paper',
    totalPages: b.totalPages,
    currentPage: maxPage || null,
    pdfUrl: null,
    takeaway: null,
    sections,
    startedAt: now - 90 * DAY,
    finishedAt,
    lastOpenedAt: now - bi * DAY,
    deletedAt: null,
    createdAt: now - 90 * DAY,
    updatedAt: now,
  });
  for (const [qi, [sectionId, text, page, favorite]] of b.quotes.entries()) {
    const createdAt = now - (30 - qi) * DAY;
    await put(`users/${uid}/quotes/${b.id}-q${qi}`, {
      bookId: b.id,
      sectionId: sectionId || null,
      kind: 'quote',
      text,
      note: qi === 0 ? 'Ghi chú: câu này đáng đọc lại mỗi sáng.' : '',
      page,
      favorite,
      source: 'typed',
      answeredBy: null,
      shownCount: 0,
      lastShownAt: null,
      trashedWithBook: false,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
    });
    n++;
  }
}

// One quote written on this day last year, for "On this day".
const lastYear = new Date(now);
lastYear.setFullYear(lastYear.getFullYear() - 1);
await put(`users/${uid}/quotes/seed-onthisday`, {
  bookId: 'seed-nguoi',
  sectionId: null,
  kind: 'quote',
  text: 'Bí mật của cuộc sống là ngã bảy lần và đứng dậy tám lần.',
  note: '',
  page: 140,
  favorite: false,
  source: 'typed',
  answeredBy: null,
  shownCount: 0,
  lastShownAt: null,
  trashedWithBook: false,
  deletedAt: null,
  createdAt: lastYear.getTime(),
  updatedAt: lastYear.getTime(),
});

// A thought and a question in the Inbox.
for (const [id, kind, text] of [
  ['seed-inbox-1', 'thought', 'Có lẽ mình nên đọc lại chương về môi trường trước khi đổi chỗ làm việc.'],
  ['seed-inbox-2', 'question', 'Thói quen xấu có thể "xoá" hẳn được không, hay chỉ thay thế?'],
]) {
  await put(`users/${uid}/quotes/${id}`, {
    bookId: null,
    sectionId: null,
    kind,
    text,
    note: '',
    page: null,
    favorite: false,
    source: 'typed',
    answeredBy: null,
    shownCount: 0,
    lastShownAt: null,
    trashedWithBook: false,
    deletedAt: null,
    createdAt: now - DAY,
    updatedAt: now - DAY,
  });
}

console.log(`Seeded ${BOOKS.length} books and ${n + 3} quotes for ${uid}.`);
