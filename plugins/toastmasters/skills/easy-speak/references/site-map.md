# easy-Speak — site map and contracts

Reference for the pages, codes and URL contracts behind the operations in `operations.md`.
Captured 2026-08-17 from a live browser session against a real club.

> All names, ids and club details in this file are **invented placeholders**, not real data. They exist to
> show the shape of what you'll read off a page. Every id is club- and meeting-specific anyway, so these
> values would be useless even if they were real — always read them from the live page.

Software version: **Toastmaster Automation v2.37** (phpBB-derived).

## Hosts

Same software, three deployments — the skill must be host-parameterised:

| Host | Audience |
|---|---|
| `easy-speak.org` | Everyone else (ours) |
| `toastmasterclub.org` | UK / Ireland clubs |
| `tmclub.eu` | Mainland Europe clubs |

## Session / auth

- **Cloudflare sits in front.** First hit serves a `Just a moment...` interstitial. Inline handlers are wrapped in
  `if (!window.__cfRLUnblockHandlers) return false;` — Rocket Loader is active.
  → A raw HTTP client will likely be challenged. Plan on borrowing cookies from a real browser session.
- phpBB-style `sid=` token appended to most in-app URLs. Session also lives in cookies.
- Login is a plain form in the left sidebar of `portal.php`. Must be done by the human (agent may not type passwords).

## Example account shape

Placeholder values, shown so the field names below have something concrete to point at:

- user: `example_user` — Sam Example — **userId `100001`**
- club: Example Toastmasters Club (`EX Club`), club #1234567, Area 1 / Division A / District 99
- meets weekly at midday, hybrid (in-person + online)

## Page map

| Purpose | Path | Params (excl. `sid`) |
|---|---|---|
| Logged-in home | `/portal.php` | `page` |
| **Sign Up for Meetings** | `/signup.php` | — |
| Meeting agenda **+ whole-club attendance** | `/view_meeting.php` | `t` = meetingId |
| Mobile agenda | `/viewagenda_mobile.php` | `c`, `show` |
| Meeting list (past+next) | `/meeting_list.php` | month range filter |
| Calendar | `/mycalendar.php` | `jump` |
| Decline confirmation popup | `/tm_decline.php` | `action`, `u`, `t`, `z`, `mode` |
| Role knowledgebase article | `/kb.php` | `mode`, `k` |
| My speech progress | `/profile_cc.php` | — |
| Roles by Member / Role History | `/memberchart.php` | `chart` |

## Attendance codes

Used identically by the attendance radios and the role-signup `att` param:

| Code | UI | Meaning |
|---|---|---|
| `1` | P | Attending **in person** |
| `6` | O | Attending **online** |
| `2` | N | **Not** attending |
| `5` | ? | Unknown / undecided |

## Write contract

### Set attendance — accepting (codes 1, 6, 5)

Radios are **not** a plain form post. `onclick` calls:

    attendMeeting(userId, meetingId, code)

which sets the form action and submits:

    POST /signup.php?action=attend&z=<code>&t=<meetingId>&u=<userId>

### Set attendance — declining (code 2)

Asymmetric: opens a **popup** instead of submitting the board's form. The board is unchanged until the popup
is submitted.

    /tm_decline.php?action=confirmattendance&u=<userId>&t=<meetingId>&z=2&mode=popup

Window is 400x300. Contents: one optional `textarea` named `comment[<memberMeetingId>]`, plus confirm and
cancel submits (`input[name=confirm]` / `input[name=cancel]`), POSTing back to the same page. A blank reason
is accepted.

**The window is unreachable from browser automation.** It opens outside the agent's tab group, so it appears
in no tab listing and no tool can drive it — regardless of whether the click was synthetic or a real
coordinate click, both of which reach the handler and open it. Intercept `window.open` to capture the URL and
load the form in an iframe instead. `scripts/decline.js` implements this; see operations C4.

`memberMeetingId` is a **third id type**, distinct from `t` (meeting) and `r` (role slot). It is the first
argument of the `N` radio's `onclick`:

    attendMeeting(memberMeetingId, meetingId, statusCode)

so `onclick.match(/\d+/g)` yields it without opening anything. (Return only those numbers — the extension
blocks tool output containing the raw attribute text.)

Confirmed working 2026-08-21 (`none` -> `notAttending`, blank reason) and 2026-09-11 (with a reason), both
verified on a fresh board load.

**Declining withdraws role sign-up for that meeting** (2026-09-11): every `action=volunteer` link vanished
from that member's column afterwards.

Two behaviours remain unobserved: whether it notifies the VP Education, and whether it releases roles the
member already holds at that meeting (both members who have exercised it held none).

### Claim a role

Plain GET on an icon link:

    GET /signup.php?action=volunteer&t=<meetingId>&r=<agendaItemId>&n=<slot>&att=<1|6>

- `t` — meetingId
- `r` — **agenda item id, per-meeting, not a global role type.** e.g. for meeting 700001:
  Toastmaster `50001`, ? `50002`, Table Topics Master `50003`, Evaluator `50004`.
  → Must be re-scraped per meeting; never cache across meetings.
