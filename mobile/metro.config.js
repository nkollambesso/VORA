const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [
  "web.tsx",
  "web.ts",
  "web.jsx",
  "web.js",
  "tsx",
  "ts",
  "jsx",
  "js",
  "json",
  "cjs",
  "mjs",
];

config.resolver.platforms = ["web", "ios", "android"];

module.exports = config;
