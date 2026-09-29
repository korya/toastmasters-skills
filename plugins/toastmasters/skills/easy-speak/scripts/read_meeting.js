/* read_meeting.js — parse one meeting page into JSON: whole-club attendance, or roles.
 *
 * Run in the page context at /view_meeting.php?t=<meetingId> — or on the page the sidebar's
 * "Last Meeting" link opens, which is how to reach the most recent closed meeting without
 * knowing its id. Returns a compact JSON string.
 *
 * Why this exists: the signup board only knows the logged-in member's attendance, and only
 * for meetings still open to sign-up. "Who's coming?" and "who came today?" are both
 * answered here and nowhere else.
 *
 * ## The page has two phases, with different vocabularies
 *
 *   upcoming  section "Confirm Attendance"; the list holds EVERY member, most of them
 *             `Unknown`. The logged-in member's own row shows live P/O/N/? radios where
 *             the others show a status word.
 *   past      section "Actual Attendance"; statuses read `Attended` / `Attended Online`,
 *             and the list holds ONLY those who came — plus the logged-in member, who is
 *             listed either way. Absentees are not rows here; they are the gap between
 *             the list and the membership count.
 *
 * A meeting turns `past` when its agenda closes ("Agenda closed to online user changes"),
 * which happens on the day — before the meeting has necessarily started. From then on it
 * is also gone from /signup.php, so "the next meeting" on the board is next week's.
 *
 * Status words are reported verbatim, as the page spells them (`NOT Attending` is the
 * site's casing, not a typo here). Do not map them onto the board's codes: `Unknown` is
 * the board's `none`, but nothing here distinguishes it from a deliberate `?`.
 *
 * ## Output budget
 *
 * Same ~950-character ceiling as read_board.js, for the same reason: a truncated list
 * reads as a smaller turnout rather than a broken read. So:
 *
 *   - `Unknown` is reported as a count, never as names. It is most of the club on any
 *     upcoming meeting and would blow the budget on its own.
 *   - Attendance and roles are separate reads (`WHAT`).
 *   - Over budget, this returns a short error instead of a cut-off list.
 *
 * ## What this deliberately leaves out
 *
 * A closed agenda prints the online-meeting link, id and passcode in plain text. Those are
 * the club's keys; they never belong in tool output or a reply, so nothing here reads them.
 *
 * ## Placeholder
 *
 *   WHAT   "attendance" (default) or "roles". Substitute the bare token below.
 *
 * Output, WHAT = "attendance":
 *   { "user": "...", "id": "646587", "when": "Monday 21st September 2026 at 12:00 pm",
 *     "phase": "past", "total": "8 + 3 Online", "members": 23, "me": "Unknown",
 *     "byStatus": {"Attended": ["..."], "Attended Online": ["..."]}, "unknown": 0,
 *     "prev": "646586", "next": "646588" }
 *
 * `me` is the status word, or on an upcoming meeting the checked radio as read_board.js
 * names it (`inPerson` / `online` / `notAttending` / `undecided` / `none`). `byStatus`
 * never includes the logged-in member. `prev`/`next` come from the page's own Previous /
 * Next links — walk those rather than guessing neighbouring ids, which are not contiguous.
 *
 * Output, WHAT = "roles":
 *   { "user": "...", "id": "...", "when": "...", "phase": "...",
 *     "roles": [{"role": "1st Speaker", "who": "...", "speech": "..."}, {"role": "Timer"}] }
 *
 * A role with no `who` is unfilled. `speech` is the title line only.
 */
(() => {
  const WHAT = __WHAT__;
  const BUDGET = 900;
  const RADIO = { '1': 'inPerson', '6': 'online', '2': 'notAttending', '5': 'undecided' };
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const lines = (el) => (el.innerText || '').split('\n').map(clean).filter(Boolean);
  const param = (a, k) => { try { return new URL(a.href, location.href).searchParams.get(k); } catch (e) { return null; } };

  const m = document.body.innerText.match(/Welcome back ([^\[]+)\[([^\]]+)\]/);
  if (!m) return JSON.stringify({ error: 'not logged in' });
  const user = clean(m[1]);

  // Innermost table carrying the marker: the page nests tables ~70 deep and wide, and an
  // outer layout table matches any text its descendants do.
  const innermost = (re) => [...document.querySelectorAll('table')].filter((t) => re.test(t.innerText)).pop();

  const att = innermost(/Total Attendance/);
  if (!att) return JSON.stringify({ user, error: 'no attendance block — is this /view_meeting.php?t=<id>?' });

  const body = document.body.innerText;
  const when = body.match(/\b\w+day \d+\w* \w+ \d{4} at [\d:]+ ?[ap]m/i);
  // Reached through the sidebar's "Last Meeting" link the URL carries no `t`, only the
  // club and `show=last`; the page's own printable-agenda link still names the meeting.
  const agenda = document.querySelector('a[href*="viewagenda.php"]');
  const out = {
    user,
    id: new URL(location.href).searchParams.get('t') || (agenda ? param(agenda, 't') : null),
    when: when ? when[0] : null,
    phase: /Actual Attendance/.test(att.innerText) ? 'past' : 'upcoming',
  };

  if (WHAT === 'roles') {
    const rt = innermost(/Presenter/);
    if (!rt) return JSON.stringify({ ...out, error: 'no roles table found' });
    out.roles = [];
    for (const row of [...rt.rows]) {
      if (row.cells.length < 3 || !/^row\d/.test(row.cells[0].className)) continue;
      const role = lines(row.cells[0])[0];
      if (!role) continue;
      const [who, speech] = lines(row.cells[2]);
      const entry = { role };
      if (who) entry.who = who;
      if (speech) entry.speech = speech;
      out.roles.push(entry);
    }
  } else {
    const total = att.innerText.match(/Total Attendance\s*:\s*([^\n]+)/);
    const members = att.innerText.match(/Member \([^/]*\/\s*(\d+)\)/);
    out.total = total ? clean(total[1]) : null;
    out.members = members ? +members[1] : null;
    out.byStatus = {};
    out.unknown = 0;
    // The member list is the unnamed group; guests and visitors get their own suffixed divs.
    const list = att.querySelector('div[id="status_div_"] table');
    for (const row of list ? [...list.rows] : []) {
      if (row.cells.length < 2) continue;
      const name = clean(row.cells[0].innerText);
      if (!name) continue;
      const radios = [...row.cells[1].querySelectorAll('input[type=radio]')];
      const status = clean(row.cells[1].innerText);
      if (name === user) {
        const on = radios.find((r) => r.checked);
        out.me = radios.length ? (on ? RADIO[on.value] || on.value : 'none') : status;
      } else if (/^unknown$/i.test(status)) {
        out.unknown++;
      } else {
        (out.byStatus[status] = out.byStatus[status] || []).push(name);
      }
    }
  }

  const nav = (label) => {
    const a = [...document.querySelectorAll('a[href*="view_meeting.php"]')].find((x) => clean(x.innerText) === label);
    return a ? param(a, 't') : null;
  };
  out.prev = nav('Previous');
  out.next = nav('Next');

  const json = JSON.stringify(out);
  if (json.length > BUDGET) {
    return JSON.stringify({ user, id: out.id, error: `over budget (${json.length} > ${BUDGET})`,
      hint: WHAT === 'roles' ? 'long speech titles — read the page text for this one' : 'unusually large turnout — report `total` and read names from the page text',
      total: out.total });
  }
  return json;
})()
