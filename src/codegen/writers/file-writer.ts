import fs from 'fs-extra';
import path from 'path';
import prettier from 'prettier';
import type { FileMap } from '../../types/openapi.ts';

const PRETTIER_CONFIG: prettier.Options = {
  parser: 'typescript',
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
};

/**
 * Writes a FileMap to disk, formatting each file with Prettier.
 *
 * Edge case: files listed in `neverOverwrite` are skipped if they already
 * exist on disk — protecting user-owned config files from regeneration.
 */
export async function writeFiles(
  outDir: string,
  files: FileMap,
  neverOverwrite: string[] = [],
): Promise<{ written: string[]; skipped: string[] }> {
  await fs.ensureDir(outDir);

  const written: string[] = [];
  const skipped: string[] = [];

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(outDir, filePath);

    if (neverOverwrite.includes(filePath)) {
      const exists = await fs.pathExists(fullPath);
      if (exists) {
        skipped.push(fullPath);
        continue;
      }
    }

    await fs.ensureDir(path.dirname(fullPath));
    const formatted = await formatSafe(content, fullPath);
    await fs.writeFile(fullPath, formatted, 'utf-8');
    written.push(fullPath);
  }

  return { written, skipped };
}

async function formatSafe(content: string, filePath: string): Promise<string> {
  try {
    return await prettier.format(content, PRETTIER_CONFIG);
  } catch {
    // If Prettier fails (e.g. generated code has a syntax error), write raw
    // so the developer can see what went wrong instead of a silent failure
    console.warn(`⚠️  Prettier failed for ${filePath} — writing unformatted.`);
    return content;
  }
}