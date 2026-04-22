/**
 * Generate a compact schema manifest from `src/types/database.ts`.
 *
 * The review workflow (`review-pr.js`) injects this manifest into the system
 * prompt so the reviewer has an accurate, always-in-sync view of the current
 * schema — no more false-positive "column X doesn't exist" blockers when the
 * column was added in a prior merged PR.
 *
 * Source of truth: every `export type XxxRow = { ... }` block in
 * `src/types/database.ts`. These mirror the Postgres tables under `public.`
 * — keeping both in sync is a code-review concern, not something this script
 * tries to verify.
 *
 * Exported so it can be unit-tested in isolation; review-pr.js calls it at
 * startup.
 */

const ROW_TYPE_RE = /export\s+type\s+(\w+)Row\s*=\s*\{([^}]+)\}/gs

/**
 * Parse `src/types/database.ts` content and return a plain-text manifest.
 *
 * Output format (one table per line):
 *   Agency: id, name, slug, active, planTier, xeroTenantId, ...
 *   Client: id, agencyId, name, paymentTermsDays, ...
 *
 * @param {string} typesFileContent — raw contents of types/database.ts
 * @returns {string} — newline-separated table:columns manifest
 */
export function generateSchemaManifest(typesFileContent) {
  const tables = []

  for (const match of typesFileContent.matchAll(ROW_TYPE_RE)) {
    const tableName = match[1]
    const body = match[2]

    // Strip comments and extract property names. Each property line looks like:
    //   id: string
    //   name: string
    //   someJson: Json | null
    // Grab the identifier before the colon, one per non-blank, non-comment line.
    const columns = body
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter((line) => line.length > 0 && !line.startsWith('/*') && !line.startsWith('*'))
      .map((line) => {
        const colonIdx = line.indexOf(':')
        if (colonIdx === -1) return null
        return line.slice(0, colonIdx).trim()
      })
      .filter((name) => name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))

    if (columns.length > 0) {
      tables.push(`${tableName}: ${columns.join(', ')}`)
    }
  }

  return tables.join('\n')
}

/**
 * Convenience wrapper: read types file from disk relative to the repo root
 * and return the manifest. Used by review-pr.js.
 */
export function readSchemaManifest(readFileSync, join, repoRoot) {
  const typesPath = join(repoRoot, 'src', 'types', 'database.ts')
  const content = readFileSync(typesPath, 'utf8')
  return generateSchemaManifest(content)
}
