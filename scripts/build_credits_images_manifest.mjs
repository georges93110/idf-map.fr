import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CREDITS_IMAGES_DIR = path.join(ROOT, "images", "credits");
const OUTPUT_JS = path.join(ROOT, "config", "credits-images.manifest.js");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function isImageFile(fileName) {
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(String(fileName || ""));
}

function byNaturalName(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
}

function buildManifest() {
  const out = {};
  if (!exists(CREDITS_IMAGES_DIR)) return out;

  const dirs = fs.readdirSync(CREDITS_IMAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(byNaturalName);

  dirs.forEach((folderName) => {
    const idMatch = String(folderName).match(/^(\d{6,})/);
    if (!idMatch) return;
    const userId = idMatch[1];
    const folderPath = path.join(CREDITS_IMAGES_DIR, folderName);
    const fileNames = fs.readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    const files = fileNames
      .filter((name) => isImageFile(name))
      .sort(byNaturalName);
    const hasEndMarker = fileNames.some((name) => String(name || "").trim().toLowerCase() === "fin");
    out[userId] = {
      folder: folderName,
      files,
      hasEndMarker
    };
  });

  return out;
}

const manifest = buildManifest();
const fileContent = `window.CREDITS_IMAGES_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`;
fs.writeFileSync(OUTPUT_JS, fileContent, "utf8");
console.log("credits-images.manifest.js generated.");
