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
 *
 * ## Output budget
 *
 * The extension truncates a returned string at roughly 950 characters, and a full block
 * for one meeting runs about 300, so a four-meeting board does not fit. Rather than let
 * the tail get cut off — which would read as "that role is unfilled" when really it was
 * never printed — this emits whole meeting blocks until the budget is spent and then
 * names the meetings it left out.
 *
 * Every meeting's attendance line is printed either way. The summary must never be able
 * to hide a meeting outright; it is the thing that verifies writes.
 *
 * Substitute the `ONLY` token to pick which meetings get the full role listing:
 *   null                 as many as fit, nearest first (default)
 *   "646586"             one meeting id
 *   ["646586","646587"]  several
 */
(() => {
  const ONLY = __ONLY__;
  const BUDGET = 900;
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

  const wanted = ONLY === null || ONLY === undefined
    ? null
    : new Set((Array.isArray(ONLY) ? ONLY : [ONLY]).map(String));

  // Attendance for every meeting, always — one short line each, and the half of the
  // summary that must never go missing.
  const status = {};
  for (const c of cols) {
    const cell = attRow ? attRow.cells[c.i + 1] : null;
    const radios = cell ? [...cell.querySelectorAll('input[type=radio]')] : [];
    const on = radios.find((r) => r.checked);
    status[c.i] = {
      line: `${c.label} (${c.id})  attendance: ${on ? NAME[on.value] : 'NONE'}`,
      offers: radios.map((r) => STATUS[r.value] || r.value).join(' ') || '-',
    };
    out.push(status[c.i].line);
  }

  const skipped = [];
  for (const c of cols) {
    if (wanted && !wanted.has(String(c.id)) && !wanted.has(String(c.i))) { skipped.push(c.label); continue; }

    const block = [`\n${status[c.i].line}   [offers: ${status[c.i].offers}]`];
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
      const raw = clean(rc.innerText);
      raw.replace(/(\d+)\s+(.+?)(?=\s+\d+(?:\s|$)|$)/g, (_, slot, name) => {
        const n = clean(name);
        if (!n || /^\d+$/.test(n) || uniqOpen.includes(slot)) return '';
        names.push(`${slot} ${n}`);
        return '';
      });
      // Single-slot roles (Toastmaster, Grammarian, Timer, …) print the occupant with no
      // slot number, so the numbered regex above finds nobody and the role renders as
      // empty — which reads as "this role is open" for a role that is actually filled.
      // Fall back to the raw cell text, but never when it is only slot numbers: "1 2" is
      // two empty slots, not a member.
      if (!names.length && !uniqOpen.length && raw && !/^[\d\s]+$/.test(raw)) names.push(raw);

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
      block.push(`  ${label.padEnd(21)} ${bits.join('  ') || '—'}`);
    }

    // Spend the budget on whole blocks. A half-printed meeting is worse than an omitted
    // one: the reader cannot tell a role that is genuinely unfilled from a line that was
    // cut off, and this is the script they trust to confirm a write landed.
    const blockText = block.join('\n');
    if (out.join('\n').length + blockText.length + 1 > BUDGET) { skipped.push(c.label); continue; }
    out.push(blockText);
  }

  if (skipped.length) out.push(`\nroles not listed for: ${skipped.join(', ')} — re-run scoped to one of these`);
  return out.join('\n');
})()
