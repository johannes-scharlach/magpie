const path = require("path");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Required by PowerSync's watched queries, which expose results as
      // async iterators. Without this, watched queries fail at runtime.
      "@babel/plugin-transform-async-generator-functions",
      // FormatJS must use the same ID pattern as `pnpm i18n:extract`.
      // react-intl's own implementation formats dynamic descriptors, so skip
      // errors there instead of turning its source into an extraction error.
      [
        "babel-plugin-formatjs",
        {
          idInterpolationPattern: "[sha512:contenthash:base64:6]",
          throws: false,
          onMsgError(filename, error) {
            if (!filename.includes(`${path.sep}node_modules${path.sep}`)) {
              throw error;
            }
          },
        },
      ],
    ],
  };
};
