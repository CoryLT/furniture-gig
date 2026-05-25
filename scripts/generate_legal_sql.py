#!/usr/bin/env python3
"""
Regenerate `supabase/schema_legal_agreements_v1.sql` from the
markdown source files in `legal/`.

Usage:
    python scripts/generate_legal_sql.py

Run this whenever you edit `legal/terms-of-service.md` or
`legal/privacy-policy.md`.

Note: if you BUMP the version (1.0 → 1.1), you should:
  1. Update the version string at the top of each .md file
  2. Update the `agreement_version` constants in this script
  3. Re-run this script (the SQL `where not exists` check uses
     the version string, so a new version will insert as a new row
     and existing acceptances will not satisfy the gate for the
     new version — users will be forced to re-accept)
"""
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TOS_PATH = REPO_ROOT / 'legal' / 'terms-of-service.md'
PP_PATH = REPO_ROOT / 'legal' / 'privacy-policy.md'
SQL_PATH = REPO_ROOT / 'supabase' / 'schema_legal_agreements_v1.sql'

TOS_VERSION = '1.0'
PP_VERSION = '1.0'

DOLLAR_TAG = '$LEGAL$'

def main() -> None:
    tos = TOS_PATH.read_text(encoding='utf-8')
    pp = PP_PATH.read_text(encoding='utf-8')

    if DOLLAR_TAG in tos:
        raise SystemExit(f"Dollar-quote tag {DOLLAR_TAG} appears inside TOS — pick a different tag.")
    if DOLLAR_TAG in pp:
        raise SystemExit(f"Dollar-quote tag {DOLLAR_TAG} appears inside Privacy Policy — pick a different tag.")

    sql = f"""-- ============================================================
-- FlipWork — TOS + Privacy Policy v{TOS_VERSION}
-- ============================================================
-- This SQL:
--   1. Deactivates the placeholder "Independent Contractor Agreement"
--      from the original schema (its IC language is now folded into
--      the new Terms of Service).
--   2. Inserts the new Terms of Service v{TOS_VERSION} as a required, active
--      agreement.
--   3. Inserts the new Privacy Policy v{PP_VERSION} as a required, active
--      agreement.
--
-- Safe to re-run. Uses ON CONFLICT and idempotent guards.
--
-- IMPORTANT: This file is generated from /legal/*.md. To update the
-- legal text, edit those .md files and re-run scripts/generate_legal_sql.py.
-- ============================================================

-- Step 1: Deactivate the placeholder agreement from the original schema.
-- It hasn't actually been shown to anyone in production (it's still
-- placeholder text), so this just hides it from future users.
update public.legal_agreements
   set active = false,
       updated_at = now()
 where title = 'Independent Contractor Agreement'
   and version = '1.0'
   and content like 'This is a placeholder agreement.%';

-- Step 2: Make sure we don't double-insert the new agreements if this
-- script is re-run. We key on (title, version) being unique within
-- our seeded set. There's no DB-level unique constraint, so we use a
-- conditional insert.

-- Step 2a: Terms of Service v{TOS_VERSION}
insert into public.legal_agreements (title, version, content, required, active)
select 'Terms of Service', '{TOS_VERSION}', {DOLLAR_TAG}{tos}{DOLLAR_TAG}, true, true
where not exists (
  select 1 from public.legal_agreements
   where title = 'Terms of Service' and version = '{TOS_VERSION}'
);

-- Step 2b: Privacy Policy v{PP_VERSION}
insert into public.legal_agreements (title, version, content, required, active)
select 'Privacy Policy', '{PP_VERSION}', {DOLLAR_TAG}{pp}{DOLLAR_TAG}, true, true
where not exists (
  select 1 from public.legal_agreements
   where title = 'Privacy Policy' and version = '{PP_VERSION}'
);

-- Step 3: Sanity check — show what's now active and required.
-- (Cory: after running the script, run this select to confirm.)
-- select id, title, version, required, active, created_at
--   from public.legal_agreements
--  where active = true and required = true
--  order by created_at;
"""

    SQL_PATH.write_text(sql, encoding='utf-8')
    print(f"Wrote {len(sql)} bytes to {SQL_PATH.relative_to(REPO_ROOT)}")


if __name__ == '__main__':
    main()
