/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

// https://github.com/thysultan/stylis/issues/233
const defaultSourceExts =
  require('metro-config/src/defaults/defaults').sourceExts;

module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    sourceExts: process.env.RN_SRC_EXT
      ? [
          ...process.env.RN_SRC_EXT.split(',').concat(defaultSourceExts),
          'cjs',
          'mjs',
        ] // <-- cjs added here
      : [...defaultSourceExts, 'cjs', 'mjs'], // <-- cjs added here
  },
};
