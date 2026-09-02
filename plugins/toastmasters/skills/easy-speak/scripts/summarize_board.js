/* summarize_board.js — one-screen view of the signup board.
 *
 * Use this to VERIFY a write. read_board.js is the parser you act on; this is the small
 * thing you re-run afterwards to confirm what happened, without re-pasting 138 lines
 * every time the page reloads.
 *
 * The first line reports `ready` (document.readyState). After a click the page navigates,
 * so a result showing `loading`, or showing the old value, means the reload hasn't landed
 * yet — run this again rather than sleeping a fixed number of seconds and hoping. A sleep
 * that is too short reports "the write didn't take" when it did, which is the one kind of
 * lie this skill is supposed to avoid.
 *
 * Legend:  ** YOU **  a slot you hold        [open: n]  slot n is unclaimed
 *          <release?> a control on your slot (see read_board.js myControls)
 */
(() => {
  const STATUS = { '1': 'P', '6': 'O', '2': 'N', '5': '?' };
  const NAME = { '1': 'inPerson', '6': 'online', '2': 'notAttending', '5': 'undecided' };
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const out = [];

  const m = document.body.innerText.match(/Welcome back ([^\[]+)\[([^\]]+)\]/);
  const me = m ? clean(m[1]) : null;
  out.push(`ready: ${document.readyState} | ${me || 'NOT LOGGED IN'}`);

  const board = [...document.querySelectorAll('table')]
    .filter((t) => /Confirm Attendance/.test(t.innerText))
    .pop();
  if (!board) {
    const empty = /no data to report in this category/i.test(document.body.innerText);
    return out.concat(empty && me
      ? 'no upcoming meetings scheduled for this club (empty board, not an error)'
      : (me ? 'no board and no empty-state marker — is this /signup.php?' : 'not logged in')
    ).join('\n');
  }

  const cols = [...board.rows[0].cells].slice(1).map((c, i) => {
    const a = c.querySelector('a[href*="view_meeting.php"]');
    let id = null;
    if (a) { try { id = new URL(a.href, location.href).searchParams.get('t'); } catch (e) {} }
    return { i, label: clean(c.innerText), id };
  });

  const attRow = [...board.rows].find((r) => r.cells[0] && /Confirm Attendance/.test(r.cells[0].innerText));

  for (const c of cols) {
    const cell = attRow ? attRow.cells[c.i + 1] : null;
    const radios = cell ? [...cell.querySelectorAll('input[type=radio]')] : [];
    const on = radios.find((r) => r.checked);
    const offered = radios.map((r) => STATUS[r.value] || r.value).join(' ');
    out.push(`\n${c.label} (${c.id})  attendance: ${on ? NAME[on.value] : 'NONE'}   [offers: ${offered || '-'}]`);

    for (const row of [...board.rows]) {
      const label = row.cells[0] ? clean(row.cells[0].innerText) : '';
      if (!label || /^Role$/i.test(label) || /Confirm Attendance/.test(label)) continue;
      const rc = row.cells[c.i + 1];
      if (!rc) continue;

      const openSlots = [...rc.querySelectorAll('a[href*="action=volunteer"]')].map((a) => {
        try { return new URL(a.href, location.href).searchParams.get('n'); } catch (e) { return null; }
      });
      const uniqOpen = [...new Set(openSlots.filter(Boolean))];

      const names = [];
      clean(rc.innerText).replace(/(\d+)\s+(.+?)(?=\s+\d+(?:\s|$)|$)/g, (_, slot, name) => {
        const n = clean(name);
        if (!n || /^\d+$/.test(n) || uniqOpen.includes(slot)) return '';
        names.push(`${slot} ${n}`);
        return '';
      });

      const mine = me && rc.innerText.includes(me);
      const release = mine && [...rc.querySelectorAll('a[href]')].some((a) => {
        const h = a.getAttribute('href') || '';
        return !/kb\.php|action=volunteer/.test(h) && !/^\s*(javascript:)?\s*void\(0\)/.test(h);
      });

      const bits = [];
      if (names.length) bits.push(names.join(', '));
      if (uniqOpen.length) bits.push(`[open: ${uniqOpen.join(', ')}]`);
      if (mine) bits.push('** YOU **');
      if (release) bits.push('<release?>');
      out.push(`  ${label.padEnd(21)} ${bits.join('  ') || '—'}`);
    }
  }
  return out.join('\n');
})()
