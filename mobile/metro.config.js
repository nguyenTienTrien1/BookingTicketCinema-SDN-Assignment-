const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
// Mobile has separate dependencies, but shares the seat rules with web/backend.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../shared')];
module.exports = config;
