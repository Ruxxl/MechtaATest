---
name: mechta-e2e-testing
description: "Workflow for writing, extending, or debugging Cypress E2E tests in this repo (mechta.kz preprod, pp.yc.mechta.kz) — use whenever the user asks to add/fix tests for a feature area (Акции, корзина, checkout, избранное, каталог, фильтры и т.д.), investigate site behavior for tests, or file a bug found while testing. Also use when asked to generate additional/non-standard test cases for an already-covered area."
model: inherit
background: false
metadata:
  version: 1.0.0
---

# Mechta E2E testing workflow

This project tests a **live preprod site**, not a mock. The single most important rule,
learned the hard way across this whole test suite: **never encode an assertion from a
guess or a spreadsheet's claim — verify it first, against the real site or the real API.**
Test-case documents (Excel exports, `TestPlans/*.md`) frequently describe behavior that
turns out to be wrong once actually checked (wrong URL params, wrong button labels,
features that don't exist, mechanisms the plan itself got backwards). Treat them as a
starting hypothesis, not ground truth.

## 1. Recon before writing a single assertion

For every selector, every "does X reset Y" claim, and every API status code you're about
to assert on:

1. **UI facts** → drive the real site with the claude-in-chrome browser tools
   (`navigate`, `computer`, `javascript_exec`) at the target viewport (2560×1440 per
   `cypress.config.js`). Read the actual DOM (`querySelector`, `getBoundingClientRect`,
   `getAttribute('aria-expanded')`, etc.) rather than trusting what a screenshot looks
   like — this codebase has real dual mobile/desktop DOM elements that visually look
   identical but differ in `getBoundingClientRect().width`.
2. **API facts** → hit the real backend directly, either with `curl` (fast iteration) or
   `cy.request()` (final form in the spec). The frontend on **every** environment,
   including `pp.yc.mechta.kz`, always calls `https://www.mechta.kz/api/v3/...` — there
   is no separate preprod backend. Standard headers: `Accept: application/json`,
   `X-City-Code: <lowercase city slug>` (e.g. `astana`). Some endpoints
   (`/catalog/products`) additionally require `X-Mechta-Device-Id: <any non-empty
   string>` or they 422.
3. Only after both UI and API behavior are confirmed, write the Cypress test.

If a `TestPlans/*.md` file or an Excel test-case export disagrees with what you just
observed, the observation wins — update your understanding, and if the plan document
itself will mislead a future reader, correct it or note the discrepancy inline.

## 2. Bug vs. not-a-bug

Baseline definition (ISTQB/IEEE — use this as the actual test, not a vibe check): a
**defect/fault** is a flaw in a component or system that can cause it to fail to perform
its required function; a **failure** is the observable event where that happens at
runtime. A bug report should point at a required function that is not being performed —
either "the API is required to signal errors correctly and doesn't" or "the frontend is
required to present the API's response to the user and doesn't." If neither required
function is actually violated, it isn't a bug, no matter how unusual the behavior looks.

Concretely for this project, a bug is either of these — both are equally valid to file,
don't only look for the frontend one:

- **The API itself returns an incorrect or incorrectly-handled error** — wrong status
  code for the situation (e.g. `500` for what is really a "not found" case), a broken or
  inconsistent error contract, a response that doesn't correctly describe what actually
  happened. This is worth reporting even if the frontend happens not to visibly break —
  an API returning the wrong kind of error is a real defect on its own, not just a
  cosmetic contract nitpick.
- **The frontend fails to handle a response from the API for the end user** — infinite
  loading skeleton, raw technical error text shown in the UI, a silently broken page —
  regardless of whether that API response was itself correct (e.g. a legitimate `204` for
  an empty result) or not.

Not a bug: the API's response is correct and well-formed (including deliberate empty
results, expected error codes for genuinely invalid input) **and** the frontend handles it
fine — even if the specific behavior is surprising at first glance. A filter/sort/pagination
reset that a reasonable e-commerce site would deliberately do (e.g. picking a category
resets the sort order) is expected product behavior, not a bug.

