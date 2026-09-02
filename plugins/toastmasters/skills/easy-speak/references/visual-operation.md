# Operating without JavaScript — the screenshot-and-click path

Use this when you can see the page and click it, but cannot run JavaScript in it. That is the normal
situation in ChatGPT's cloud browser, and it means `scripts/read_board.js` and `scripts/click_mark.js` are
unavailable — everything has to be done by eye.

The algorithms in `operations.md` still hold; this file is about doing them safely without the parser.

> Names and ids in examples here are invented placeholders.

## Why this needs its own care

The signup board is a dense grid of near-identical 16px icons. Two of them sit side by side in every open
slot and differ only by a small house or monitor picture. A click one row off signs the member up for the
wrong role, instantly, with no confirmation dialog and the whole club watching.

The scripts avoided this by clicking a tagged element. Without them you need a different guarantee, and
**screenshots alone are not it** — at normal zoom these icons are too small to tell apart reliably.

## The guarantee: read the tooltip before you click

Every signup icon carries a `title` that spells out exactly what it does:

    I ACCEPT the 'Table Topics Master' role and will attend in person
    I ACCEPT the 'Table Topics Master' role and will attend online

**Hover the icon, read the tooltip, and only click when it names the role you intend and the mode you
intend.** The tooltip is unambiguous where the picture is not. If hovering produces no tooltip, or the text
doesn't match what you meant to do, stop and ask rather than clicking hopefully.

This single habit prevents nearly every way this can go wrong.

## V1. Read the board

1. Go to `/signup.php` and wait about 5 seconds — Cloudflare shows a `Just a moment...` page first.
2. Take a screenshot.
3. If the page reads **"There is no data to report in this category for your club"**, there are no meetings
   scheduled. That is a normal state, not a failure. Say so and stop.
4. Read the header row for the meeting dates — these are the columns.
5. Read the `Confirm Attendance` row: which of `P` `O` `N` `?` is selected for each column.
   - Nothing selected means the member has not responded at all, which is different from `?`.
   - **Some clubs show only three options.** A club that doesn't meet online has no `O`. Read what is there.
6. Read each role row: the names in each cell, and which slots show icons instead of a name.

**Zoom in rather than reading the whole grid at once.** Capture the attendance row, or the single role row
you care about, rather than trying to resolve a full-page screenshot. The text is small and misreading a row
label is the same class of error as misclicking one.

## V2. Set attendance

1. Do V1 first, and tell the member in plain language what you found and what you're about to change.
2. Get their confirmation, naming the meeting date and the choice.
3. Zoom into the `Confirm Attendance` cell for the target meeting. The four radio buttons are labelled `P`,
   `O`, `N`, `?` in small type — confirm which is which at zoom before clicking, not from the wide shot.
4. Click the radio.
5. The page submits and reloads. Screenshot again.
6. **Verify:** the intended option is now selected. Report what you see, not what you clicked.

`N` behaves differently — see V4.

## V3. Claim a role

1. Do V1. Confirm the slot is genuinely open (icons, no name).
2. Tell the member which role, which meeting, and in person or online. Wait for a clear yes.
3. **Hover the icon and read its tooltip.** Proceed only if it names the role and mode you both agreed.
4. Click.
5. Screenshot after the reload.
6. **Verify:** their name now appears in that slot.

Remember that claiming a role also sets how they attend, so this may change their attendance line too. Say
that out loud beforehand — members don't expect the two to be linked.

## V4. Decline a meeting

Clicking `N` does not submit the form. It opens a small popup window (about 400x300).

1. Click `N` in the attendance row.
2. Switch to the popup. It holds one optional reason box and confirm/cancel buttons.
3. Leave the reason blank unless the member gave you one. Don't invent a reason on their behalf.
4. **Click the popup's own confirm button** — that closes it properly. Submitting around it leaves a stray
   window on their screen whose OK button would file the decline a second time.
5. Return to the board, reload, screenshot.
6. **Verify:** `N` is now selected.

## Talking to the member

Most people using this are club members, not engineers, and many are not comfortable with computers. Adjust
accordingly:

- Say "you're down as coming to the meeting on the 24th", not `status: inPerson`.
- Never show JSON, selectors, or meeting ids unless asked. Ids mean nothing to them.
- Ask one plain question at a time. "Do you want me to mark you as coming on Monday the 24th?" is answerable;
  a table of four options with codes is not.
- When something is unavailable — no meetings scheduled, a role already taken — say what that means for them
  in one sentence, rather than describing the page.
- If you cannot do something, say so plainly and offer to talk them through doing it themselves. Do not
  guess at a control you cannot identify.

## When you have JavaScript after all

If a JavaScript tool is available, prefer the scripted path in `../SKILL.md`: it reads the whole board in one
call and clicks by a tagged element rather than by sight. It is faster and materially safer. This file exists
for when that isn't an option.
