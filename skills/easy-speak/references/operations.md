# easy-Speak — operations catalogue (browser UI)

How to perform each supported operation by driving the web UI. This file is deliberately written in terms of
**what a human does in the browser**, not in terms of any particular automation tool — so it stays valid when
this skill is ported to another agent. `../SKILL.md` maps these steps onto Claude's Chrome tools.

**Status legend** — `verified` observed working in a live session · `partial` structure seen, outcome not
observed · `unverified` inferred, never exercised.

## Executing these algorithms with the bundled scripts

Every "read the board" step below is one call to `../scripts/read_board.js`, and every "click X" step is one
call to `../scripts/click_mark.js` with the `mark` that `read_board.js` returned for that control. The prose
algorithms describe the underlying UI so the logic survives a port; the scripts are how you actually run them
here.

Marks are destroyed by every page load, so the read→click pairing is not optional bookkeeping — a mark from
before a write no longer refers to anything.

---

## Conventions used by every algorithm

**The signup board.** `/signup.php` renders one table: role rows × future-meeting columns.

```
              |  24 Aug 26   |  31 Aug 26   |   <- header row: each cell links to view_meeting.php?t=<meetingId>
Confirm Att.  |  ( )P  ( )O  ( )N  ( )?  | ...      <- radios, name="available[<colIndex>]"
Speaker       |  1 Alice E.  | ...          <- occupant names, or icons for open slots
Evaluator     |  1 Carol E. | ...
...
```

**Column resolution — do this every time.** Never address a column by position. Read the header cell's
`view_meeting.php?t=` link to get the meetingId, and match on that. Column order and count change as meetings
are scheduled and pass.

**Slot icons in an open cell:**

| Icon | Meaning |
|---|---|
| 🏠 `icon_yesP_up.png` | Claim this slot, attending **in person** |
| 💻 `icon_yesV_up.png` | Claim this slot, attending **online** |

**⚠️ Clicking a slot icon commits immediately.** It is a side-effecting GET with no confirmation dialog. There is
no "are you sure". Treat every icon click as irreversible-until-manually-undone, and confirm with the user first.

---

## A. Session

### A1. Log in — `verified` (human-performed)

The agent must never type the password. Steps:

1. Navigate to `https://<host>/portal.php`.
2. Wait ~4s — Cloudflare serves a `Just a moment...` interstitial on first hit. Title changes when it clears.
3. Hand the tab to the user; ask them to log in via the sidebar form (top-left).
4. Wait for the user to confirm.

Host is one of `easy-speak.org`, `toastmasterclub.org` (UK/IE), `tmclub.eu` (mainland EU).

### A2. Verify the session is live — `verified`

1. Read the page header. Logged in ⇒ `Welcome back <Full Name> [<username>]` top-right.
2. Logged out ⇒ a `Log in` item in the top nav and a login form in the sidebar.
3. If logged out mid-task, stop and re-run A1. Do not retry the action blindly.

### A3. Switch club — `unverified`

Relevant only if the member belongs to more than one club. `Go to ... → Select a Club`. Not needed for the
single-club case; capture the flow the first time it matters.

---

## B. Read operations

### B1. List upcoming meetings open for signup — `verified`

1. Navigate to `/signup.php`.
2. Read the header row. Each cell after the first is one upcoming meeting: label (e.g. `24 Aug 26`) plus a link
   carrying its meetingId.
3. Note the `Date Range:` indicator to the right of the page title. `No more dates available` means the club has
   scheduled nothing further.

**Degrade gracefully.** A request for "the next 3 meetings" must return however many exist. At time of writing
exactly one did. Do not treat a short list as an error, and say plainly how many were found.

For meetings beyond the signup horizon (including past ones), use `/meeting_list.php`, which lists every meeting
with its date and id and offers a month-range filter.

### B2. Read my attendance status — `verified`

1. Navigate to `/signup.php`.
2. Find the `Confirm Attendance` row.
3. For each meeting column, inspect the four radios (`P`, `O`, `N`, `?`):
   - `P` selected → attending in person
   - `O` selected → attending online
   - `N` selected → not attending
   - `?` selected → explicitly undecided
   - **none selected → has not responded at all.** This is distinct from `?` and is the state worth nagging about.
4. Resolve each column to its meetingId (see conventions) before reporting.

### B3. Read the role board — `verified`

1. Navigate to `/signup.php`.
2. For each role row (`Speaker`, `Evaluator`, `Table Topics Master`, `Toastmaster`, `Grammarian`, `Timer`,
   `Quizmaster`, …), read each meeting cell:
   - Names present → slot taken, numbered per slot (`1 Alice Example`, `2 Bob Example`).
   - Slot icons present → slot open.
   - A cell may mix both (e.g. Evaluator `1 Carol Example`, slot 2 open).
3. To find **my** roles, match the logged-in user's full name against occupant names.

**Do not identify role rows by the presence of a knowledgebase (`kb.php`) link** — the `Quizmaster` row has no
such link and a parser keyed on it silently dropped the row. Key on row structure instead.

### B4. When am I next speaking — `verified` (within the signup horizon)

