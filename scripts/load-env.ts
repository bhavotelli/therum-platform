/**
 * Load repo-root `.env` before other imports (tsx hoists imports; cwd may not be the repo root).
 */
import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(rootDir, '.env') })
