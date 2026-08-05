# Cross-service, access-control, and third-party integration bug classes

This file is the detailed checklist referenced from `SKILL.md` section 8. Load it before
a testing pass on checkout/payment, loyalty/bonus, order↔1C sync, personal account/auth,
or anything with a webhook or async callback. Everything here follows the same rule as
the rest of the suite: **verify against the real API/services first, never assert from a
guess.**

Filing convention for this class of bug: if the root cause genuinely spans two systems
(e.g. order service says paid, payment gateway says pending), file it under
`BugReport/CrossService/BUG-NNN-slug.md`; if it's an access-control issue, file it under
`BugReport/Security/BUG-NNN-slug.md`. Same format as every other bug report (Severity,
Приоритет, Статус, Дата, Окружение, Предусловия, Шаги воспроизведения, Ожидаемый
результат, Фактический результат, Скриншоты, Вероятная причина, Автотест) — just note in
"Вероятная причина" which two systems disagree and how you confirmed each side
independently (two separate `cy.request()`/`curl` calls against two different endpoints,
not just one page).

---

## 1. Race conditions and idempotency at service boundaries

The failure shape here is different from the single-service races in SKILL.md §6: the
window is between two *different* services, not two clicks on the same button.

- **Duplicate webhook/callback delivery.** Every payment/notification provider retries
  on timeout by design (that's not a bug in *them*). Simulate this directly:
  `cy.request()` (or `curl`) the payment-callback endpoint twice in a row with the same
  transaction/order ID and same payload. Expected: the second call is a no-op (order
  stays paid-once, no duplicate stock decrement, no duplicate bonus award, no duplicate
  SMS). If the second call re-runs side effects, that's a missing-idempotency-key bug —
  file it as high severity, this is a real financial-integrity issue in e-commerce.
- **Out-of-order callback delivery.** Fire a "payment failed" callback *after* a "payment
  success" callback for the same order (or vice versa, if the gateway can produce that
  ordering under retry/network jitter). Expected: the system keeps the correct final
  state or explicitly rejects the stale transition, not "last write wins" if that means
  a failed payment can flip a paid order back to unpaid, or a stale success can revive a
  cancelled order.
- **Split-brain between payment and order services.** Use `cy.intercept()` to force the
  order-creation call to fail/timeout *after* the payment gateway has already confirmed
  the charge (or the reverse: force the payment confirm to fail after the order record
  was created). Expected: a reconciliation path exists — the user isn't charged with no
  order, and no order exists in a "paid" state with no matching successful charge. If you
  can't force this via intercept, at minimum document it as an open question in the
  area's README rather than skipping it silently — this is the single highest-impact bug
  class in e-commerce checkout and is worth flagging even as "not yet verified, needs a
  test double for the payment gateway."
- **Partial failure between adjacent steps of one logical operation** (order created →
  stock decremented → bonus awarded → SMS sent → 1C sync queued): pick a point in this
  chain, force the *next* step to fail (network kill via `cy.intercept({forceNetworkError:
  true})` or a stubbed 5xx), and check what state the *earlier* steps are left in. A
  correctly-built system either rolls back or queues a retry/compensation; a buggy one
  leaves an order with decremented stock but no confirmation, or bonus awarded for an
  order that never actually completed.

## 2. Eventual-consistency windows

Some of these are expected-and-fine (e.g. "1C sync may lag by up to N minutes" is a
legitimate SLA, not a bug) — the point is to know the actual window and assert against
*that*, not against "should be instant" or silently assume it's fine.

- After placing an order, poll (or check once after a documented delay) whether order
  status, bonus balance, and the 1C-facing export agree with each other and with what the
  order-detail API itself reports. This generalizes the JSON-vs-CommerceML-XML bonus
  mismatch already found in this project — treat any two systems that are supposed to
  describe the same order as a pair to cross-check, not just that one.
- Cache invalidation: change price/stock/discount server-side (or via a stubbed
  response), then check catalog card, product detail page, and cart all update within
  the claimed window — not "catalog updated, product page still shows old price 10
  minutes later."
- City-scoped data (`X-City-Code`): switch city mid-session and verify cart/stock/price
  figures actually refresh for the new city rather than silently keeping stale
  first-city data (a specific instance of the general oracle above, but common enough in
  multi-warehouse retail to call out).

## 3. Access control / IDOR — in-scope for QA, not a pentest

