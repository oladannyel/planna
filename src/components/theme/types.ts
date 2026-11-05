/** User-selectable theme. `system` follows the OS preference. */
export type ThemePreference = "light" | "dark" | "system";

/** The theme actually applied to the document — `system` is resolved away. */
export type ResolvedTheme = "light" | "dark";

/** localStorage key holding the preference. Shared with the no-flash script. */
export const THEME_STORAGE_KEY = "planna-theme";

/** plAnna is a dark-first product, so dark is the default. */
export const DEFAULT_THEME: ThemePreference = "dark";
