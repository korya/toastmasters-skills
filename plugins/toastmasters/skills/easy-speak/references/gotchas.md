# Write mechanics and traps

Loaded on demand from SKILL.md. Read this before the first write of a session: the
mechanics come first, then the traps that bite hand-rolled approaches.

## Write mechanics

**Click by mark, not by coordinates.** `read_board.js` tags every actionable element with `data-es-mark`;
`scripts/click_mark.js` clicks one by that tag, dispatching a real click so the page's own handlers run
exactly as they would for a human. Coordinate clicks on a table of identical icons are how you sign someone
up as Grammarian when they asked for Timer.

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
releases the role is unknown. If that's the situation, say so and check the board afterwards.

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

**Declining is not symmetric with accepting.** `P`/`O`/`?` submit the form; `N` opens a popup and leaves the
board untouched until that popup is confirmed. Use the popup's own button rather than submitting around it,
or you strand a window on the user's screen whose OK button would re-submit.

**An empty board is not an error.** When the club has nothing scheduled, `/signup.php` renders "There is no
data to report in this category for your club" with no table at all. The scripts return `empty: true` for
this. It means the VP Education hasn't scheduled, not that anything is broken — say so plainly rather than
reporting a parse failure.

**Keep query strings out of tool output.** The Chrome extension blocks tool results that look like
cookie or query-string data, so a script that dumps raw hrefs returns `[BLOCKED]` and costs a round trip.
`read_board.js` already extracts the parts it needs into JSON fields; follow that pattern if you extend it.