1. Run B3.
2. Scan the `Speaker` row for the user's name; the column it sits in gives the meeting and date.
3. Report the meeting date, and cross-check the `Evaluator` row too — members often want both.

Beyond the signup horizon, use `Club Charts → Roles by Member` (`/memberchart.php?chart=…`) or
`Club Charts → Role History`. `unverified` — exact chart params not yet captured.

### B5. Open a meeting's full agenda — `verified`

Navigate to `/view_meeting.php?t=<meetingId>`, or click the meeting date in the signup header. Shows the ordered
agenda with timings, themes and every assignment — more detail than the signup board, and the right source when
the user asks "what's happening at the meeting" rather than "what's open".

### B6. My participation history — `partial`

`My Participation → View my Speech Progress` (`/profile_cc.php`) for the speech/pathways track.
`Club Charts → Role History` / `Participation Chart` for role counts. Layouts not yet captured.

---

## C. Attendance writes

> Every algorithm in this section changes what the club sees. **Confirm the specific meeting and the specific
> value with the user before clicking**, and report the verified end state afterwards.

### C1. Confirm attendance — in person — `partial`

1. Navigate to `/signup.php`.
2. Resolve the target meeting to its column.
3. In the `Confirm Attendance` row of that column, click the **`P`** radio.
4. The page submits itself and reloads (the radio's handler sets the form action and submits).
5. **Verify:** re-read the row; `P` must now be selected for that column.

### C2. Confirm attendance — online — `partial`

As C1, clicking **`O`** instead. Verify `O` is selected.

### C3. Mark undecided — `partial`

As C1, clicking **`?`** instead. Verify `?` is selected.

Use this when the user genuinely doesn't know yet — it is visibly different from never having responded, and
tells the VPE you saw the request.

### C4. Decline attendance — `unverified — contract not captured`

**This path is not symmetric with the others.** Clicking `N` does not submit the form; it opens a **popup window**
(`/tm_decline.php`, 400×300) which presumably asks for a reason and a confirmation.

Provisional algorithm:

1. Navigate to `/signup.php`.
2. Resolve the target meeting to its column.
3. Click the **`N`** radio.
4. A popup window opens. Switch to it, read its form, complete whatever it asks (likely a reason), submit.
5. Close the popup, return to `/signup.php`, reload.
6. **Verify:** `N` is selected for that column.

**Open questions to resolve on first real use:** is the reason mandatory? Does it notify the VPE? Does it
also release any roles the member holds at that meeting? Until answered, always walk the user through this one
rather than automating it.

### C5. Set attendance across the next N meetings — `partial`

Composite, not a distinct UI feature:

1. Run B1 to enumerate available meetings; take the first N.
2. If fewer than N exist, say so explicitly and proceed with what there is.
3. Present the user with the full list and the value to be set, and get one confirmation covering all of it.
4. Apply C1/C2/C3/C4 per meeting, **re-reading the board between writes** — the page reloads after each
   submission and column indices may shift.
5. Report the final state of every affected meeting.

---

## D. Role writes

### D1. Claim an open role — `partial`

1. Navigate to `/signup.php`.
2. Resolve the target meeting to its column, and locate the role row.
3. Confirm the slot is open (icons present, no occupant name in that slot).
4. **Confirm with the user** — role name, meeting date, and in-person vs online. There is no undo prompt.
5. Click 🏠 (`icon_yesP_up.png`) for in person, or 💻 (`icon_yesV_up.png`) for online.
6. Page reloads.
7. **Verify:** the user's name now occupies that slot.

**Side effect worth stating out loud:** claiming a role also declares *how* you attend (the `att` value). Claiming
in person will set your attendance accordingly — so C-series and D-series operations are coupled, not independent.

If multiple slots are open in a role, the icons belong to a specific slot number. Pick deliberately; don't assume
the first pair of icons is slot 1.

### D2. Release a role I hold — `unverified — contract not captured`

Not observable in the captured session (the account held no roles). Expect a "remove me" / ✗ icon on cells the
user occupies. To capture: claim a role via D1, then screenshot that cell and record the control it exposes.

Until captured, do this manually and treat it as user-driven.

### D3. Request a speech slot — `unverified`

`/signup.php` carries a `request speech` button (top-left of the board), and the sidebar a
`Request a Speech...` link. Both are JavaScript (`href="void(0)"`), so they open a dialog rather than navigating.
Contract not captured.

---

## Operation priority

| Priority | Operations |
|---|---|
| **MVP** | A1, A2, B1, B2, B3, B4, C1, C2, C3, D1 |
| **Next** | C4 (decline), C5 (bulk), D2 (release) |
| **Later** | A3, B5, B6, D3 |

## Cross-cutting rules for the skill

1. **Read before every write.** Never act on a cached board; the page reloads after each write and columns move.
2. **Resolve meetings by id, never by column position.**
3. **Confirm every write with the user first**, naming the meeting date and the exact value. Slot icons commit on
   click with no confirmation.
4. **Verify after every write** by re-reading the board, and report the observed state — not the intended one.
5. **Never type the password.** Session setup is always handed to the user.
6. **Report partial results honestly.** Fewer meetings than asked for, or a write that didn't take, must be said
   plainly rather than smoothed over.
