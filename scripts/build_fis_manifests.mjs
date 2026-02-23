// scripts/build_fis_manifests.mjs
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "map_files", "dbus_fis"); // adapte si besoin
const INDEX_NAME = "index.json";

async function isDir(p) {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function listDirEntries(dirAbs) {
  const names = await fs.readdir(dirAbs);
  const out = [];

  for (const name of names) {
    if (!name || name === INDEX_NAME) continue;
    const abs = path.join(dirAbs, name);
    let st;
    try {
      st = await fs.stat(abs);
    } catch {
      continue;
    }
    out.push({
      name,
      isDirectory: st.isDirectory(),
    });
  }

  // tri stable et lisible (dossiers d’abord, puis alpha)
  out.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, "fr", { numeric: true, sensitivity: "base" });
  });

  return out;
}

async function buildIndexRecursive(dirAbs) {
  const entries = await listDirEntries(dirAbs);

  const index = { entries };
  await fs.writeFile(path.join(dirAbs, INDEX_NAME), JSON.stringify(index, null, 2), "utf8");

  // recurse
  for (const e of entries) {
    if (!e.isDirectory) continue;
    await buildIndexRecursive(path.join(dirAbs, e.name));
  }
}

async function main() {
  if (!(await isDir(ROOT))) {
    console.error(`[build_fis_manifests] Dossier introuvable: ${ROOT}`);
    process.exitCode = 1;
    return;
  }
  await buildIndexRecursive(ROOT);
  console.log(`[build_fis_manifests] OK: index.json générés sous ${ROOT}`);
}

main().catch((e) => {
  console.error("[build_fis_manifests] Erreur:", e);
  process.exitCode = 1;
});