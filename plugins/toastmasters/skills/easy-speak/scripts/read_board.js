/* read_board.js — parse the easy-Speak signup board into JSON.
 *
 * Run in the page context at /signup.php. Returns a compact JSON string.
 *
 * Why this exists: every operation starts by reading this board, and hand-rolling the
 * parse gets the edge cases wrong. Two of them have already caused real misreads:
 *
 *   - A cell holding two *empty* slots renders as "1 2". A naive parse reads that as a
 *     member named "2" occupying slot 1 — inventing a person and hiding an open role at
 *     the same time. Guarded below by rejecting all-digit names and by dropping any
 *     occupant whose slot number also has a volunteer link.
 *   - The Quizmaster row has no kb.php link, so filtering role rows on that link silently
 *     drops the row.
 *
 * ## The output budget is about 950 characters
 *
 * Measured against the Chrome extension on 2026-09-11: a returned string longer than
 * roughly 950 characters comes back with `[TRUNCATED]` appended. This is the single most
 * important constraint on this script, and it is far tighter than it looks. An earlier
 * version emitted every role row for every meeting column and blew the budget on a
 * four-meeting board, returning JSON cut off mid-array.
 *
 * A truncated read is worse than a failed one. It is not obviously broken — it looks like
 * a board with fewer meetings, or fewer filled roles, than the club actually has. Reports
 * built on it are confidently wrong.
 *
 * So this script does three things about it:
 *
 *   1. Emits a compact shape by default: who you are, every meeting, your own status at
 *      each, and your own roles. That is the answer to most questions and it fits easily.
 *   2. Emits per-role detail only for the meetings you ask for (`ONLY`).
 *   3. **Checks its own length before returning.** Over budget, it returns a short error
 *      naming what to narrow rather than a truncated board. Never silently oversized.
 *
 * ## Placeholders
 *
 * Substitute these two bare tokens before running. They are written as bare tokens so a
 * blunt find-and-replace hits the assignments below and not this comment.
 *
 *   ONLY    which meetings get full `roles` detail:
 *             null                 none — overview only (default, always fits)
 *             "646586"             one meeting id
 *             ["646586","646587"]  several
 *             0                    by column index, when you only have header labels
 *             "all"                every meeting (will usually be over budget; expect
 *                                  the error and narrow from there)
 *
 *   MARKS   whether to tag clickable elements and report their marks:
 *             false   a read — no marks, much smaller output (default)
 *             true    you are about to write, and need marks to click by
 *
 *   Marks cost roughly 20 characters each and a full board has dozens, so asking for them
 *   on a wide read is the fastest way over budget. Ask for them when you intend to click.
 *
 * The two shapes that matter for writes both fit:
 *
 *   ONLY = null,       MARKS = true   attendance controls for every meeting, no role
 *                                     detail — what "set my attendance for the next N
 *                                     meetings" needs
 *   ONLY = "<id>",     MARKS = true   that meeting's role slots and its attendance
 *                                     controls — what claiming a role or declining needs
 *
 * ## Output
 *
 * {
 *   "user":      "Dmitri Kochelorov",
 *   "dateRange": "14 Sep 26 - 05 Oct 26",
 *   "meetings":  [{"id":"646586","label":"14 Sep 26","me":"notAttending"}],
 *   "myRoles":   [{"role":"Timer","id":"646586"}],
 *   "controls":  {"646586":{"inPerson":"es-0","notAttending":"es-2"}},   // MARKS only
 *   "roles":     [{"role":"Evaluator","id":"646586",
 *                  "taken":"1 Carol Example",
 *                  "open":[{"slot":"2","mode":"inPerson","mark":"es-4"}]}]  // ONLY
 * }
 *
 * `me` is one of `inPerson`, `online`, `notAttending`, `undecided`, `none`. `none` means
 * never responded and is a different state from `undecided`; do not collapse them.
 *
 * `controls` lists only the attendance choices this board actually renders. Clubs that
 * don't meet online have no `online` entry and no online icon on their open slots — so
 * read what is there rather than assuming the full P/O/N/? set exists.
 *
 * `myControls` on a role row captures whatever control appears in a cell you occupy (the
 * release affordance), so it can be studied without being clicked.
 *
 * Marks do not survive a page load. Re-run this after every write, both to re-tag and to
 * verify. Never emit raw `key=value` query strings: the extension blocks tool output that
 * looks like cookie or query-string data and the call returns [BLOCKED], so pull the
 * fields you need out of a URL rather than passing it through.
 */
