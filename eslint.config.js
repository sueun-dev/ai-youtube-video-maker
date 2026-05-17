import globals from "globals";

const sharedRules = {
  "no-console": "off",
  "no-debugger": "error",
  "no-redeclare": "error",
  "no-undef": "error",
  "no-unused-vars": [
    "warn",
    {
      argsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    },
  ],
};

export default [
  {
    ignores: ["node_modules/**", ".cache/**", "voice-samples/**", "dist/**", "coverage/**"],
  },
  {
    files: ["app.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.es2024,
        webkitAudioContext: "readonly",
      },
    },
    rules: sharedRules,
  },
  {
    files: ["server.js", "scripts/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        fetch: "readonly",
        URL: "readonly",
      },
    },
    rules: sharedRules,
  },
];
