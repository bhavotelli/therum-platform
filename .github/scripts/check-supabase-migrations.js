#!/usr/bin/env node
// Enforces Supabase migration rules documented in .github/review-guidelines.md
// (see "Supabase Schema Changes"). This is a mechanical guardrail that runs on
// PRs — it treats any migration file that exists in the PR base as already
// merged to main (and therefore assumed applied in prod). It does NOT look at
// the live DB; "immutable" here means "immutable post-merge".
//   1. Existing migration files must not be modified, deleted, or renamed.
//   2. New migration files must follow the YYYYMMDDHHMMSS_description.sql naming convention.

const { execSync } = require('node:child_process');

const BASE_SHA = process.env.BASE_SHA;
const HEAD_SHA = process.env.HEAD_SHA;

if (!BASE_SHA || !HEAD_SHA) {
  console.error('BASE_SHA and HEAD_SHA must be set');
  process.exit(2);
}

const MIGRATIONS_DIR = 'supabase/migrations/';
const NAME_PATTERN = /^supabase\/migrations\/(\d{14})_[a-z0-9_]+\.sql$/;

const diff = execSync(
  `git diff --name-status ${BASE_SHA} ${HEAD_SHA} -- ${MIGRATIONS_DIR}`,
  { encoding: 'utf8' },
).trim();

if (!diff) {
  console.log('No migration changes — nothing to check.');
  process.exit(0);
}

const failures = [];

for (const line of diff.split('\n')) {
  const parts = line.split('\t');
  const status = parts[0];

  // A = added, M = modified, D = deleted, Rnnn = renamed (nnn = similarity)
  const code = status[0];

  // For renames/copies git emits: "R100\told_path\tnew_path"; for everything
  // else: "A\tpath" / "M\tpath" / "D\tpath".
  const oldPath = code === 'R' || code === 'C' ? parts[1] : null;
  const newPath = code === 'R' || code === 'C' ? parts[2] : parts[1];

  if (code === 'M') {
    failures.push(
      `BLOCKER: ${newPath} was modified. Migration files are immutable once ` +
        `merged to main — create a new migration instead.`,
    );
    continue;
  }

  if (code === 'D') {
    failures.push(
      `BLOCKER: ${newPath} was deleted. Merged migration files must not be ` +
        `removed — create a new migration that reverses the change.`,
    );
    continue;
  }

  if (code === 'R') {
    failures.push(
      `BLOCKER: ${oldPath} was renamed to ${newPath}. Merged migration ` +
        `filenames are immutable.`,
    );
    continue;
  }

  if (code === 'A') {
    if (!NAME_PATTERN.test(newPath)) {
      failures.push(
        `BLOCKER: ${newPath} does not match the required naming convention ` +
          `YYYYMMDDHHMMSS_snake_case_description.sql`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Supabase migration check failed:\n');
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    '\nSee .github/review-guidelines.md → "Supabase Schema Changes".',
  );
  process.exit(1);
}

console.log('Supabase migration check passed.');
