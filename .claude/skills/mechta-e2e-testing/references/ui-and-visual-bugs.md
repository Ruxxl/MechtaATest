# UI / visual / interaction bug classes

Detailed checklist referenced from `SKILL.md` §9. Same base rule as the rest of the
suite: verify against the real rendered page (claude-in-chrome, real DOM/computed
styles) before encoding an assertion — a screenshot alone is not enough, this codebase
already has confirmed cases of visually-identical dual mobile/desktop elements that only
differ in `getBoundingClientRect()`.

## 1. Responsive & the dual-DOM gotcha, properly covered

SKILL.md §4 already flags that this repo has real duplicate mobile/desktop DOM nodes.
Turn that into a systematic pass, not a one-off gotcha to remember:

- For every component, check render at **both** the fixed Cypress viewport (2560×1440)
  and at least one mobile width (`cy.viewport(375, 812)` or similar) via
  `cy.viewport(...)`, and separately via claude-in-chrome at a real mobile emulation —
  pagination is already confirmed to behave differently between the two, other
  components may too.
- At each breakpoint, confirm **only one** of the mobile/desktop DOM variants is
  actually visible AND interactive — check `getBoundingClientRect()` width/height > 0
  overlapping with click target, not just `display`/`visibility` CSS, since a
  zero-size-but-present element can still swallow clicks in some layouts.
- Check the breakpoint boundary itself (resize across it, e.g. 768px↔769px) — content
  that reflows correctly at each fixed width can still glitch (double-render, flash of
  wrong layout, stuck-mid-transition) exactly at the crossover.

## 2. Layout / visual defects

- **Text truncation and overflow** with real-world content lengths, not lorem-ipsum
  short strings: long product names, long category/brand names, long delivery
  addresses, long user names in profile/reviews. Check both CSS-level (`text-overflow:
  ellipsis` actually applied, not just clipped raw) and whether truncation hides
  functionally important text (e.g. the price or the "in stock" badge pushed off-screen
  by an overlong title).
- **Z-index / stacking bugs**: sticky header or footer overlapping page content after
  scroll, especially once content height changes dynamically (an accordion or filter
  panel expanding pushes real content under a sticky element that doesn't account for
  the new height). A dropdown/tooltip rendering behind a modal or another dropdown when
  two are opened close in sequence.
- **Broken/missing media**: intercept an image request and force a 404 to confirm there's
  a fallback (placeholder), not a broken-image icon or, worse, a layout collapse where
  the missing image's reserved space disappears and reflows everything below it.
- **Layout shift while content loads** (the visual analogue of the "infinite skeleton"
  bug class in SKILL.md §2): does a skeleton loader reserve the same footprint as the
  real content once it arrives, or does the page jump when content pops in — check via
  `getBoundingClientRect()` before/after the content swap, not by eyeballing.

## 3. Full interaction-state matrix per control

For every meaningfully interactive control (buttons, checkboxes, filter chips, quantity
steppers, form inputs, links) — not just the default state a screenshot happens to
capture — verify each of: **default, hover, focus, active/pressed, disabled, loading,
error, empty**. Concretely:

- Disabled state actually blocks the action (not just styled differently while the
  click handler still fires) — check by dispatching a click on a visually-disabled
  element and confirming nothing happens.
- Loading state on a button (e.g. "Оформить заказ" while the order request is
  in-flight) actually prevents a second submit — this is the UI half of the
  double-submit race class in SKILL.md §6/§8; check both that a second click is a no-op
  AND that the button visually shows it's busy.
- Error state on a form field clears/updates correctly when the user starts correcting
  the input, rather than the stale error message staying visible next to now-valid
  input.
- Custom (non-native) controls — this repo already has custom checkboxes not backed by
  `<input>` — need their ARIA state (`aria-checked`, `aria-expanded`, `aria-selected`)
  cross-checked against the actual visual state after every interaction, not just
  asserted once at initial render.

## 4. Keyboard / focus management

- Tab order follows visual/logical order through forms and interactive lists — no focus
  jumping to an off-screen or hidden element.
- Modals trap focus while open (Tab doesn't escape to page content behind the overlay)
  and restore focus to the triggering element on close.
- `Escape` closes modals/dropdowns/overlays; `Enter` submits forms from a focused
  text input, consistently across the checkout, auth, and search forms.
- Every interactive element has a visible focus indicator (don't rely on default browser
  outline being present — many resets strip it without replacing it, which is a real
  accessibility defect worth flagging even if not the main focus of the pass).
- Every form input has a label programmatically associated with it (`<label for>` or
  `aria-label`), and icon-only buttons (cart icon, favorite heart, close ✕) have
  accessible text — check via the DOM, not visually, since these are invisible defects
  in a screenshot.

## 5. Animation / transition edge cases

- Rapidly re-triggering a control mid-animation (open/close a dropdown or accordion
  faster than its transition duration, several times in a row) — check the DOM doesn't
  end up in an inconsistent state (e.g. `aria-expanded="true"` but the panel visually
  closed, or the panel present twice).
- Whether an in-progress animation blocks further interaction is itself worth asserting
  explicitly either way: if a modal open/close animation is supposed to block a second
  trigger, confirm it does; if it isn't supposed to block, confirm rapid interaction
  doesn't break state (ties back to §3's double-submit checks).

## 6. Text / locale display bugs (RU/KZ specific)

- **Pluralization**: Russian plural forms are not simple singular/plural — "1 товар", "2
  товара", "5 товаров" all differ. Check counters (cart item count, search results
  count, "N отзывов") at boundary values 1, 2, 5, 11, 21 specifically (11–14 and forms
  ending in 1 are the classic Russian pluralization bug boundary).
- **KZ vs RU string length**: Kazakh translations of the same label/button/product
  attribute are often noticeably longer than Russian — re-run the truncation/overflow
  checks from §2 specifically with KZ-locale content, not just RU, since a layout that
  survives RU text can still break on KZ.
- Currency and number formatting consistency (₸ symbol placement, thousands separator)
  across catalog card, product page, cart, and checkout — the same price shouldn't be
  formatted differently on different pages.

## 7. Empty / zero / error states

Every list-type UI needs a designed empty state, not blank white space or a stuck
skeleton — check each of these explicitly by driving the underlying data to zero
(stubbed API response or a real filter combination that produces zero results, per
SKILL.md §5 point 5):

- Zero search/catalog/filter results
- Empty cart
- Empty favorites
- No saved addresses
- Empty order history
- A generic API-error state (5xx) — confirm there's a real error message/retry affordance
  and not raw technical text or an infinite spinner (this doubles as the frontend-handling
  bug class in SKILL.md §2).

## 8. Modal / overlay stacking

- Open a modal from inside another modal (e.g. an address picker launched from within
  checkout) — closing the top one should return cleanly to the first, not close both or
  leave an orphaned backdrop/scroll-lock behind (check `document.body`'s scroll-lock
  class/style is correctly removed only when the last overlay closes, not on every
  close).
- Opening the same modal twice in quick succession (double-click the trigger) shouldn't
  stack two copies of it.
