import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const assetsDir = join(process.cwd(), 'public', 'assets');

async function run() {
  await mkdir(assetsDir, { recursive: true });
  const placeholder = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%234fd1ff'/></svg>`;
  await writeFile(join(assetsDir, 'placeholder.svg'), placeholder);
  console.log('Placeholder assets ready. Add Kenney downloads to /client/public/assets.');
}

run();