When in doubt about whether an API error is "correct for the situation" vs. "wrong kind of
error," lean toward filing it (or at minimum flagging it in the area's README) rather than
silently classifying it as fine — this project previously under-filed a `500`-instead-of-`404`
case for exactly this reason and it should be revisited.

When something IS a real, user-facing bug:

- File it under `BugReport/<Area>/BUG-NNN-slug.md` — one bug, one file. Follow the
  existing format in that folder exactly (Severity, Приоритет, Статус, Дата, Окружение,
  Предусловия, Шаги воспроизведения, Ожидаемый результат, Фактический результат,
  Скриншоты, Вероятная причина, Автотест). Add a row to `BugReport/<Area>/README.md`.
- Add a real screenshot to `BugReport/<Area>/screenshots/` (captured via the browser
  tools, not fabricated).
- Write the Cypress test to assert the CORRECT/expected behavior, so it fails now and
  starts passing automatically once the bug is fixed. Reference the bug ID in a comment.
- When something looks like a bug candidate but turns out to be intentional design
  (confirmed by re-testing, or by the user telling you directly), do NOT file it. Add it
  instead to the "Что НЕ было оформлено как баг" section of the area's README, with a
  one-line reason.

When genuinely unsure, prefer documenting as "not a bug, but worth watching" over filing
a low-confidence report.

## 3. Architecture conventions already in this repo — follow them, don't reinvent

