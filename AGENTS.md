<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Supabase schema changes — stop and surface the SQL

The Supabase schema is applied via the Supabase SQL editor, not CI. If a task requires a schema change — new/renamed/dropped table or column, new enum value, new or altered RLS policy, new index, new trigger, or a new/altered Postgres function — do NOT write application code that depends on the change until the SQL has been applied.

Instead:

1. Stop before writing the dependent code.
2. Print the exact SQL the user needs to paste into the Supabase SQL editor, as a fenced ```sql block. Name the target project (prod vs. staging) if relevant. Include RLS policies for any new table with agency data — see `.github/review-guidelines.md` for the required pattern.
3. Also create a matching file in `supabase/migrations/` following the `YYYYMMDDHHMMSS_snake_case_description.sql` convention, containing the same SQL. This captures the forward-facing delta in git even though the baseline isn't source-controlled.
4. Do not write any code that depends on the schema change until the user replies with an explicit confirmation that the SQL has been applied. Do not infer confirmation from a topic change, a thumbs-up on a different item, or your own reasoning that "it probably ran fine." If the user's next message is ambiguous, ask.
5. When the PR is opened, include the applied SQL in the PR description for auditability.

Never edit or delete an existing file in `supabase/migrations/` — applied migrations are immutable. CI enforces this.
