#!/usr/bin/env node
// Enforces Supabase migration rules documented in .github/review-guidelines.md
// (see "Supabase Schema Changes"):
//   1. Existing migration files must not be modified — they are immutable once applied.
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
  const [status, ...pathParts] = line.split('\t');
  const path = pathParts[pathParts.length - 1];

  // A = added, M = modified, D = deleted, R = renamed
  const code = status[0];

  if (code === 'M') {
    failures.push(
      `BLOCKER: ${path} was modified. Applied migrations are immutable — ` +
        `create a new migration instead.`,
    );
    continue;
  }

  if (code === 'D') {
    failures.push(
      `BLOCKER: ${path} was deleted. Applied migrations must not be removed — ` +
        `create a new migration that reverses the change.`,
    );
    continue;
  }

  if (code === 'R') {
    failures.push(
      `BLOCKER: ${path} was renamed. Migration filenames are immutable once applied.`,
    );
    continue;
  }

  if (code === 'A') {
    if (!NAME_PATTERN.test(path)) {
      failures.push(
        `BLOCKER: ${path} does not match the required naming convention ` +
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
