const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const { resolver } = config;

config.resolver = {
  ...resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (platform === "web" || !platform) {
      if (moduleName === "react-native" || moduleName.startsWith("react-native/")) {
        return context.resolveRequest(context, "react-native-web", platform);
      }
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
