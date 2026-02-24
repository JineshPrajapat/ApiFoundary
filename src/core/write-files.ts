import fs from 'fs-extra';
import path from 'path';
import prettier from 'prettier';

export async function writeFiles(outputDir: string, files: Record<string, string>) {
  await fs.ensureDir(outputDir);

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(outputDir, filePath);
    await fs.ensureDir(path.dirname(fullPath));

    const formattedContent = await prettier.format(content, {
      parser: 'typescript',
      singleQuote: true,
      trailingComma: 'all',
      printWidth: 100,
    });

    await fs.writeFile(fullPath, formattedContent);
  }
}