- **Page Objects**: `cypress/support/pageObjects/**`. One class per page/area
  (`actions/catalogPage.js`, `actions/detailPage.js`, etc.). Methods should be small,
  named after user intent (`clickFilterValueCheckbox`, `assertTypeActive`), and encode
  the *current verified* selector strategy — with a one-line comment on WHY a selector
  looks unusual (e.g. "custom checkbox, not `<input>`", "climbs DOM because heading has
  no stable container class").
- **API helpers**: `cypress/support/helpers/*Api.js` (e.g. `promotionsApi.js`,
  `catalogFilterApi.js`). Wrap `cy.request()` with the right base URL/headers; expose
  small pure functions like `findFilterItem(body, groupSlug, itemSlug)` for reuse in
  assertions.
- **Fixtures**: `cypress/fixtures/*.json` are **live-data-tolerant by design** — since
  promo/catalog data changes daily, prefer fixture fields that name a stable *slug*
  (category, subcategory, brand, promo) over a hardcoded count. Compute expected counts
  dynamically from the API inside the test (`getCatalogFilters(...).then(({body}) => ...)`),
  never hardcode a number that came from today's snapshot.
- **New feature area → new spec file**, not edits scattered across existing ones, unless
  explicitly told the existing file's tests are safe to extend in place. When a user asks
  for new coverage "without touching what's already passing," always create a new
  `*.cy.js` file.

## 4. Known Cypress-specific gotchas in this codebase

These cost real debugging time before being pinned down — check here before re-deriving
them from scratch:

- **`cy.intercept` alias race**: reusing one alias across a mid-test `cy.visit()` (or any
  second page load) lets that reload's own initial request silently consume the next
  `cy.wait('@alias')` slot, so the wait resolves with the wrong (usually unfiltered)
  response instead of timing out. Fix: split the two sequences into **separate `it()`
  blocks**, each checked against an independent `cy.request()`/API-helper ground truth,
  rather than chaining both inside one test.
- **Untrusted-click dead ends**: some widgets only react to real (`isTrusted`) mouse
  events — Cypress's `.click()`, `{force: true}`, and even a hand-built
  `dispatchEvent(pointerdown/mousedown/pointerup/mouseup/click)` sequence all silently
  no-op. Confirmed example: the "Показать все" brand-filter expander on
  `/useful/shares/{slug}/`. If a click has zero effect after a generous wait and no
  actionability error was thrown, suspect this class of issue rather than re-trying more
  click variants — pick a different, already-visible value/element instead of fighting it.
- **Pagination number buttons don't render** in Cypress (Electron or Chrome-via-Cypress)
  at 2560×1440 even though `window.innerWidth` correctly reports 2560 — but the same page
  renders pagination fine via the claude-in-chrome extension. Verify punits of pagination
  via `meta.currentPage` in the intercepted API response plus content matching, not by
  clicking a page-number element.
- **URL encoding**: `cy.url()` shows literal `[`/`]` in query params (e.g.
  `properties[brend][]=apple`), not percent-encoded — don't assert on `%5B%5D`.

## 5. Generating positive/negative/non-standard cases — do this for every area by default

Don't wait to be asked for "negative cases" or "more cases" separately — apply this
systematically whenever writing or extending coverage for a feature area, using
established test-design techniques (not ad-hoc guessing):

1. **Equivalence partitioning + boundary value analysis**, for every input field/param:
   test empty, the minimum valid value, just below the minimum (invalid), the maximum
   valid value, just above the maximum (invalid), a typical mid-range value, and a
   wildly-out-of-domain value (huge number, negative number, unicode/emoji, a
   SQL-injection-looking string, an extremely long string). Apply to price ranges,
   quantity steppers, phone numbers, promo/search inputs, page numbers, IINs, addresses —
   anything the user types or a URL param can carry.
2. **Negative-testing checklist**, for every user action: what if the network request
   fails mid-action, a required field is empty, a field has the wrong format, the user
   double-submits, the user navigates back/forward mid-flow, the session expires
   mid-flow, or the URL is hand-edited to reference a nonexistent/foreign ID (product,
   category, promo, order). This repo has repeatedly found real bugs exactly here (see
   BUG-001/BUG-004: hand-edited/invalid URL params leaving the UI stuck loading forever).
3. **State-based / CRUD thinking**, for anything with persistent state (cart, favorites,
   addresses, applied filters, comparison list): test create, read-back (does it actually
   show what was just created), update, delete, and re-create after delete. Check that
   counters/badges update immediately and consistently with the actual state.
4. **Combinatorial / pairwise thinking**, whenever 2+ independent options can interact
   (filters, sort+pagination, category+type): don't just test each alone — test pairs in
   both orders, and specifically include the pair that produces a **zero-result
   intersection** (this is where BUG-002/BUG-004-style "stuck loading, no empty-state
   message" bugs live). Cross-check the resulting count against a direct API call rather
   than eyeballing the list.
5. **Exploratory heuristics as a prompt when you're out of ideas** (from Rapid Software
   Testing / James Bach & Michael Bolton — use these as literal checklists, not vibes):
   - **SFDPOT** — Structure (what's the DOM/API actually made of, any hidden duplicate
     mobile/desktop elements), Function (what is this control actually supposed to do),
     Data (formats, boundaries, encoding of what flows through it), Platform (viewport,
     city/locale via `X-City-Code`, auth state), Operations (how a real user actually
     uses this, not just the demo path), Time (races, debouncing, expiry, rapid repeated
     actions).
   - **HICCUPPS consistency oracles** — is the behavior consistent with **H**istory (what
     it just did a moment ago), **I**mage (the site's own stated claims/branding),
     **C**omparable products (how other e-commerce sites handle this), **C**laims
     (what the test plan/spec says), **U**ser expectations (plain common sense),
     the **P**roduct itself (internally consistent between pages — e.g. does the catalog
     page and the detail page treat the same filter the same way), **P**urpose (does it
     serve the actual business goal), **S**tatutes (legal/regulatory expectations, e.g.
     price/discount display rules).
6. **Concrete patterns already proven to find real issues in this repo** — reuse these
   shapes: chain UI actions in an order a spreadsheet wouldn't think to write down (sort
   → filter → category, or the reverse of a documented order to check symmetry); pick a
   facet with a non-trivial count and cross-check the resulting count against a direct API
   call; fire rapid repeated actions (double-click, quick toggle-then-untoggle, two
   category clicks with no wait between) to probe debouncing/race handling; hand-edit a
   URL with a syntactically-valid but domain-invalid value.

Keep generating new cases like this on an ongoing basis whenever more coverage is
requested, across ALL areas (not just the one currently being discussed) — don't wait to
be re-briefed on the technique each time.

## 6. Common web/e-commerce bug classes — run as a dedicated pass, in their own file

Goal: **find bugs before real users do.** Beyond the feature-specific cases above, every
area (cart, checkout, favorites, catalog/filters, auth) should also get a pass targeting
the bug classes that repeatedly show up in real web/e-commerce products (industry data,
not guesswork — cross-browser/rendering inconsistencies, form-validation bugs, and
race-condition/business-logic flaws around cart and checkout are consistently at the top
of every published "most common web app bugs" and "e-commerce QA checklist" list). Write
these as their **own spec file** per area (e.g. `cart_common_bugs.cy.js`,
`checkout_common_bugs.cy.js`) rather than folding them into the functional spec, so they
can be run and reported on independently. Concrete, testable-in-this-stack instances:

- **Race conditions on cart/checkout**: fire two near-simultaneous add-to-cart requests
  for the same item (`Promise`-style parallel `cy.request()` calls, or two rapid real
  clicks with no wait between) and check quantity/price end up consistent, not doubled or
  lost. Same idea for rapid double-clicking "Оформить заказ"/place-order — verify it does
  not create two orders. Same idea for redeeming a promo/discount code twice in quick
  succession.
- **Discount/price re-validation**: apply a promo/discount that depends on cart contents
  or quantity thresholds, then change the cart so it should no longer qualify (remove an
  item, drop below a minimum) — verify the discount is actually recalculated/removed
  before the final total, not left stale.
- **Server trusting client-supplied values**: where feasible via `cy.request()` (bypassing
  the UI), try sending a tampered price/quantity/discount value directly to the
  add-to-cart or order endpoint and confirm the server recomputes from its own data rather
  than trusting the client — this is a business-logic bug class, not just a UI one.
- **Stock/price consistency across pages**: does the price/availability shown on a
  catalog card match the product page and the cart; does requesting a quantity above
  available stock get rejected consistently everywhere it can be requested from (product
  page, cart quantity stepper, direct API).
- **Session/auth edge cases**: what happens if the auth token/session is cleared or
  expires mid-checkout or mid-favoriting — graceful re-auth prompt, not a silently broken
  state or lost cart contents.
- **Cross-browser/responsive/layout**: this repo already runs at a fixed 2560×1440
  viewport per `cypress.config.js` — when relevant, deliberately also check a mobile
  viewport size (`cy.viewport(...)`) for layout breakage, since real dual mobile/desktop
  DOM elements already confirmed to exist in this codebase are exactly where such bugs hide.
- **Form validation gaps**: for every form (checkout address, phone/SMS auth, search),
  confirm client-side validation matches server-side validation — a value the UI rejects
  should also be rejected if sent directly via `cy.request()`, and vice versa (a value the
  UI silently accepts shouldn't cause a raw/ugly server error later in the flow).

## 7. Before calling it done

- Run the new/changed spec **2–3 times in a row** (`npx cypress run --spec <path>
  --headless`) to catch flakiness before reporting success — this suite has repeatedly
  surfaced race conditions that only show up intermittently.
- Run the full sibling folder together (e.g. `cypress/e2e/Regress_Test/actions/*.cy.js`)
  once, to confirm the new spec doesn't interfere with previously-passing ones.
- Delete throwaway probe specs (`zzz_probe_*.cy.js`) once recon is finished — they are
  scratch work, not part of the suite.
- A spec with intentional failing tests documenting an open, unfixed bug is a correct
  final state, not something to "fix" by loosening the assertion — the test should start
  passing automatically once the real bug is fixed.