(() => {
  const ONLY = __ONLY__;
  const MARKS = __MARKS__;
  const BUDGET = 900; // under the observed ~950 cap, with headroom for the wrapper

  const STATUS = { '1': 'inPerson', '6': 'online', '2': 'notAttending', '5': 'undecided' };
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  let mark = 0;
  const tag = (el) => {
    if (!MARKS) return undefined;
    const t = 'es-' + mark++;
    el.setAttribute('data-es-mark', t);
    return t;
  };

  const m = document.body.innerText.match(/Welcome back ([^\[]+)\[([^\]]+)\]/);
  const session = m ? { fullName: clean(m[1]), username: clean(m[2]) } : null;

  const board = [...document.querySelectorAll('table')]
    .filter((t) => /Confirm Attendance/.test(t.innerText))
    .pop();
  if (!board) {
    // An empty board is not an error. When the club has nothing scheduled, /signup.php
    // renders "There is no data to report in this category for your club" and no table at
    // all. Reporting that as "board not found" sends the reader hunting for a broken
    // selector or a wrong URL when the real answer is that the VPE hasn't scheduled yet.
    if (!session) return JSON.stringify({ error: 'not logged in' });
    if (/no data to report in this category/i.test(document.body.innerText)) {
      return JSON.stringify({ user: session.fullName, meetings: [], empty: true,
        note: 'no upcoming meetings scheduled for this club' });
    }
    return JSON.stringify({ user: session.fullName,
      error: 'no board and no empty-state marker — is this /signup.php?' });
  }

  const dr = document.body.innerText.match(/Date Range:\s*(.*)/);
  const headers = [...board.rows[0].cells].slice(1).map((cell, i) => {
    const a = cell.querySelector('a[href*="view_meeting.php"]');
    let id = null;
    if (a) { try { id = new URL(a.href, location.href).searchParams.get('t'); } catch (e) {} }
    return { col: i, label: clean(cell.innerText), id };
  });

  // Match on meetingId or column index, so a caller holding only header labels can still
  // scope the read. An id matching nothing yields no role detail rather than falling back
  // to everything — a wrong id should look wrong, not look like a full board.
  const wanted = ONLY === null || ONLY === undefined
    ? new Set()
    : ONLY === 'all'
      ? null
      : new Set((Array.isArray(ONLY) ? ONLY : [ONLY]).map(String));
  const detailed = headers.filter((mt) => !wanted || wanted.has(String(mt.id)) || wanted.has(String(mt.col)));

  // Attendance controls follow the same scope as roles, because four meetings' worth of
  // them is ~340 characters and on its own pushes a single-meeting read over budget.
  // The exception is an unscoped read: with no role detail competing for room, every
  // meeting's controls fit, and that is exactly the shape a "set my attendance across the
  // next N meetings" pass needs.
  const wantControls = (mt) => MARKS && (!wanted || wanted.size === 0 || detailed.includes(mt));

  const attRow = [...board.rows].find((r) => r.cells[0] && /Confirm Attendance/.test(r.cells[0].innerText));
  const controls = {};
  const meetings = headers.map((mt) => {
    const cell = attRow ? attRow.cells[mt.col + 1] : null;
    const radios = cell ? [...cell.querySelectorAll('input[type=radio]')] : [];
    const on = radios.find((r) => r.checked);
    if (wantControls(mt)) {
      const opts = {};
      radios.forEach((r) => { opts[STATUS[r.value] || r.value] = tag(r); });
      controls[mt.id] = opts;
    }
    return { id: mt.id, label: mt.label, me: on ? STATUS[on.value] : 'none' };
  });

  const roles = [];
  const myRoles = [];
  for (const row of [...board.rows]) {
    const label = row.cells[0] ? clean(row.cells[0].innerText) : '';
    if (!label || /^Role$/i.test(label) || /Confirm Attendance/.test(label)) continue;
    if (!row.cells[1]) continue;

    for (const mt of headers) {
      const cell = row.cells[mt.col + 1];
      if (!cell) continue;

      const mine = !!(session && cell.innerText.includes(session.fullName));
      // Your own roles are cheap and always wanted — "am I speaking soon" must not depend
      // on having guessed the right meeting to scope to.
      if (mine) myRoles.push({ role: label, id: mt.id });
      if (!detailed.includes(mt)) continue;

      const open = [];
      cell.querySelectorAll('a[href*="action=volunteer"]').forEach((a) => {
        let u; try { u = new URL(a.href, location.href); } catch (e) { return; }
        const o = { slot: u.searchParams.get('n'),
          mode: u.searchParams.get('att') === '6' ? 'online' : 'inPerson' };
        const t = tag(a);
        if (t) o.mark = t;
        open.push(o);
      });
      const openSlotNumbers = new Set(open.map((o) => o.slot));

      const occupants = [];
      clean(cell.innerText).replace(/(\d+)\s+(.+?)(?=\s+\d+(?:\s|$)|$)/g, (_, slot, name) => {
        const n = clean(name);
        // "1 2" is two empty slots, not a member called "2".
        if (!n || /^\d+$/.test(n)) return '';
        // A slot that offers a volunteer link cannot also be occupied.
        if (openSlotNumbers.has(slot)) return '';
        occupants.push(slot + ' ' + n);
        return '';
      });
      // Single-slot rows (Grammarian, Timer, …) render the occupant with no slot number,
      // so the numbered regex above finds nothing and the name would be lost. Fall back to
      // the raw cell text — but only when it contains something other than slot numbers.
      // A cell reading "1 2" is two *empty* slots, and this fallback is exactly where that
      // becomes a member named "1 2" if left unguarded.
      const raw = clean(cell.innerText);
      if (!occupants.length && !open.length && raw && !/^[\d\s]+$/.test(raw)) occupants.push(raw);

      const entry = { role: label, id: mt.id };
      if (occupants.length) entry.taken = occupants.join('; ');
      if (open.length) entry.open = open;
      if (mine) {
        entry.mine = true;
        if (MARKS) {
          const myControls = [];
          cell.querySelectorAll('a[href]').forEach((a) => {
            const href = a.getAttribute('href') || '';
            if (/kb\.php/.test(href) || /^\s*(javascript:)?\s*void\(0\)/.test(href)) return;
            if (/action=volunteer/.test(href)) return;
            const img = a.querySelector('img');
            myControls.push({ mark: tag(a),
              title: clean(a.getAttribute('title') || (img && img.getAttribute('title')) || ''),
              icon: img ? img.src.split('/').pop() : null });
          });
          if (myControls.length) entry.myControls = myControls;
        }
      }
      roles.push(entry);
    }
  }

  const out = { user: session ? session.fullName : null };
  if (dr) out.dateRange = clean(dr[1]);
  out.meetings = meetings;
  if (myRoles.length) out.myRoles = myRoles;
  if (Object.keys(controls).length) out.controls = controls;
  if (roles.length) out.roles = roles;

  // Refuse to return something the tool will truncate. A short honest error keeps the
  // caller narrowing; a truncated board sends them off reporting numbers that aren't real.
  const json = JSON.stringify(out);
  if (json.length > BUDGET) {
    return JSON.stringify({
      error: 'output over budget',
      chars: json.length,
      budget: BUDGET,
      meetings: meetings.map((x) => x.id + ' ' + x.label + ' ' + x.me),
      fix: roles.length
        ? 'narrow ONLY to fewer meeting ids, and set MARKS false unless you are about to click'
        : 'this board is unusually wide — read it one meeting at a time',
    });
  }
  return json;
})()
