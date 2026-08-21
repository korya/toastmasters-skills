# easy-Speak — discovery notes

Captured 2026-08-17 via live browser session. Software version: **Toastmaster Automation v2.37** (phpBB-derived).

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

## Identity (this account)

- user: `example_user` — Sam Example — **userId `100001`**
- club: Example Toastmasters Club (`EX Club`), club #1234567, Area 1 / Division A / District 99
- meets Mondays 12:00pm, hybrid (in-person + online)

## Page map

| Purpose | Path | Params (excl. `sid`) |
|---|---|---|
| Logged-in home | `/portal.php` | `page` |
| **Sign Up for Meetings** | `/signup.php` | — |
| Meeting agenda | `/view_meeting.php` | `t` = meetingId |
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

Asymmetric: opens a **popup** instead of submitting.

    /tm_decline.php?action=confirmattendance&u=<userId>&t=<meetingId>&z=2&mode=popup

Presumably collects a reason / confirmation. **Contract not yet captured — TODO.**

### Claim a role

Plain GET on an icon link:

    GET /signup.php?action=volunteer&t=<meetingId>&r=<agendaItemId>&n=<slot>&att=<1|6>

- `t` — meetingId
- `r` — **agenda item id, per-meeting, not a global role type.** e.g. for meeting 700001:
  Toastmaster `50001`, ? `50002`, Table Topics Master `50003`, Evaluator `50004`.
  → Must be re-scraped per meeting; never cache across meetings.
- `n` — slot index within the role (`0` for single-slot roles; Evaluator's 2nd slot was `n=2`)
- `att` — `1` in person / `6` online. Claiming a role also declares how you attend.

Two icons per open slot: `icon_yesP_up.png` (in person) and `icon_yesV_up.png` (online).

**Releasing a role — contract not yet captured. TODO.**

## Read contract

`/signup.php` alone answers all three MVP questions. It is a matrix of **role rows × future-meeting columns**:

- Header row cell N+1 → meeting label + `view_meeting.php?t=<id>` gives the meetingId
- `Confirm Attendance` row → 4 radios named `available[<colIndex>]`, values 1/6/2/5; `checked` reveals current state
  (none checked ⇒ member has not responded yet)
- Role rows → occupant names per slot; open slots carry `action=volunteer` links

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

## Still to capture

- [ ] `tm_decline.php` popup form contract (declining)
- [ ] Releasing / un-claiming a role
- [ ] What a successful write returns (redirect? flash message?) — needed for verification after a write
- [ ] Behaviour when >1 future meeting exists (multi-column layout, `available[1]`, `available[2]`…)
- [ ] "When am I speaking" beyond the signup horizon — likely `memberchart.php?chart=…` (Roles by Member)
