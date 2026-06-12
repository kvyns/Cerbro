// Global color palette - matches tailwind config
export const colors = {
  // Primary palette
  ink: "#0d1b2a",
  steel: "#1b263b",
  fog: "#e0e1dd",
  amber: "#f4a261",
  mint: "#2a9d8f",
  danger: "#c1121f",
  
  // Utility colors with opacity
  inkRgb: "13, 27, 42",
  steelRgb: "27, 38, 59",
  fogRgb: "224, 225, 221",
  amberRgb: "244, 162, 97",
  mintRgb: "42, 157, 143",
  dangerRgb: "193, 18, 31",

  // Dark mode specific colors with proper contrast (HIGH CONTRAST)
  darkBg: "#0a0f18", // Very dark background
  darkBgAlt: "#192230", // Lighter surface (much more contrast)
  darkCard: "#1e2a3a", // Card/container backgrounds
  darkText: "#ffffff", // Pure white text
  darkTextSecondary: "#e0e0e0", // Almost white secondary
  darkTextMuted: "#a0a0a0", // Muted text (medium gray)
};

// Color scales optimized for both light and dark modes
export const colorScale = {
  light: {
    background: colors.fog,
    surface: "#ffffff",
    textPrimary: colors.ink,
    textSecondary: colors.steel,
    textMuted: "#666666",
    border: colors.steel,
  },
  dark: {
    background: colors.darkBg,
    surface: colors.darkCard,
    textPrimary: colors.darkText,
    textSecondary: colors.darkTextSecondary,
    textMuted: colors.darkTextMuted,
    border: "#3a4f68",
  },
};

// Semantic color mapping
export const semanticColors = {
  success: colors.mint,
  warning: colors.amber,
  error: colors.danger,
  info: "#4a90e2",
};

// Shadow definitions with dark mode variant
export const shadows = {
  soft: "0 20px 45px rgba(13, 27, 42, 0.14)",
  softDark: "0 20px 45px rgba(0, 0, 0, 0.5)",
};
