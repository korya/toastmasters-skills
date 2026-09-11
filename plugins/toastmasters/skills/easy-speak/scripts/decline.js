/* decline.js — decline attendance for one meeting, end to end, without opening a window.
 *
 * Substitute two placeholders before running:
 *   __MARK__    the `notAttending` mark from read_board.js `options` (e.g. "es-2")
 *   __REASON__  a JSON string literal — `""` for no reason, `"Away that week"` for one.
 *               JSON-encode it rather than pasting raw text; a stray quote or newline in a
 *               member's reason would otherwise break the script it is embedded in.
 *
 * Why this script exists, and why you must never click the `N` control bare:
 *
 * `N` is not like `P`/`O`/`?`. Those submit the attendance form in place. `N` calls
 * `attendMeeting(...)`, which fires `window.open` on `/tm_decline.php` and leaves the board
 * untouched until that popup is submitted. The popup opens as a real browser window —
 * whether the click was synthetic or a genuine coordinate click makes no difference, both
 * reach the handler and both open it.
 *
 * The problem is that the window opens *outside the agent's tab group*, so no tab-listing
 * tool can see it and no automation tool can drive it. It is not blocked, not slow, not
 * missing. It is simply unreachable, and no amount of waiting or re-clicking will change
 * that. An agent that clicks `N` and then looks for the popup will conclude the click
 * failed, click again, and strand a second window.
 *
 * That is the real cost. Each stray window is a live decline form whose OK button will
 * re-submit if the user ever clicks it, sitting on their screen with no way for the agent
 * to close it. The skill warns against stranding one; clicking `N` bare strands one every
 * single time.
 *
 * So: intercept `window.open`, keep the URL, and load the same form in an iframe on the
 * board page where it can be driven normally. Same URL, same form, same confirm button,
 * same POST. The window never exists, so it cannot be stranded.
 *
 * The board page is NOT reloaded by this script — the popup POSTs to itself. Navigate to
 * /signup.php afterwards and verify the status reads `notAttending` on a fresh load.
 *
 * Returns JSON: {ok, reason, submitted} or {ok:false, error}.
 */
await (async () => {
  const MARK = '__MARK__';
  const REASON = __REASON__;
  const FRAME_ID = '__esDeclineFrame';

  const el = document.querySelector(`[data-es-mark="${MARK}"]`);
  if (!el) {
    return JSON.stringify({
      ok: false,
      error: 'mark not found — the page reloaded and cleared the tags. Re-run read_board.js to re-tag.',
    });
  }

  document.getElementById(FRAME_ID)?.remove();

  // Capture the popup URL instead of letting a window open.
  const realOpen = window.open;
  let url = null;
  try {
    window.open = function (u) {
      url = u;
      return { focus() {}, close() {}, closed: false, document: null };
    };
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  } finally {
    window.open = realOpen;
  }

  if (!url) {
    return JSON.stringify({
      ok: false,
      error: 'clicking the mark did not call window.open — is this the N control? Check `options.notAttending` from read_board.js.',
    });
  }

  // Load the same form somewhere we can actually drive it.
  const frame = document.createElement('iframe');
  frame.id = FRAME_ID;
  frame.style.cssText = 'position:fixed;bottom:8px;right:8px;width:420px;height:320px;z-index:99999;border:2px solid #900;background:#fff';
  const loaded = new Promise((res) => {
    frame.addEventListener('load', res, { once: true });
    setTimeout(res, 15000);
  });
  frame.src = url;
  document.body.appendChild(frame);
  await loaded;

  const doc = frame.contentDocument;
  if (!doc || !doc.querySelector('input[name="confirm"]')) {
    frame.remove();
    return JSON.stringify({ ok: false, error: 'decline form did not load in the iframe' });
  }

  // The reason is optional and a blank one submits cleanly. Only ever pass a reason the
  // user actually gave you; do not invent an excuse on a member's behalf.
  const textarea = doc.querySelector('textarea');
  if (textarea && REASON) {
    textarea.focus();
    textarea.value = REASON;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Use the form's own confirm button so the POST carries exactly what a human's would.
  const submitted = new Promise((res) => {
    frame.addEventListener('load', res, { once: true });
    setTimeout(res, 15000);
  });
  doc.querySelector('input[name="confirm"]').click();
  await submitted;
  frame.remove();

  return JSON.stringify({
    ok: true,
    reason: REASON || null,
    submitted: true,
    note: 'board not reloaded — navigate to /signup.php and verify status reads notAttending',
  });
})()
