/* click_mark.js — click an element that read_board.js tagged, then report what changed.
 *
 * Substitute __MARK__ with the `mark` value from read_board.js output (e.g. "es-7").
 *
 * Why click by mark rather than by screen coordinates: the board is a dense table of
 * near-identical 16px icons, and a coordinate click that lands one row off signs you up
 * for the wrong role with no confirmation dialog to catch it. The mark is unambiguous.
 *
 * This dispatches a real click, so the page's own handlers run exactly as they would for
 * a human — attendance radios submit their form, role icons follow their link. The page
 * will navigate; re-run read_board.js afterwards to verify the result.
 */
(() => {
  const el = document.querySelector('[data-es-mark="__MARK__"]');
  if (!el) {
    return JSON.stringify({
      ok: false,
      error: 'mark not found — the page reloaded and cleared the tags. Re-run read_board.js to re-tag, then click again.',
    });
  }
  const describe = {
    ok: true,
    tag: el.tagName.toLowerCase(),
    title: (el.getAttribute('title') || '').replace(/\s+/g, ' ').trim(),
    role: (() => {
      const row = el.closest('tr');
      return row && row.cells[0] ? row.cells[0].innerText.replace(/\s+/g, ' ').trim() : null;
    })(),
  };
  el.click();
  return JSON.stringify(describe);
})()
