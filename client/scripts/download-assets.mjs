import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const assets = [
  {
    name: "kenney_ui.png",
    url: "https://opengameart.org/sites/default/files/GUI%20Pack_0.png",
  },
  {
    name: "kenney_topdown.png",
    url: "https://opengameart.org/sites/default/files/topdown_shooter_pack.png",
  },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "..", "public", "assets");

await mkdir(outDir, { recursive: true });

for (const asset of assets) {
  try {
    const res = await fetch(asset.url);
    if (!res.ok) {
      console.warn(`Failed to download ${asset.url}`);
      continue;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(outDir, asset.name), buffer);
    console.log(`Downloaded ${asset.name}`);
  } catch (error) {
    console.warn(`Error downloading ${asset.url}`, error);
  }
}
