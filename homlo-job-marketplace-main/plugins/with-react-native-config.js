const { withAppBuildGradle } = require("@expo/config-plugins");

const APPLY_LINE =
  "apply from: project(':react-native-config').projectDir.getPath() + \"/dotenv.gradle\"";

module.exports = function withReactNativeConfig(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      return gradleConfig;
    }

    let contents = gradleConfig.modResults.contents;

    if (!contents.includes(APPLY_LINE)) {
      const applicationPlugin =
        /apply plugin: ["']com\.android\.application["']\n/;

      if (applicationPlugin.test(contents)) {
        contents = contents.replace(
          applicationPlugin,
          (match) => `${match}\n${APPLY_LINE}\n`,
        );
      } else {
        contents = `${APPLY_LINE}\n${contents}`;
      }

      gradleConfig.modResults.contents = contents;
    }

    return gradleConfig;
  });
};
