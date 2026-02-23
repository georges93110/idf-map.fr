import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "map_files", "dbus_fis");
const OUTPUT = path.join(process.cwd(), "map_files", "dbus_fis_index.json");

function exists(p){
  try { fs.accessSync(p); return true; }
  catch { return false; }
}

function buildTree(dir){
  if (!exists(dir)) return {};

  const result = {};
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries){
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()){
      result[entry.name] = buildTree(full);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".mp3")){
      files.push(entry.name.replace(/\.mp3$/i,""));
    }
  }

  files.sort((a,b)=>a.localeCompare(b));
  if (files.length) result._files = files;

  return result;
}

const tree = buildTree(ROOT);

fs.writeFileSync(
  OUTPUT,
  JSON.stringify(tree, null, 2),
  "utf8"
);

console.log("dbus_fis_index.json generated.");