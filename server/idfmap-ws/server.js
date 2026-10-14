'use strict';
// Hosting panels commonly require this exact entry-point filename.
const backend = require('./server.cjs');
if (require.main === module) backend.start();
module.exports = backend;
