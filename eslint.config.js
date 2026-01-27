import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      
      // Security-focused rules (using built-in ESLint rules)
      "no-eval": "error",
      "no-implied-eval": "error", 
      "no-new-func": "error",
      "no-script-url": "error",
      "no-alert": "warn",
      "no-console": "off", // Allow console for debugging, filter in production
    },
  }
);

/**
 * Security Enhancement Recommendations:
 * 
 * For enhanced security linting, consider adding eslint-plugin-security:
 * 
 * 1. Install the plugin:
 *    npm install --save-dev eslint-plugin-security
 * 
 * 2. Add to the plugins section:
 *    "security": security,
 * 
 * 3. Add to extends:
 *    "plugin:security/recommended"
 * 
 * 4. Additional security rules you might want to enable:
 *    "security/detect-object-injection": "warn",
 *    "security/detect-non-literal-regexp": "warn", 
 *    "security/detect-unsafe-regex": "error",
 *    "security/detect-buffer-noassert": "error",
 *    "security/detect-child-process": "warn",
 *    "security/detect-disable-mustache-escape": "error",
 *    "security/detect-eval-with-expression": "error",
 *    "security/detect-no-csrf-before-method-override": "error",
 *    "security/detect-non-literal-fs-filename": "warn",
 *    "security/detect-non-literal-require": "warn",
 *    "security/detect-possible-timing-attacks": "warn",
 *    "security/detect-pseudoRandomBytes": "error"
 * 
 * These rules help catch common security anti-patterns but may require
 * code adjustments. Enable them gradually and test thoroughly.
 */
