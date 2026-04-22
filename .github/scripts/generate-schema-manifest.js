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

// Bracket-counted: matches up to the opening `{`, then we scan forward to
// find the matching close brace. Naïve `[^}]+` fails on any nested object
// type (e.g. `metadata: { foo: string }`); all current Row types are flat
// but future additions shouldn't silently break the manifest.
const ROW_TYPE_OPEN_RE = /export\s+type\s+(\w+)Row\s*=\s*\{/g

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

  for (const match of typesFileContent.matchAll(ROW_TYPE_OPEN_RE)) {
    const tableName = match[1]
    const openIdx = match.index + match[0].length

    // Walk the characters from the opening `{`, tracking brace depth and
    // buffering the current line. When we're at depth 1 and hit a newline,
    // that's a top-level property line and we extract its identifier.
    // Lines at depth > 1 are inside a nested object literal and are ignored
    // so e.g. `metadata: { foo: string }` doesn't leak `foo` into the table.
    // Also strips `//` and `/* */` comments.
    const columns = []
    let depth = 1
    let i = openIdx
    let lineBuf = ''

    const flushLine = () => {
      // Strip `//` line comments first so anything after them (including a
      // rogue `/* */` token embedded in the comment) is gone before block
      // comments are matched. Then strip block comments from what remains.
      const clean = lineBuf
        .replace(/\/\/.*$/, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim()
      lineBuf = ''
      if (!clean) return
      const colon = clean.indexOf(':')
      if (colon === -1) return
      const name = clean.slice(0, colon).trim()
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) columns.push(name)
    }

    while (i < typesFileContent.length && depth > 0) {
      const ch = typesFileContent[i]
      if (ch === '{') {
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0) break
      } else if (ch === '\n' && depth === 1) {
        flushLine()
      } else if (depth === 1) {
        lineBuf += ch
      }
      i++
    }
    if (depth !== 0) continue // unbalanced — skip defensively
    flushLine() // anything left on the final line before `}`

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
