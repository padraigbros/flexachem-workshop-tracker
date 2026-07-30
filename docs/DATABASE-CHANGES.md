# Changing the Flexachem database

Written after the 29 Jul 2026 outage, in which a routine security-advisor cleanup broke job
creation in production for several hours. Two jobs were lost. The rules below are not general
best practice copied from somewhere — each one maps to a specific thing that went wrong.

---

## The incident, in one paragraph

Supabase's security advisor listed 22 warnings and 1 error. Working through them, we altered
two database functions (`flexachem_sync_job_staff`, `flexachem_sync_job_columns`) purely to
clear a "Function Search Path Mutable" warning. Those functions were triggers that populated
three NOT NULL columns on `jobs` — `allocated_to`, `customer` and `job_type` — which the
application never wrote itself. After the change, every job insert failed with
`23502 null value in column "allocated_to"`. The app had no way to report a failed write, so
the jobs appeared on the board and vanished on the next refetch. Nobody noticed for hours.

---

## Rule 1 — read the object before you change it

The two functions were classified as dead legacy code because they were absent from
`supabase-setup.sql` and not referenced anywhere in `src/`.

**That test is meaningless for database objects.** Triggers are invoked by Postgres, never by
name from application code. A grep of `src/` can never tell you whether a trigger is load-bearing.

Before altering or dropping any function, trigger or policy:

```sql
-- What does it actually do?
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = '<name>';

-- Is it wired to a table?
select tgname, pg_get_triggerdef(oid)
from pg_trigger where tgrelid = 'public.<table>'::regclass and not tgisinternal;
```

If you cannot explain what an object does, you are not in a position to decide it is safe to
change.

## Rule 2 — a linter warning is not a bug

The change that caused the outage was made to clear a **warning**, on functions we had already
confirmed were `prosecdef = false` — i.e. NOT `SECURITY DEFINER`, i.e. the warning was close to
meaningless for them. The evidence that the change was unnecessary was on screen before the
change was made.

Risk-rank findings before acting. In that advisory list:

| Finding | Real severity |
|---|---|
| `anon` INSERT/UPDATE/DELETE policies on `jobs`/`staff` | **Critical.** The anon key is public; anyone could delete every row. Fix immediately. |
| `rls_disabled_in_public` on `notes` | Real. World-writable table. |
| `SECURITY DEFINER` functions callable by anon | Low. Worth revoking, no urgency. |
| Search-path warnings on non-`SECURITY DEFINER` functions | **Cosmetic. Leave them.** |

Driving a warning count to zero is not a goal. Closing real holes is.

## Rule 3 — production changes are not hand-run in the SQL editor

Every statement in this incident was pasted into the SQL editor of a project badged
**PRODUCTION**, mid-afternoon on a working day, while a colleague was actively creating jobs.
There was no branch, no backup, no rehearsal, and no stated rollback.

- Use a **Supabase branch** to rehearse anything touching functions, triggers, constraints or
  policies. Confirm the app still works against the branch first.
- Fold the change into `supabase-setup.sql` in the same session, so the script stays the
  source of truth. (It drifted badly here: `allocated_to`/`customer`/`job_type` and the sync
  triggers were never in it at all, which is *why* they looked like dead code.)
- Know the rollback statement **before** running the change, not after.
- Prefer quiet hours. Nobody was harmed by the security fix itself; they were harmed by it
  landing while they were working.

## Rule 4 — verify the golden path, not the lint count

After the change we verified that the advisor showed 0 errors and 1 warning. We did not verify
that anyone could still create a job.

After **any** database change, run the Cloud write smoke test in
`.claude/skills/verify/SKILL.md`: sign in to the real app, create a job, reload, confirm it is
still there. That is thirty seconds and it is the only check that would have caught this.

Note also: **the Playwright suite cannot validate a database change.** It runs in demo mode
with `supabase === null`. A completely broken database passes it.

## Rule 5 — during an incident, evidence before hypothesis

When jobs went missing, the first explanation offered was confident, detailed, and wrong — it
blamed the RLS policy change and proposed two fixes for a problem that did not exist. The
actual cause was visible in one line of the Supabase logs:

```
23502 | null value in column "allocated_to" of relation "jobs" violates not-null constraint
```

`23502` is a constraint violation. An RLS block is `42501` / HTTP 403. One glance at the logs
settled what an hour of reasoning got wrong.

Look here first, in this order:

1. **Supabase → Logs**, filter Method `POST` / Level `Error`. The status code names the class.
2. The response body of the failing request.
3. Only then form a theory.

"What did I change recently?" is a good way to generate hypotheses and a bad way to conclude one.

## Rule 6 — the diagnostic that gets run beats the better one that doesn't

A Node script (`tools/check-schema.mjs`) was written to diff NOT NULL columns against what the
app writes. It required a secret API key, Node, and PowerShell environment syntax. It cost
hours and never ran successfully.

The same answer came from one query in the SQL editor in about thirty seconds — and it found
two further live bugs (`customer`, `job_type`) that had been missed:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('jobs','staff','job_types','customers','staff_calendar','public_holidays')
  and is_nullable = 'NO'
  and column_default is null
order by table_name, column_name;
```

Requiring the secret key also created a security problem that would not otherwise have
existed: the key ended up displayed in screenshots and had to be rotated.

Match the tool to the environment and to whoever is actually going to run it.

## Rule 7 — the app must never fail silently

The outage lasted hours because a rejected write left the card on the board looking saved.
That is now fixed (`src/lib/writes.js`, rollback in every mutation, `WriteErrorBanner`), and is
covered by `npm run test:cloud`.

Keep it that way: **any new Supabase write must return `{ ok, error, message }` and roll back
its optimistic update on failure.** A mutation that returns `undefined` cannot tell its caller
anything, and that is precisely how this became invisible.

## Rule 8 — don't let the schema and the client drift

`jobs` carries three pairs of duplicate columns — `alloc`/`allocated_to`, `cust`/`customer`,
`type`/`job_type` — bridged by a trigger. The client wrote one half and read the other. That
arrangement is fragile by construction: it puts a hidden dependency between two systems that
no test and no type checker can see.

The app now writes both halves of all three pairs, so the trigger is no longer load-bearing.
The columns should eventually be consolidated. Until then, run the Rule 6 query after any
migration.
