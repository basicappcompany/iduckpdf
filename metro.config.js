// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pdf-lib depends on tslib. Under Metro's package-exports handling, tslib's ESM wrapper
// loses its default export and the app crashes at startup ("Cannot destructure property
// '__extends'"). Pin it to the plain CommonJS build.
const path = require('path');
const tslibCjs = path.join(__dirname, 'node_modules', 'tslib', 'tslib.js');
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') return { type: 'sourceFile', filePath: tslibCjs };
  return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