- `n` — slot index within the role (`0` for single-slot roles; Evaluator's 2nd slot was `n=2`)
- `att` — `1` in person / `6` online. Claiming a role also declares how you attend.

Up to two icons per open slot: `icon_yesP_up.png` (in person) and `icon_yesV_up.png` (online).

**The online pair is conditional.** A club that doesn't meet online renders only the in-person icon, and its
attendance row offers three radios (`P`, `N`, `?`) rather than four — code `6` simply isn't offered.
Observed on meeting 700002 (2026-08-27). Read the controls that exist; don't assume the full set.

**Releasing a role — contract not yet captured. TODO.**

## Read contract

`/signup.php` alone answers all three MVP questions. It is a matrix of **role rows × future-meeting columns**:

- Header row cell N+1 → meeting label + `view_meeting.php?t=<id>` gives the meetingId
- `Confirm Attendance` row → 4 radios named `available[<colIndex>]`, values 1/6/2/5; `checked` reveals current state
  (none checked ⇒ member has not responded yet)
- Role rows → occupant names per slot; open slots carry `action=volunteer` links

**Multi-slot roles number their occupants; single-slot roles do not.** Speaker and Evaluator cells read
`1 Alice Example 2 Bob Example`; Toastmaster, Grammarian, Timer and Quizmaster render a bare name. Parse both
shapes, and keep the bare-name fallback from firing on `1 2`, which is two *empty* slots.

It answers those questions **for the logged-in member only**. The whole club's attendance is on
`/view_meeting.php`, in the table containing `Total Attendance` — locate it by that marker text, never by
index. Rows are name + `Attending` / `Not Attending` / `Unknown`, except the logged-in member's own row,
which renders the live `P`/`O`/`N`/`?` radios in place of a status word.

Verified parse (2026-08-17):

    MEETINGS: [col 0] 24 Aug 26 ▸ id 700001
    MY ATTENDANCE ▸ NOT SET
    Speaker             ▸ 1 Alice Example, 2 Bob Example   ▸ 0 open
    Evaluator           ▸ 1 Carol Example, 2 (open)     ▸ 2 links
    Table Topics Master ▸ (none)                        ▸ 2 links
    Toastmaster         ▸ (none)                        ▸ 2 links
    Grammarian          ▸ (none)                        ▸ 2 links
    Timer               ▸ (none)                        ▸ 2 links
    Quizmaster          ▸ (none)                        ▸ (missed by parser — see gotchas)

## Empty board

When the club has nothing scheduled, `/signup.php` returns a page with **no board table at all**, showing:

    There is no data to report in this category for your club

This is a distinct shape from a board with zero meeting columns, and it is not an error — it means the VP
Education hasn't scheduled anything. Observed 2026-09-01, when the club had nothing on the books for
September or October despite neighbouring clubs having their dates loaded.

Detect it by that marker string rather than by the absence of the table, so a genuine parse failure stays
distinguishable from an empty calendar.

## Attendance / role precedence

Claiming a role carries an `att` value and so declares how you attend. Observed 2026-08-27: claiming a role
when attendance is **already set** does not overwrite it. The coupling fills a blank; it does not clobber a
deliberate choice.

## Gotchas

1. **`available[<colIndex>]` is index-based, not id-based.** The radio name carries no meetingId — only the
   `attendMeeting()` argument does. Parse the meetingId from the column header, never trust column order.
2. **Only future meetings appear on `/signup.php`.** At capture time exactly one existed (24 Aug); the page said
   `Date Range: No more dates available`. September was not yet scheduled by the VPE.
   → "next 3 meetings" must degrade gracefully to "as many as exist".
3. **Role-detection must not key on the `kb.php` link.** The Quizmaster row lacks one and was dropped by a parser
   that filtered on it. Key on row position / structure instead.
4. **Declining is a different code path** (popup) than accepting. Don't assume symmetry.
5. `r` (agenda item id) is per-meeting — re-scrape every time.
6. Cloudflare Rocket Loader rewrites inline handlers; anything reading `onclick` must tolerate the
   `__cfRLUnblockHandlers` prefix.

## Calendar and roster details

### `mycalendar.php?jump=<n>`

`jump` is a **relative month offset**, not a date — `1` is next month, `2` the month after. Looking three
months ahead is a loop over `jump=0..3`, with no date arithmetic and no year-rollover handling.

The month grid lists every club's meetings, not just yours. That makes it the way to tell **"my club hasn't
scheduled it yet"** apart from **"easy-Speak is hiding it behind a signup horizon"**: if neighbouring clubs
have entries that month and yours doesn't, nobody has scheduled yours.

### `memberlist.php` — accounts, not members

The User List conflates accounts with active membership, in two ways worth guarding against:

1. **Placeholder accounts.** Clubs create fake members such as `Guest Speaker` to slot external speakers onto
   agendas. These are rows in the list but not people.
2. **Lapsed members linger.** The `Last online` column is the only signal — accounts dormant for months still
   appear as ordinary members.

So a row count is not a headcount. Report it as "N accounts" and use `Last online` if the user wants a sense
of who is actually active. The Club Directory (`clubdata.php`) is the better source for real membership.

Officers carry their office in the name cell (`Dana Example Vice President - Education`), which is how you find
who to escalate to — the VP Education schedules meetings and assigns roles.

Columns 3 and 4 hold phone numbers and email addresses. Leave them alone unless the user has explicitly asked
for someone's contact details; a roster question doesn't need the club's personal data in a transcript.

## Still to capture

- [ ] Whether declining notifies the VPE, and whether it releases roles the member holds

- [ ] Releasing / un-claiming a role (read `myControls` from an occupied cell — no click needed)
- [ ] What a successful write returns (redirect? flash message?) — needed for verification after a write
- [ ] Behaviour when >1 future meeting exists (multi-column layout, `available[1]`, `available[2]`…)
- [ ] "When am I speaking" beyond the signup horizon — likely `memberchart.php?chart=…` (Roles by Member)
