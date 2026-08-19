# Manual card-payment regress run (live browser, real payment)

Referenced from `SKILL.md`. This is a **different mode** from the rest of this skill:
not writing/debugging a Cypress spec, but manually driving the real site with the
claude-in-chrome browser tools through a checkout flow that ends in a **real payment**
the user makes by hand.

**Trigger**: run this procedure end-to-end, without re-deriving it or asking what to do,
whenever the user says any of — "Проведи регресс тест по оплате картой", "прогони
регресс оплаты картой", "прогнать регресс с открытием браузера" — as opposed to just
running the existing `checkout_card_payment_*_regress.cy.js` spec headlessly (which
intentionally stops short of real payment, see that file's own comments). The `/card-payment-regress`
slash command (`.claude/commands/card-payment-regress.md`) is a direct alias for this
same trigger.

## Why this exists as a separate procedure

The existing Cypress regress specs (`cypress/e2e/regress_test/checkout_card_payment_regress.cy.js`
for d5, `checkout_card_payment_pp_im_regress.cy.js` for pp.im) deliberately stop at the
redirect to the acquirer — they never complete a real payment. When the user wants the
*actual* payment completed and the *actual* post-payment order state checked, that can't
be scripted: a human has to enter the real card and confirm on the acquirer's own page.
This procedure is the manual equivalent of those specs, extended one step further (real
pay + real order-details verification), run interactively.

## Preconditions — check every time, don't assume from last run

1. **Which stand/acquirer is currently live.** As of 2026-08-19 `pp.im.mdev.kz`
   (epay.homebank.kz) is the working one, `d5.im.mdev.kz` (test-epay.epayment.kz) is
   broken — see `reference_pp_im_stand` / `project_checkout_acquirer_migration_test`
   memory. Re-verify rather than trusting this note forever; it has flipped before.
2. **claude-in-chrome tab connectivity and domain permission.** `tabs_context_mcp` first.
   The extension drops mid-session often on this project (confirmed repeatedly
   2026-08-18/19) — when a call errors "Browser extension is not connected" or
   "Permission denied for this action on this domain" (permission resets on every
   reconnect), don't hammer retries: `ScheduleWakeup` at 60-90s and check again, tell the
   user what you're waiting on. The acquirer's own payment page (Halyk/Google
   Pay/Dynatrace RUM beacons) is also just slow — screenshots can stay blank for
   20-45 seconds before the card form renders; that's normal, keep waiting rather than
   assuming it's broken.
3. **Which account is actually logged in — always verify, never assume.** Confirmed
   live 2026-08-18: this shared browser can end up logged into a REAL customer phone
   number instead of the test account. Check `/cabinet/` → the phone number shown, or
   zoom into the header avatar/phone. If it's not `0000000000`/"John Appleseed", log
   out and log back in via the real UI flow (click "Войти" → phone `0000000000` → code
   `0000`, same pattern as `cy.loginPpIm` but through the actual UI, not `cy.request`).
   Never proceed on a real customer's session.
4. **Products**: default to the two already validated as cheap/safe/in-stock for this
   exact purpose — `batareyka-camelion-cr1632-1-shtdot` and
   `batareyka-camelion-cr2025-bp1-1-shtdot` (Camelion coin batteries, ~390₸ each,
   confirmed available for both delivery and pickup, small enough that paying for them
   for real each run is a non-issue). Only ask the user for different products if they
   say so — don't ask by default now that this pair is established.

## The stop point — non-negotiable

After "Подтвердить заказ", wait for the redirect to the acquirer's payment page (e.g.
`epay.homebank.kz/payform/`). **Stop there and wait for the user to say they've paid**
("оплатил"). Never enter card details, never click anything on the acquirer's own page —
that's the user's action by design. Only resume the checklist below once the user
explicitly confirms payment. If the browser extension drops while waiting, keep polling
`tabs_context_mcp` on a schedule — the acquirer's own `result=ok` query param appearing in
the URL is itself a strong signal the user already paid, but still wait for their actual
"оплатил" before treating it as confirmed and moving on to the next case.

## What to verify — every case, every step, no spot-checking

The user's explicit standing instruction: **all prices/arithmetic must be correct, every
API must be checked, every field must correspond** — this is not optional/sampling, it's
the default rigor for this workflow specifically (stricter than casual spot-checking).

