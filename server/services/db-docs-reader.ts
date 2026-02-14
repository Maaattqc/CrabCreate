import fs from 'fs';
import path from 'path';
import config from '../config';

/**
 * Reads all files in the db-docs/ directory and returns concatenated content.
 * Used to inject SQL Server schema context into AI prompts.
 */
function readAllDbDocs(): string {
  const docsPath = config.dbDocsPath;

  if (!fs.existsSync(docsPath)) {
    console.warn(`[DbDocs] Directory not found: ${docsPath}`);
    return '';
  }

  const parts: string[] = [];

  const resolvedBase = path.resolve(docsPath);

  function readDir(dirPath: string): void {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip symlinks and paths outside base directory
      if (entry.isSymbolicLink()) continue;
      const resolved = path.resolve(fullPath);
      if (!resolved.startsWith(resolvedBase)) continue;

      if (entry.isDirectory()) {
        readDir(fullPath);
      } else {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const relativePath = path.relative(docsPath, fullPath);
          parts.push(`--- ${relativePath} ---\n${content}\n--- end ---`);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[DbDocs] Error reading ${fullPath}:`, message);
        }
      }
    }
  }

  readDir(docsPath);
  return parts.join('\n\n');
}

export { readAllDbDocs };
