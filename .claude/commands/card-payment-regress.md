---
description: Run the live-browser card-payment regress (5 real-money cases on pp.im.mdev.kz, stops at each acquirer redirect for the user to actually pay)
---

Invoke the `mechta-e2e-testing` skill, then follow
`.claude/skills/mechta-e2e-testing/references/manual-card-payment-regress.md` in full —
preconditions, the 5-case default set, the exhaustive API+UI verification checklist, and
the non-negotiable stop-at-acquirer-redirect rule (wait for the user's own "оплатил"
before checking post-payment state) — without re-deriving or re-asking about any of it.

If the user gave extra instructions alongside this command (different products, a
different case count, a specific stand), apply those on top of the reference file's
defaults; otherwise use its defaults as-is.
