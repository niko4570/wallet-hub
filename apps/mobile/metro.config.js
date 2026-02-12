const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const metroResolver = require("metro-resolver");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");
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

// Force Metro to resolve modules from a single location to avoid duplicate instances.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@react-native/virtualized-lists": path.resolve(
    projectRoot,
    "node_modules",
    "@react-native",
    "virtualized-lists",
  ),
};

module.exports = config;
