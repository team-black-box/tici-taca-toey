const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// The protocol model, TTN codec, and error copy live in ../shared - one
// copy for every module in the repo. Metro only watches the project root
// by default, so the shared folder is added explicitly.
const config = {
  watchFolders: [path.resolve(__dirname, '..', 'shared')],
  resolver: {
    // Files in ../shared resolve their helpers from this app's modules.
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
