/**
 * Universal web stub for react-native internal modules that have no web equivalent.
 * Metro resolveRequest falls back to this file when it cannot resolve a
 * react-native/Libraries/... import on the web platform.
 *
 * Exports both default and named exports so any `import X from Y` or
 * `import { X } from Y` pattern gets something falsy rather than crashing.
 */
'use strict';

// Provide a Proxy as default so any property access / call returns undefined
// instead of throwing a "Cannot read property of undefined" error.
const stub = new Proxy(
  function () {},
  {
    get: () => stub,
    apply: () => undefined,
    construct: () => ({}),
  }
);

module.exports = stub;
module.exports.default = stub;

// Named exports – add more if a specific named export is needed
module.exports.PlatformColor = () => null;
module.exports.normalizeColorObject = () => null;
module.exports.processColorObject = (c) => c;
