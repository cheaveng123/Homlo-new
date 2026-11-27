module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["module:@react-native/babel-preset", "nativewind/babel"],
    plugins: [
      // React Compiler must run first; the worklets plugin must stay last.
      "babel-plugin-react-compiler",
      // Inlines process.env.PUBLIC_* from .env (see babel/public-env.js).
      "./babel/public-env.js",
      "react-native-worklets/plugin",
    ],
  };
};
