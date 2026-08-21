/* read_board.js — parse the easy-Speak signup board into JSON.
 *
 * Run in the page context at /signup.php. Returns a JSON string.
 *
 * Why this exists: every operation in this skill starts by reading this board, and
 * hand-rolling the parse each time is slow and gets the edge cases wrong (see the
 * `quizmaster` note in references/site-map.md). Run this instead.
 *
 * Output shape:
 * {
 *   "session":  {"loggedIn": true, "fullName": "...", "username": "..."},
 *   "dateRange": "No more dates available",
 *   "meetings": [{"col": 0, "label": "24 Aug 26", "meetingId": "700001"}],
 *   "attendance": [{"meetingId": "700001", "status": "none|inPerson|online|notAttending|undecided"}],
 *   "roles": [{
 *      "role": "Evaluator",
 *      "meetingId": "700001",
 *      "occupants": [{"slot": "1", "name": "Carol Example"}],
 *      "openSlots": [{"mark": "es-3", "roleItemId": "50004", "slot": "2", "mode": "inPerson"}],
 *      "mine": false
 *   }]
 * }
 *
 * Each actionable element is tagged with a `data-es-mark` attribute. Click it later by
 * that mark rather than by coordinates — see scripts/click_mark.js.
 *
 * IMPORTANT: this deliberately never emits a raw `key=value` query string. The Chrome
 * extension blocks tool output that looks like cookie/query-string data, and a naive
 * dump of hrefs will come back as [BLOCKED] and cost you a round trip.
 */
(() => {
  const STATUS = { '1': 'inPerson', '6': 'online', '2': 'notAttending', '5': 'undecided' };
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  const m = document.body.innerText.match(/Welcome back ([^\[]+)\[([^\]]+)\]/);
  const session = m
    ? { loggedIn: true, fullName: clean(m[1]), username: clean(m[2]) }
    : { loggedIn: false, fullName: null, username: null };

  const board = [...document.querySelectorAll('table')]
    .filter((t) => /Confirm Attendance/.test(t.innerText))
    .pop();
  if (!board) {
    return JSON.stringify({ session, error: 'signup board not found — are you on /signup.php?' });
  }

  const dr = document.body.innerText.match(/Date Range:\s*(.*)/);

  const meetings = [...board.rows[0].cells].slice(1).map((cell, i) => {
    const a = cell.querySelector('a[href*="view_meeting.php"]');
    let id = null;
    if (a) { try { id = new URL(a.href, location.href).searchParams.get('t'); } catch (e) {} }
    return { col: i, label: clean(cell.innerText), meetingId: id };
  });

  const attRow = [...board.rows].find((r) => r.cells[0] && /Confirm Attendance/.test(r.cells[0].innerText));
  let mark = 0;
  const attendance = meetings.map((mt) => {
    const cell = attRow ? attRow.cells[mt.col + 1] : null;
    const radios = cell ? [...cell.querySelectorAll('input[type=radio]')] : [];
    const on = radios.find((r) => r.checked);
    const controls = {};
    radios.forEach((r) => {
      const tag = 'es-' + mark++;
      r.setAttribute('data-es-mark', tag);
      controls[STATUS[r.value] || r.value] = tag;
    });
    return { meetingId: mt.meetingId, status: on ? STATUS[on.value] : 'none', controls };
  });

  const roles = [];
  for (const row of [...board.rows]) {
    const label = row.cells[0] ? clean(row.cells[0].innerText) : '';
    // Skip the header and the attendance row. Do NOT filter on the presence of a kb.php
    // link — the Quizmaster row has none, and keying on it silently drops the row.
    if (!label || /^Role$/i.test(label) || /Confirm Attendance/.test(label)) continue;
    if (!row.cells[1]) continue;

    for (const mt of meetings) {
      const cell = row.cells[mt.col + 1];
      if (!cell) continue;

      const occupants = [];
      clean(cell.innerText).replace(/(\d+)\s+(.+?)(?=\s+\d+(?:\s|$)|$)/g, (_, slot, name) => {
        const n = clean(name);
        if (n) occupants.push({ slot, name: n });
        return '';
      });

      const openSlots = [];
      cell.querySelectorAll('a[href*="action=volunteer"]').forEach((a) => {
        let u; try { u = new URL(a.href, location.href); } catch (e) { return; }
        const tag = 'es-' + mark++;
        a.setAttribute('data-es-mark', tag);
        openSlots.push({
          mark: tag,
          roleItemId: u.searchParams.get('r'),
          slot: u.searchParams.get('n'),
          mode: u.searchParams.get('att') === '6' ? 'online' : 'inPerson',
          title: clean(a.getAttribute('title') || (a.querySelector('img') || {}).title || ''),
        });
      });

      const mine = session.fullName ? cell.innerText.includes(session.fullName) : false;
      roles.push({ role: label, meetingId: mt.meetingId, occupants, openSlots, mine });
    }
  }

  return JSON.stringify(
    { session, dateRange: dr ? clean(dr[1]) : null, meetings, attendance, roles },
    null,
    1
  );
})()
