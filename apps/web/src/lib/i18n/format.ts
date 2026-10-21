/**
 * i18n String Formatting Utilities
 *
 * Provides lightweight variable interpolation:
 *   format("Hello, {name}!", { name: "World" }) → "Hello, World!"
 *
 * Supports:
 *  - Simple variable substitution: {key}
 *  - Plural forms via {count}: use `_one` / `_other` dictionary keys
 */

/**
 * Replace `{key}` placeholders in a template string with values from `vars`.
 * Unknown keys are left as-is.
 */
export function format(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(
    /\{(\w+)\}/g,
    (match, key: string) => (key in vars ? String(vars[key]) : match),
  );
}

/**
 * Simple pluralisation helper.
 * Picks `key + "_one"` when count === 1, otherwise `key + "_other"`.
 * Falls back to the base key if neither variant exists.
 *
 * @example
 *   pluralKey("card", 1)  → "card_one"
 *   pluralKey("card", 5)  → "card_other"
 */
export function pluralKey(base: string, count: number): string {
  return `${base}_${count === 1 ? "one" : "other"}`;
}
