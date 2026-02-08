const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const metroResolver = require("metro-resolver");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const aliasMap = {
  "rpc-websockets": path.resolve(
    projectRoot,
    "..",
    "..",
    "node_modules",
    "rpc-websockets",
    "dist",
    "index.browser.cjs",
  ),
  "@noble/hashes/crypto": path.resolve(
    projectRoot,
    "..",
    "..",
    "node_modules",
    "@noble",
    "hashes",
    "crypto.js",
  ),
  "@noble/hashes/crypto.js": path.resolve(
    projectRoot,
    "..",
    "..",
    "node_modules",
    "@noble",
    "hashes",
    "crypto.js",
  ),
};

const previousResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const normalizedModuleName =
    moduleName === "@noble/hashes/crypto.js"
      ? "@noble/hashes/crypto"
      : moduleName;

  const aliasPath = aliasMap[normalizedModuleName];
  if (aliasPath) {
    return {
      type: "sourceFile",
      filePath: aliasPath,
    };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return metroResolver.resolve(context, moduleName, platform);
};

module.exports = config;
