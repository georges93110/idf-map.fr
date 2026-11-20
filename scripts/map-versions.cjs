'use strict';
const fs = require('node:fs');
const path = require('node:path');

function mapVersions(root) {
  return fs.readdirSync(root, {withFileTypes:true})
    .filter(entry => entry.isDirectory() && /^\d+\.\d+\.\d+$/.test(entry.name))
    .filter(entry => fs.existsSync(path.join(root, entry.name, 'TileMapInfo.json')))
    .map(entry => entry.name)
    .sort((a,b) => b.localeCompare(a, 'en', {numeric:true}));
}
module.exports = mapVersions;
if (require.main === module) {
  const versions = mapVersions(path.join(__dirname, '..', 'map_files'));
  if (!versions.length) throw new Error('No versioned map directory contains TileMapInfo.json');
  process.stdout.write(JSON.stringify(versions, null, 2) + '\n');
}