**Method**: this is a live browser session, not Cypress. `read_network_requests` rarely
catches the API calls that matter here — this app is SSR/hydration-heavy and most of the
relevant `GET`s fire before network tracking attaches. The reliable method: use
`javascript_tool` to `fetch()` the API directly from the page's own origin
(`credentials:'include'` carries the session cookie automatically, no manual device-id
header needed for these endpoints) — e.g.:
```js
await fetch('http://api.pp.im.mdev.kz/v2/basket', {headers:{'Accept':'application/json'}, credentials:'include'}).then(r=>r.json())
```
Known endpoints (pp.im, `http://api.pp.im.mdev.kz`, adapt host per stand):
- `GET /v2/basket` — cart contents/prices.
- `GET /v2/checkout` — delivery zones (`data.delivery_info.deliveries.variants`) and
  pickup stores (`data.delivery_info.pickup.stores`). **Needs `X-City-Code: <slug>`
  header** (e.g. `almaty`) after a city switch, or it silently keeps returning the
  previous city's zones — confirmed live 2026-08-19, cost real time to diagnose.
- `GET /v2/personal/order/{id}` — full order detail (`current_status`,
  `basket.items[]`, `order.delivery_info`, `order.payment_info.total/to_pay`,
  `order.payment_info.payments[0].is_paid/type`).
- `GET /v2/personal/orders_list` — the "Мои заказы" list data (`data.orders[]`, same
  per-order shape as the single-order endpoint) — **check this too, not just the single
  order's own page**, see the dedicated checklist item below (this is where BUG-002 was
  found: the list's own card header uses a different, wrong total field).

If a JS response body needs to be read but errors `[BLOCKED: Cookie/query string data]`,
narrow the object you're printing (drop nested objects likely to contain
address/phone/payment tokens) rather than dumping the whole thing.

0. **Cross-API consistency — not optional, applies throughout the whole case, not just
   at the end.** One case touches several endpoints (`GET /v2/basket`, `GET /v2/checkout`,
   the order-creation response, `GET /v2/personal/order/{id}`, `GET /v2/personal/orders_list`)
   that all describe the *same* underlying order — they must agree with each other, not
   just each individually look plausible against the UI:
   - The same item's `name`/`code`/unit price must be identical in `/v2/basket`,
     `/v2/checkout` (if it echoes items), `/v2/personal/order/{id}`, and
     `/v2/personal/orders_list` — pull all of them for the case and diff, don't check
     only one and assume the rest match.
   - **The "Итого" arithmetic must hold as a formula across endpoints, every time**:
     `order.payment_info.total` == `basket.total_prices.discounted_price` +
     `order.delivery_info.pay` (0 for pickup/free zone) − any coupon discount −
     `order.payment_info.spent_bonuses` (when the case spends bonuses). Compute this by
     hand from the raw numbers each API call returns — don't just eyeball that two
     numbers "look the same", actually add them up and compare to the reported total.
   - `order.payment_info.to_pay` should reconcile with `total` the same way (equal to it,
     unless bonuses were spent, in which case `to_pay = total − spent_bonuses`).
   - The UI's own "Итого"/"К оплате" text, on every screen it appears (basket → step 2 →
     step 3 → confirmation modal → acquirer page if it shows an amount → post-payment
     order page → the "Мои заказы" list card), must equal this same computed number —
     not just be internally consistent with itself, but literally the same digits as
     what the arithmetic above produces from the raw API fields.
   Treat this as one continuous check running through the whole case (pre-payment steps
   1-4 below and the post-payment step 6/7 below), not a single one-off comparison at the
   end.
1. **Product fields** (basket, each checkout step, final order): name/slug, unit price,
   quantity, line total (price × quantity), and — if a discount applies — that the
   discounted price is arithmetically correct against the base price.
2. **"Итого"/"К оплате" field**, on every screen it appears (basket → step 2 → step 3 →
   acquirer page if it shows an amount): must equal `basket.total_prices.discounted_price
   + delivery variant price` (0 for pickup / free zone), and must be the *same number*
   across every screen that's supposed to show it — not just present, actually equal.
   (This is the same formula as item 0 above — item 0 is the standing cross-API version
   of this same check, kept here too as the pre-payment-specific instance of it.)
