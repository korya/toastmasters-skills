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
 * Output (arrays are omitted when empty, to keep the result inside tool output limits):
 * {
 *   "session":   {"loggedIn":true,"fullName":"...","username":"..."},
 *   "dateRange": "No more dates available",
 *   "meetings":  [{"col":0,"label":"24 Aug 26","meetingId":"700001"}],
 *   "attendance":[{"meetingId":"700001","status":"none","options":{"inPerson":"es-0", ...}}],
 *   "roles":     [{"role":"Evaluator","meetingId":"700001",
 *                  "occupants":[{"slot":"1","name":"Carol Example"}],
 *                  "open":[{"mark":"es-4","r":"50004","slot":"2","mode":"inPerson"}],
 *                  "mine":true,
 *                  "myControls":[{"mark":"es-9","title":"..."}]}]
 * }
 *
 * `options` lists only the attendance choices this board actually renders. Clubs that
 * don't meet online have no `online` option, and their open slots have no online icon —
 * so read what is there rather than assuming the full P/O/N/? set exists.
 *
 * `myControls` captures whatever controls appear in a cell the logged-in user occupies
 * (the release affordance). Reported so it can be studied without being clicked.
 *
 * Elements are tagged with `data-es-mark`; click them via scripts/click_mark.js. Marks do
 * not survive a page load, so re-run this after every write.
 *
 * Never emit raw `key=value` query strings — the Chrome extension blocks tool output that
 * looks like cookie or query-string data, and the call comes back as [BLOCKED].
 */
(() => {
  const STATUS = { '1': 'inPerson', '6': 'online', '2': 'notAttending', '5': 'undecided' };
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  let mark = 0;
  const tag = (el) => { const t = 'es-' + mark++; el.setAttribute('data-es-mark', t); return t; };

  const m = document.body.innerText.match(/Welcome back ([^\[]+)\[([^\]]+)\]/);
  const session = m
    ? { loggedIn: true, fullName: clean(m[1]), username: clean(m[2]) }
    : { loggedIn: false };

  const board = [...document.querySelectorAll('table')]
    .filter((t) => /Confirm Attendance/.test(t.innerText))
    .pop();
  if (!board) {
    // An empty board is not an error. When the club has nothing scheduled, /signup.php
    // renders "There is no data to report in this category for your club" and no table at
    // all. Reporting that as "board not found" sends the reader hunting for a broken
    // selector or a wrong URL when the real answer is that the VPE hasn't scheduled yet.
    const empty = /no data to report in this category/i.test(document.body.innerText);
    if (empty && session.loggedIn) {
      return JSON.stringify({ session, meetings: [], attendance: [], roles: [], empty: true,
        note: 'no upcoming meetings scheduled for this club' });
    }
    return JSON.stringify({ session, error: session.loggedIn
      ? 'no board and no empty-state marker — is this /signup.php?'
      : 'not logged in' });
  }

  const dr = document.body.innerText.match(/Date Range:\s*(.*)/);

  const meetings = [...board.rows[0].cells].slice(1).map((cell, i) => {
    const a = cell.querySelector('a[href*="view_meeting.php"]');
    let id = null;
    if (a) { try { id = new URL(a.href, location.href).searchParams.get('t'); } catch (e) {} }
    return { col: i, label: clean(cell.innerText), meetingId: id };
  });

  const attRow = [...board.rows].find((r) => r.cells[0] && /Confirm Attendance/.test(r.cells[0].innerText));
  const attendance = meetings.map((mt) => {
    const cell = attRow ? attRow.cells[mt.col + 1] : null;
    const radios = cell ? [...cell.querySelectorAll('input[type=radio]')] : [];
    const on = radios.find((r) => r.checked);
    const options = {};
    radios.forEach((r) => { options[STATUS[r.value] || r.value] = tag(r); });
    return { meetingId: mt.meetingId, status: on ? STATUS[on.value] : 'none', options };
  });

  const roles = [];
  for (const row of [...board.rows]) {
    const label = row.cells[0] ? clean(row.cells[0].innerText) : '';
    if (!label || /^Role$/i.test(label) || /Confirm Attendance/.test(label)) continue;
    if (!row.cells[1]) continue;

    for (const mt of meetings) {
      const cell = row.cells[mt.col + 1];
      if (!cell) continue;

      const open = [];
      cell.querySelectorAll('a[href*="action=volunteer"]').forEach((a) => {
        let u; try { u = new URL(a.href, location.href); } catch (e) { return; }
        open.push({
          mark: tag(a),
          r: u.searchParams.get('r'),
          slot: u.searchParams.get('n'),
          mode: u.searchParams.get('att') === '6' ? 'online' : 'inPerson',
        });
      });
      const openSlotNumbers = new Set(open.map((o) => o.slot));

      const occupants = [];
      clean(cell.innerText).replace(/(\d+)\s+(.+?)(?=\s+\d+(?:\s|$)|$)/g, (_, slot, name) => {
        const n = clean(name);
        // "1 2" is two empty slots, not a member called "2".
        if (!n || /^\d+$/.test(n)) return '';
        // A slot that offers a volunteer link cannot also be occupied.
        if (openSlotNumbers.has(slot)) return '';
        occupants.push({ slot, name: n });
        return '';
      });

      const mine = !!(session.fullName && cell.innerText.includes(session.fullName));

      const myControls = [];
      if (mine) {
        cell.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href') || '';
          if (/kb\.php/.test(href) || /^\s*(javascript:)?\s*void\(0\)/.test(href)) return;
          if (/action=volunteer/.test(href)) return;
          const img = a.querySelector('img');
          myControls.push({
            mark: tag(a),
            title: clean(a.getAttribute('title') || (img && img.getAttribute('title')) || ''),
            icon: img ? img.src.split('/').pop() : null,
          });
        });
      }

      const entry = { role: label, meetingId: mt.meetingId };
      if (occupants.length) entry.occupants = occupants;
      if (open.length) entry.open = open;
      if (mine) entry.mine = true;
      if (myControls.length) entry.myControls = myControls;
      roles.push(entry);
    }
  }

  const out = { session, meetings, attendance, roles };
  if (dr) out.dateRange = clean(dr[1]);
  return JSON.stringify(out);
})()
