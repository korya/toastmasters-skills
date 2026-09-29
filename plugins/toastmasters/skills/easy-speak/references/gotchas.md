# Write mechanics and traps

Loaded on demand from SKILL.md. Read this before the first write of a session: the
mechanics come first, then the traps that bite hand-rolled approaches.

## Write mechanics

**Click by mark, not by coordinates.** Read the board with `MARKS = true` to tag every actionable element
with `data-es-mark`, then `scripts/click_mark.js` clicks one by that tag, dispatching a real click so the
page's own handlers run exactly as they would for a human. Coordinate clicks on a table of identical icons
are how you sign someone up as Grammarian when they asked for Timer.

A coordinate click buys you nothing here, so reaching for one is always a mistake. It is not "more real"
than a dispatched click — both reach the page's handlers identically, including handlers that call
`window.open`. If a click appears to do nothing, the cause is something else; look before you escalate.

**Decline is the one control with its own script.** `scripts/decline.js` handles `N` end to end because the
window it opens cannot be reached any other way. See the popup entry below.

**Re-read the board afterwards.** The page reloads on every write, which destroys the marks and can reorder
columns. Re-running is both how you re-tag and how you verify. Report the state you observed, not the state
you intended — if a write silently didn't take, saying "done" is worse than saying nothing.

**Don't sleep a fixed number of seconds waiting for the reload.** `summarize_board.js` reports
`document.readyState` on its first line; if that says `loading`, or the value still reads the old one, run it
again. A sleep guessed too short reports "the write didn't take" when it did — a false negative on the exact
claim this skill exists to make honestly.

## The unmapped operations

Two operations are still unmapped, because verifying them required writing to a live club board. When one
comes up, say so and drive the user through the UI rather than guessing at a control you've never seen.

Declining is now mapped, with one caveat: nobody has yet declined *while holding a role*, so whether that
releases the role is unknown. It is more likely than it was — declining does withdraw sign-up rights for
that meeting — but likely is not observed. If that's the situation, say so and check the board afterwards.

## Things that will bite you

`options` lists only the choices this board actually renders — read it rather than assuming. Clubs that
don't meet online have no `online` option and no online icon on their open slots, and telling such a member
"I'll sign you up online" promises something the board cannot do.

Use the script rather than reading the page by eye. The board is a dense grid of near-identical 16px icons
where a one-row misread means signing up for the wrong role, and the script already handles the edge cases
that bite hand-rolled parsers (see `references/gotchas.md`).

Sessions expire between conversations. Check every time rather than assuming; a stale session renders a
public marketing page that parses as "no meetings", which looks like real data and isn't.

**Match meetings by `meetingId`, never by column position.** The radio inputs are named `available[0]`,
`available[1]` — a bare column index with no meeting id in it. Columns shift as meetings are scheduled and
pass, so position is not identity.

**There may be fewer meetings than the user asked for.** "The next three meetings" often returns one,
because the VP Education hasn't scheduled further out. That's normal, not an error. Say plainly how many
exist rather than quietly returning a short list — and note that `dateRange` says `No more dates available`
when the board is exhausted. To distinguish "not scheduled yet" from "hidden behind a signup horizon", check
`/mycalendar.php?jump=1`; if neighbouring clubs have meetings that month and this club doesn't, nobody has
scheduled them.

**`none` and `undecided` are different states.** `none` means the member never responded at all;
`undecided` means they deliberately chose `?`. Only the first is worth nudging about. The UI shows both as
"no commitment", so it's easy to collapse them and lose the distinction the user cares about.

**Claiming a role also sets your attendance.** Each role icon carries an in-person/online flag, so
signing up as Timer in person marks you attending in person. Attendance and roles look independent and
aren't — mention this when a user claims a role after saying they might not make it.

**Role slot ids are per-meeting.** `roleItemId` identifies an agenda line, not a role type — "Toastmaster"
has a different id at every meeting. Never carry one across meetings; always re-read the board.

**Popup windows are unreachable, and clicking one open strands it.** `N` calls `window.open`, and the window
lands outside the agent's tab group: no tab listing shows it, no tool can drive it. This is independent of
how the click was delivered — synthetic and coordinate clicks both open it. Nothing is blocked or pending,
so waiting and re-clicking only multiplies the problem, and each stray window is a live form whose OK button
re-submits whenever the user finally closes it. Intercept `window.open`, keep the URL, and load the form in
an iframe you can drive. `scripts/decline.js` does this; never click `N` bare.

**Declining is not symmetric with accepting.** `P`/`O`/`?` submit the form in place; `N` opens the popup
above and leaves the board untouched until that form is confirmed. Declining also withdraws you from role
sign-up for that meeting — the volunteer icons disappear from that whole column — so it is not a free round
trip if the user might change their mind.

**Tool output is truncated at about 950 characters.** Measured 2026-09-11. This is small enough that a naive
full-board dump overflows on a four-meeting club, and a truncated board is worse than a failed read: it
looks like a club with fewer meetings or fewer filled roles than it has, and reports built on it are
confidently wrong. `read_board.js` and `summarize_board.js` both scope their output and refuse to return
something oversized. If you extend them, keep the budget check; if you write an ad-hoc query, keep it small
and never assume a long result arrived whole.

**Single-slot roles have no slot number.** Multi-slot cells read `1 Alice Example 2 Bob Example`, but
Toastmaster, Grammarian, Timer and Quizmaster render the occupant's bare name. A parser that only matches
numbered occupants reports all four as unfilled while members hold them — the worst direction to be wrong
in, since it invites signing someone up for a taken role. Fall back to the raw cell text, but guard that
fallback against the `1 2` two-empty-slots case or you invent a member named "1 2".

**An empty board is not an error.** When the club has nothing scheduled, `/signup.php` renders "There is no
data to report in this category for your club" with no table at all. The scripts return `empty: true` for
this. It means the VP Education hasn't scheduled, not that anything is broken — say so plainly rather than
reporting a parse failure.

**Keep query strings — and all page JavaScript — out of tool output.** The Chrome extension blocks tool
results that look like cookie or query-string data, so a script that dumps raw hrefs returns `[BLOCKED]` and
costs a round trip. The guard is broader than "don't print URLs": on 2026-09-11 it also rejected an element's
`onclick` attribute and a function's `toString()`, *including* after the query strings had been stripped by
regex. Treat it as a rule about the whole class — never return page source, attribute text or handler bodies.
Pull out the fields you need instead. Numeric ids pass fine, which is enough to learn a handler's arguments:
matching `/\d+/g` against the `N` radio's `onclick` yields `attendMeeting`'s three ids without tripping it.
