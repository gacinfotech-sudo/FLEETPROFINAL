import { EventEmitter } from "events";

interface BrandTheme {
  tenantId: string;
  name: string;
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    secondaryDark: string;
    accent: string;
    background: string;
    surface: string;
    error: string;
    success: string;
    warning: string;
  };
  fonts: {
    family: string;
    headingFamily?: string;
    bodyFamily?: string;
  };
  assets: {
    logoUrl?: string;
    faviconUrl?: string;
    splashScreenUrl?: string;
    appName?: string;
    appDescription?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface BrandingPreferences {
  tenantId: string;
  theme: "light" | "dark" | "auto";
  primaryColor: string;
  accentColor: string;
  customFont: boolean;
  enableAnimations: boolean;
}

export class BrandingManager extends EventEmitter {
  private themes: Map<string, BrandTheme> = new Map();
  private preferences: Map<string, BrandingPreferences> = new Map();

  /**
   * Create a new brand theme for a tenant
   */
  createTheme(theme: BrandTheme): void {
    this.themes.set(theme.tenantId, theme);
    this.emit("theme-created", theme);
    console.log(`Theme created for tenant: ${theme.tenantId}`);
  }

  /**
   * Get brand theme for tenant
   */
  getTheme(tenantId: string): BrandTheme | undefined {
    return this.themes.get(tenantId);
  }

  /**
   * Update brand theme
   */
  updateTheme(tenantId: string, updates: Partial<BrandTheme>): void {
    const theme = this.themes.get(tenantId);
    if (!theme) throw new Error("Theme not found");

    const updated = { ...theme, ...updates, updatedAt: new Date() };
    this.themes.set(tenantId, updated);
    this.emit("theme-updated", updated);
  }

  /**
   * Update primary color
   */
  setPrimaryColor(tenantId: string, color: string): void {
    const theme = this.themes.get(tenantId);
    if (!theme) throw new Error("Theme not found");

    theme.colors.primary = color;
    theme.updatedAt = new Date();
    this.emit("color-changed", { tenantId, type: "primary", color });
  }

  /**
   * Update secondary color
   */
  setSecondaryColor(tenantId: string, color: string): void {
    const theme = this.themes.get(tenantId);
    if (!theme) throw new Error("Theme not found");

    theme.colors.secondary = color;
    theme.updatedAt = new Date();
    this.emit("color-changed", { tenantId, type: "secondary", color });
  }

  /**
   * Update accent color
   */
  setAccentColor(tenantId: string, color: string): void {
    const theme = this.themes.get(tenantId);
    if (!theme) throw new Error("Theme not found");

    theme.colors.accent = color;
    theme.updatedAt = new Date();
    this.emit("color-changed", { tenantId, type: "accent", color });
  }

  /**
   * Set custom font family
   */
  setFontFamily(tenantId: string, family: string, type: "heading" | "body" | "all" = "all"): void {
    const theme = this.themes.get(tenantId);
    if (!theme) throw new Error("Theme not found");

    if (type === "heading" || type === "all") {
      theme.fonts.headingFamily = family;
    }
    if (type === "body" || type === "all") {
      theme.fonts.bodyFamily = family;
    }
    if (type === "all") {
      theme.fonts.family = family;
    }

    theme.updatedAt = new Date();
    this.emit("font-changed", { tenantId, family, type });
  }

  /**
   * Update app branding assets
   */
  setAssets(
    tenantId: string,
    assets: Partial<BrandTheme["assets"]>
  ): void {
    const theme = this.themes.get(tenantId);
    if (!theme) throw new Error("Theme not found");

    theme.assets = { ...theme.assets, ...assets };
    theme.updatedAt = new Date();
    this.emit("assets-updated", { tenantId, assets });
  }

  /**
   * Set app name
   */
  setAppName(tenantId: string, name: string): void {
    const theme = this.themes.get(tenantId);
    if (!theme) throw new Error("Theme not found");

    theme.assets.appName = name;
    theme.updatedAt = new Date();
    this.emit("app-name-changed", { tenantId, name });
  }

  /**
   * Set logo URL
   */
  setLogoUrl(tenantId: string, url: string): void {
    const theme = this.themes.get(tenantId);
    if (!theme) throw new Error("Theme not found");

    theme.assets.logoUrl = url;
    theme.updatedAt = new Date();
    this.emit("logo-changed", { tenantId, url });
  }

  /**
   * Generate CSS variables for theme
   */
  generateThemeCss(tenantId: string): string {
    const theme = this.themes.get(tenantId);
    if (!theme) throw new Error("Theme not found");

    const css = `
:root {
  --color-primary: ${theme.colors.primary};
  --color-primary-dark: ${theme.colors.primaryDark};
  --color-secondary: ${theme.colors.secondary};
  --color-secondary-dark: ${theme.colors.secondaryDark};
  --color-accent: ${theme.colors.accent};
  --color-background: ${theme.colors.background};
  --color-surface: ${theme.colors.surface};
  --color-error: ${theme.colors.error};
  --color-success: ${theme.colors.success};
  --color-warning: ${theme.colors.warning};
  --font-family: ${theme.fonts.family || "system-ui, -apple-system, sans-serif"};
  --font-heading: ${theme.fonts.headingFamily || theme.fonts.family || "system-ui, -apple-system, sans-serif"};
  --font-body: ${theme.fonts.bodyFamily || theme.fonts.family || "system-ui, -apple-system, sans-serif"};
}
    `.trim();

    return css;
  }

  /**
   * Export theme as JSON
   */
  exportTheme(tenantId: string): string {
    const theme = this.themes.get(tenantId);
    if (!theme) throw new Error("Theme not found");

    return JSON.stringify(theme, null, 2);
  }

  /**
   * Import theme from JSON
   */
  importTheme(tenantId: string, json: string): void {
    try {
      const theme = JSON.parse(json);
      theme.tenantId = tenantId;
      theme.createdAt = new Date(theme.createdAt);
      theme.updatedAt = new Date();
      this.themes.set(tenantId, theme);
      this.emit("theme-imported", theme);
    } catch (error) {
      throw new Error("Invalid theme JSON");
    }
  }

  /**
   * Set user preferences for theme
   */
  setPreferences(tenantId: string, prefs: Partial<BrandingPreferences>): void {
    const existing = this.preferences.get(tenantId) || {
      tenantId,
      theme: "auto",
      primaryColor: "#1976D2",
      accentColor: "#FFC107",
      customFont: false,
      enableAnimations: true,
    };

    const updated = { ...existing, ...prefs };
    this.preferences.set(tenantId, updated);
    this.emit("preferences-updated", updated);
  }

  /**
   * Get user preferences
   */
  getPreferences(tenantId: string): BrandingPreferences {
    return this.preferences.get(tenantId) || {
      tenantId,
      theme: "auto",
      primaryColor: "#1976D2",
      accentColor: "#FFC107",
      customFont: false,
      enableAnimations: true,
    };
  }

  /**
   * List all themes
   */
  listThemes(): BrandTheme[] {
    return Array.from(this.themes.values());
  }

  /**
   * Delete theme
   */
  deleteTheme(tenantId: string): void {
    if (this.themes.delete(tenantId)) {
      this.preferences.delete(tenantId);
      this.emit("theme-deleted", { tenantId });
    }
  }
}
