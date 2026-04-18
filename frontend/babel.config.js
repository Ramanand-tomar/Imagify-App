module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "react" }]],
    // Reanimated 4 (SDK 54) moved worklet transformation into react-native-worklets.
    // The old "react-native-reanimated/plugin" still exists as a thin shim that
    // requires the worklets plugin, but pointing to it directly is cleaner.
    // Must be the LAST plugin in the list.
    plugins: ["react-native-worklets/plugin"],
  };
};
