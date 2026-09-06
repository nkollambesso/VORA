/**
 * Metro Configuration for VORA — Expo SDK 51 + React Native Web
 *
 * This config handles the fundamental incompatibility between react-native 0.74
 * (which ships no .web.js variants for many internal modules) and Metro's web
 * bundler. It does three things:
 *
 * 1. Prioritises .web.* file extensions so per-platform overrides always win.
 * 2. Defines explicit `extraNodeModules` aliases that redirect react-native
 *    internals to their react-native-web (or safe stub) equivalents on web.
 * 3. Adds a custom `resolveRequest` fallback so any *new* unresolved internal
 *    react-native path on web silently falls back to the generic stub instead
 *    of crashing the whole bundle. This means we will NEVER see
 *    "Unable to resolve X from react-native/Libraries/..." again.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─── 1. Explicit aliases: react-native internals → react-native-web ───────────
//   Key   = import path that react-native 0.74 ships without a .web.js variant
//   Value = the react-native-web module that provides the same API on web
const rnWeb = (p) => {
  const full = path.resolve(__dirname, 'node_modules', 'react-native-web', p);
  return full.endsWith('.js') ? full : `${full}.js`;
};

const WEB_MODULE_MAP = {
  // StyleSheet / color
  'react-native/Libraries/StyleSheet/PlatformColorValueTypes':
    rnWeb('dist/exports/StyleSheet/index'),
  'react-native/Libraries/StyleSheet/processColor':
    rnWeb('dist/exports/processColor/index'),
  'react-native/Libraries/StyleSheet/PlatformColorValueTypesIOS':
    rnWeb('dist/exports/StyleSheet/index'),

  // Utilities
  'react-native/Libraries/Utilities/Platform':
    rnWeb('dist/exports/Platform/index'),
  'react-native/Libraries/Utilities/PixelRatio':
    rnWeb('dist/exports/PixelRatio/index'),
  'react-native/Libraries/Utilities/Dimensions':
    rnWeb('dist/exports/Dimensions/index'),

  // Components
  'react-native/Libraries/Components/TextInput/TextInputState':
    rnWeb('dist/exports/TextInput/index'),
  'react-native/Libraries/Components/View/ViewNativeComponent':
    rnWeb('dist/exports/View/index'),
  'react-native/Libraries/Alert/Alert':
    rnWeb('dist/exports/Alert/index'),
  'react-native/Libraries/Alert/RCTAlertManager':
    path.resolve(__dirname, 'lib/shims/empty.js'),

  // Core / bridge / NativeModules
  'react-native/Libraries/Core/setUpBatchedBridge':
    path.resolve(__dirname, 'lib/shims/empty.js'),
  'react-native/Libraries/NativeComponent/BaseViewConfig':
    path.resolve(__dirname, 'lib/shims/empty.js'),
  'react-native/Libraries/Utilities/LoadingView':
    path.resolve(__dirname, 'lib/shims/empty.js'),

  // Text
  'react-native/Libraries/Text/Text':
    rnWeb('dist/exports/Text/index'),
  'react-native/Libraries/Text/TextNativeComponent':
    rnWeb('dist/exports/Text/index'),

  // Image
  'react-native/Libraries/Image/Image':
    rnWeb('dist/exports/Image/index'),

  // Accessibility
  'react-native/Libraries/Components/AccessibilityInfo/legacySendAccessibilityEvent':
    path.resolve(__dirname, 'lib/shims/empty.js'),
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo':
    rnWeb('dist/exports/AccessibilityInfo/index.js'),
};

// ─── 3. Fallback resolveRequest ───────────────────────────────────────────────
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Apply explicit alias map first (covers the known problematic paths)
  if (platform === 'web' && WEB_MODULE_MAP[moduleName]) {
    return { filePath: WEB_MODULE_MAP[moduleName], type: 'sourceFile' };
  }

  // Try default resolution (honours .web.js extensions from sourceExts above)
  const resolver = originalResolveRequest || context.resolveRequest;
  try {
    return resolver(context, moduleName, platform);
  } catch (err) {
    // If on web and a react-native internal module can't be resolved
    // (whether requested as 'react-native/Libraries/...' or as relative '../...' from inside react-native),
    // silently fall back to an empty stub rather than crashing the bundle.
    if (
      platform === 'web' &&
      (moduleName.startsWith('react-native/') ||
        moduleName.startsWith('react-native\\') ||
        (context.originModulePath &&
          (context.originModulePath.includes('react-native\\') ||
            context.originModulePath.includes('react-native/'))))
    ) {
      console.warn(
        `[metro-web-shim] Unresolved RN internal on web, stubbing: ${moduleName} (from ${context.originModulePath})`
      );
      return {
        filePath: path.resolve(__dirname, 'lib/shims/empty.js'),
        type: 'sourceFile',
      };
    }
    throw err;
  }
};

// ─── 4. Fix Windows backslash URL encoding issue (%5C → /) ──────────────────
const existingEnhanceMiddleware = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    if (existingEnhanceMiddleware) {
      middleware = existingEnhanceMiddleware(middleware, server);
    }
    return (req, res, next) => {
      if (req.url && (req.url.includes('%5C') || req.url.includes('\\'))) {
        req.url = req.url.replace(/%5C/g, '/').replace(/\\/g, '/');
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