This is standard e-commerce QA, not offensive security testing: e-commerce sites
routinely ship bugs where changing an ID in a URL or request body exposes or lets you
modify another user's data. Test with two real (or test) accounts, A and B:

- **Horizontal read**: while authenticated as B, request A's order detail, order
  history item, saved address, favorites list, or cart by ID (`GET
  /orders/{a_order_id}`, etc.) — directly via `cy.request()` with B's auth token, not
  through the UI (the UI may simply not offer a way to type the ID, which doesn't mean
  the API is safe). Expected: `403`/`404`, never A's data.
- **Horizontal write**: as B, attempt to cancel/edit/delete A's order, remove an item
  from A's cart, or update A's address by ID. Expected: rejected, not silently applied.
- **Sequential/guessable IDs**: if order/promo/coupon IDs are sequential integers rather
  than UUIDs, note this explicitly in the report even if access itself is properly
  blocked — enumerable IDs are a real (lower-severity) finding on their own because they
  leak business volume/activity even without a direct access bug.
- **Mass assignment**: send extra fields in a request body that the client-side form
  never exposes — `price`, `discount`, `bonusAmount`, `status`, `isAdmin`,
  `deliveryCost` — on add-to-cart, checkout, or profile-update calls, and confirm the
  server ignores/rejects them rather than trusting whatever the client sent. This is the
  server-trusting-client-values class from SKILL.md §6, generalized past just
  price/quantity to any field that shouldn't be client-settable.
- **Auth/session boundary**: rate-limit check on SMS/OTP auth (fire N rapid requests,
  confirm throttling exists rather than unlimited SMS spam to a phone number); confirm a
  cleared/expired token on a mutating endpoint (`POST /cart`, `POST /orders`) gets a
  clean `401` and re-auth prompt, not a request that partially executes then errors.

## 4. Payment-gateway-specific (E-pay, Apple Pay, Google Pay)

- **Currency/rounding**: apply a discount or split-payment scenario that produces a
  non-round total (e.g. a percentage discount on an odd-kopeck price) and check the
  amount actually charged, the amount shown pre-payment, and the amount recorded on the
  order all match to the tiyn/kopeck — rounding drift between "what the UI displayed"
  and "what was actually charged" is a real and reportable defect.
- **Refund/cancel consistency**: after a cancel or refund, verify order status, bonus
  reversal (if bonuses were awarded/spent on that order), and stock restoration all
  happen together — a partial refund that reverses payment but not bonus balance (or
  vice versa) is exactly the cross-service class this file is about.
- **Abandoned/failed payment cleanup**: start checkout, get to the payment redirect, then
  abandon it (close tab / let it time out) instead of completing payment. Confirm stock
  reserved for that cart is eventually released and no ghost "pending forever" order
  accumulates — check this by directly querying order status after the documented
  timeout window, not just visually.

## 5. Notification side effects (SMS / push / email)

Treat notification triggers the same way SKILL.md §5 treats API-field stubbing — drive
every relevant order/account state transition and check the notification fires exactly
once with content matching the actual state, not the state at the time the notification
template was last touched:

- Order status changes (created → paid → assembling → delivered → cancelled): each
  transition that's supposed to notify does, exactly once, with correct order
  number/amount — not stale values from an earlier state.
  In particular check the case from §1: if a webhook is delivered twice, does the
  notification also fire twice (it shouldn't).
- Missing notification is as reportable as a wrong one — if a documented transition (e.g.
  "order cancelled") is supposed to SMS the customer and doesn't, that's a bug even
  though nothing in the UI itself is broken.

## 6. Generalizing the data-integrity cross-check pattern

The concrete precedent in this project: a bonus-deduction mismatch between the order
JSON API response and the CommerceML XML export to 1C. Turn this into a repeatable
procedure rather than a one-off finding, for any pair of systems that are supposed to
describe the same fact:

1. Identify the two (or more) representations of the same underlying fact (JSON API vs.
   XML export; catalog service vs. cart service's cached copy of price/stock; order
   service vs. loyalty service's view of bonus balance).
2. Pull both independently — don't infer one from the other.
3. Diff every field that's supposed to be shared, not just the one that prompted the
   check (if you're already comparing bonus amounts, also diff order total, item list,
   and delivery address while you have both pulled).
4. If they disagree, determine which side is authoritative (usually: whichever system
   directly caused the money/stock movement) and file against the side that's wrong,
   with both raw payloads attached as evidence in the bug report.