3. **Delivery/pickup selection**: the zone/store name and price shown in the UI must
   match the corresponding entry in `GET /v2/checkout`'s `delivery_info`. **As of
   2026-08-19 there is NO free delivery zone at all** for either Астана or Алматы (0 of
   ~55-103 zones have price 0) — every "Доставка" case now needs the cheapest paid zone
   (`Доставка по г.Астана` / `Доставка по г. Алматы` — note the inconsistent space
   before "Алматы", 1000₸ each as of this writing) instead of a free one. Re-verify
   live via the API each run rather than trusting this note — it may change again.
4. **`POST /v2/checkout` (order creation)**: success, and the resulting order id/sum
   match what step 3 showed. Fresh orders sit in `current_status: "created"` (not yet
   `"waiting_for_payment"`) until the browser actually reaches the acquirer — both are
   "created, unpaid" for this workflow's purposes, don't treat the difference as a bug.
5. **Acquirer redirect**: URL actually lands on the acquirer's domain, the card-entry
   form renders without errors (give it up to ~45s, see Preconditions above).
6. **Post-payment "Детали заказа" — the main point of doing this manually, and the
   strictest rule in this whole procedure.** After the user confirms payment, pull
   `GET /v2/personal/order/{id}` and compare against the cabinet UI (`/cabinet/order/{id}/`)
   AND against what was recorded *before* payment on step 3. **This is mandatory every
   run, not just for spot-checked fields** — the user has explicitly called out that
   skipping this in favor of only checking total/status is not acceptable. Walk the
   *entire* `data.order` object field by field, not just the ones that happened to matter
   last time:
   - `data.current_status` — after real payment becomes something like
     `in_delivery`/`ready_for_pickup`, never `waiting_for_payment`/`created`/an error state.
   - `data.basket.items[]` — every item's `name`, `code`, `quantity`,
     `prices_per_item.{base_price,discounted_price,has_discount}` — same as what was in
     the basket pre-payment, for every item, not just the first one.
   - `data.basket.total_prices.{base_price,discounted_price,has_discount}` — matches the
     pre-payment basket total.
   - `data.order.delivery_info.{address,name,pay,type,delivery_date,message}` — address
     text matches what was entered, `pay` matches the zone/store price selected, `type`
     matches courier vs pickup, `delivery_date` is a real (not null/garbage) date.
   - `data.order.payment_info.{spent_bonuses,bonuses,total,to_pay}` — `total`/`to_pay`
     equal the pre-payment "К оплате"; `bonuses` (accrual) matches what step 3 promised
     to credit; `spent_bonuses` is 0 unless the case specifically spends bonuses.
   - `data.order.payment_info.payments[0].{is_paid,type,summ,pay_error}` — `is_paid` must
     be `true` after real payment, `type` matches the payment method chosen ("Картой
     онлайн"), `summ` matches total, `pay_error` is null/empty.
   - `data.order.personal_info` and `data.order.platform_name` — sanity-check these exist
     and look non-empty/non-garbage even if there's no specific pre-payment value to
     diff against yet (not fully catalogued as of 2026-08-19 — dump and eyeball, note
     anything that looks wrong).
   - `data.order_status_banner`, `data.summary.{title,subtitle}` — human-readable text is
     consistent with `current_status` (e.g. doesn't say "не оплачен" while
     `is_paid:true`).
   - `data.created_at`, `data.city_slug` — sane values, city matches the case (e.g.
     `almaty` for the city-switch case).
   - order id appears consistently in both API and cabinet UI.

   Don't cherry-pick "the fields that matter" from memory — literally fetch the full
   response and go through its keys each time, since the shape itself can gain/lose
   fields between runs and a field you didn't think to check is exactly where a bug
   hides (this is how BUG-002 was found — it was in a field nobody had been checking).
7. **Also check the "Мои заказы" list** (`/cabinet/orders/` UI + `GET
   /v2/personal/orders_list` API), not only the single order's own detail page — the list
   view has its own, separately-rendered summary and can disagree with the order detail
   page even when the detail page itself is correct (exactly how BUG-002 was found: list
   card header showed only item total, ignoring delivery, while the order detail page and
   the "Оплатить" button on the very same card both showed the correct full total). DOM
   note for this list's cards: container `.bg-mi-brand-base-background.rounded-mi-xl`,
   header total is `p.text-mi-subheader-3` inside it — confirmed live 2026-08-19, may
   drift, re-verify via `read_page`/JS DOM walk if selectors stop matching.

   Any mismatch on any row — even a 1-tenge difference or a wrong-looking status string
   — is a real bug candidate, file it through the normal `SKILL.md` §2/§9 process
   (BugReport + Jira). One caveat learned the hard way: if an order you previously
   confirmed paid later shows `current_status: "canceled"` with a banner like "Не
   подходит вариант рассрочки (Kaspi)" even though it was paid by card — check with the
   user first whether *they* manually cancelled it (via the "Отменить заказ" button,
   picking a reason from that dialog's fixed list) before filing it as a backend bug; this
   produced a false-positive "paid orders auto-cancel" scare on 2026-08-19 that turned out
   to be the user's own manual cleanup between runs, not a real defect.

## Per-case flow (adapt the specific delivery/city/pickup choice per case, keep the
## checklist above identical for all of them)

1. Login (if no session yet, or if the wrong account is detected — see Preconditions §3).
2. Clear basket (remove-all via the trash icon on each line, see `clearBasket()` pattern
   in `pageObjects/checkoutPpIm.js`/`checkoutD5.js`).
3. Add the case's product(s) via `/product/<slug>/` → "В корзину". The button often needs
   a **second click** — the first one can land while the price/button is still a loading
   skeleton and silently no-ops (confirmed repeatedly live) — always screenshot-verify
   the cart badge incremented before moving on, don't trust one click blindly.
4. Checkout step 1 "Получатель" — confirm/fill FIO, phone, email (often prefilled from a
   previous run's saved data; if a field already has text and you click+type into it
   without selecting-all first, it *appends* instead of replacing — triple-click to
   select-all before typing over a prefilled field).
5. Checkout step 2 "Доставка"/"Самовывоз" — delivery/pickup per the case; verify against
   `GET /v2/checkout` (with `X-City-Code` header if the city was switched). For a new
   address, use "Добавить адрес" (not a saved one) to guarantee landing in the zone
   combobox — a reused saved address sometimes has no zone attached.
6. Checkout step 3 "Способ оплаты" — select "Картой онлайн" (default "Оплата с Kaspi.kz"
   is pre-selected — click the "Картой онлайн" card explicitly); verify Итого arithmetic
   against the basket+delivery API sum before confirming.
7. "Оплатить" → "Подтвердить заказ" in the confirmation modal — check the modal's own
   summary (items, sum, address, payment method) before clicking through.
8. Wait for acquirer redirect → **stop, wait for "оплатил"**.
9. On confirmation: verify post-payment order details + the "Мои заказы" list per the
   checklist above, screenshot the final state, report per-case before moving to the
   next one.

## Standard 5-case shape (default set for "провести регресс тест по оплате картой" with
## no further specifics from the user)

1. Single item (cr1632), delivery to the cheapest paid zone in the current city.
2. Both items (cr1632+cr2025), delivery to the cheapest paid zone (Итого = both items'
   price + zone price).
3. Both items, pickup at the first store returned by `GET /v2/checkout`'s
   `pickup.stores`.
4. Single item (cr1632), pickup at a **different** store than case 3 (second store in
   the same API list — the UI's own displayed order can differ run-to-run, always
   resolve "which store is second" from the live API list, not by re-clicking the same
   position blindly).
5. City switch (e.g. → Алматы) + delivery to that city's cheapest paid zone.

(Additional cases from the `.cy.js` specs — express delivery, promo code, bonus spend,
gift-item modal — can be added the same way if the user asks for more than the first 5;
same checklist applies unchanged, same caveat about zones/stores needing live API
re-verification rather than hardcoded names.)

## After all cases: standing habit, not a one-off

If a bug is found mid-run (as it was on 2026-08-19, BUG-002), file it immediately per
`SKILL.md` §2/§9 — don't wait until the whole regress finishes. If a matching Cypress
regression test is worth writing and the bug requires the browser to complete a real
top-level navigation to the acquirer domain to reproduce, expect headless Cypress to hang
on the acquirer's own slow `load` event (confirmed: 90-150s timeouts even with generous
`pageLoadTimeout`) — the working fix is `cy.intercept('<acquirer-domain>/<page-path>/**',
{statusCode: 204})` on exactly the page's own path (not a broad domain wildcard, which
also breaks the page's other JSON-expecting XHR calls; not `resourceType:'document'`,
which doesn't match this kind of JS-triggered top-level cross-origin navigation in this
Cypress version) — a 204 makes the browser abort the navigation instead of committing to
it, so `load` resolves instantly and the order is still created on the backend by the
time the intercepted request fires.
