/**
 * Agreement Template Manager
 * Manages agreement templates with Handlebars support
 */

import * as crypto from 'crypto';

// Simple template renderer for handlebars-like syntax
const renderTemplate = (template: string, variables: Record<string, string>): string => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
};
import type {
  AgreementTemplate,
  TemplateVariable,
  ComplianceFramework,
  SigningFlowType,
} from './types';

/**
 * Template variable validation
 */
interface ValidationRule {
  type: string;
  pattern?: string;
  min?: number;
  max?: number;
  required?: boolean;
}

/**
 * Agreement Template Manager
 */
export class AgreementTemplateManager {
  private templates: Map<string, AgreementTemplate> = new Map();
  private templateVersions: Map<string, AgreementTemplate[]> = new Map();
  private validationRules: Map<string, ValidationRule> = new Map();

  constructor() {
    this.initializeDefaultValidations();
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultValidations(): void {
    this.validationRules.set('email', {
      type: 'email',
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
      required: true,
    });

    this.validationRules.set('phone', {
      type: 'phone',
      pattern: '^\\+?[1-9]\\d{1,14}$',
      required: true,
    });

    this.validationRules.set('date', {
      type: 'date',
      required: true,
    });

    this.validationRules.set('text', {
      type: 'text',
      max: 1000,
      required: true,
    });

    this.validationRules.set('number', {
      type: 'number',
      required: true,
    });
  }

  /**
   * Create agreement template
   */
  async createTemplate(params: {
    name: string;
    description: string;
    category: string;
    content: string; // Handlebars template
    variables: TemplateVariable[];
    requiredSignatories: number;
    signingFlow: SigningFlowType;
    expiryDays: number;
    complianceFrameworks: ComplianceFramework[];
  }): Promise<AgreementTemplate> {
    try {
      // Validate template content
      await this.validateTemplateContent(params.content, params.variables);

      // Validate variables
      this.validateVariables(params.variables);

      const templateId = crypto.randomUUID();
      const now = new Date();

      const template: AgreementTemplate = {
        templateId,
        name: params.name,
        description: params.description,
        category: params.category,
        content: params.content,
        variables: params.variables,
        requiredSignatories: params.requiredSignatories,
        signingFlow: params.signingFlow,
        expiryDays: params.expiryDays,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        complianceFrameworks: params.complianceFrameworks,
      };

      this.templates.set(templateId, template);

      // Initialize version history
      const versions: AgreementTemplate[] = [{ ...template }];
      this.templateVersions.set(templateId, versions);

      return template;
    } catch (error) {
      throw new Error(`Failed to create template: ${error}`);
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<Omit<AgreementTemplate, 'templateId' | 'version' | 'createdAt'>>,
  ): Promise<AgreementTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate new content if provided
    if (updates.content) {
      const variables = updates.variables || template.variables;
      await this.validateTemplateContent(updates.content, variables);
    }

    // Validate variables if provided
    if (updates.variables) {
      this.validateVariables(updates.variables);
    }

    // Create new version
    const newVersion = template.version + 1;
    const updatedTemplate: AgreementTemplate = {
      ...template,
      ...updates,
      version: newVersion,
      updatedAt: new Date(),
    };

    this.templates.set(templateId, updatedTemplate);

    // Add to version history
    const versions = this.templateVersions.get(templateId) || [];
    versions.push({ ...updatedTemplate });
    this.templateVersions.set(templateId, versions);

    return updatedTemplate;
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): AgreementTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * List templates by category
   */
  listTemplatesByCategory(category: string): AgreementTemplate[] {
    return Array.from(this.templates.values()).filter(
      t => t.category === category && t.isActive,
    );
  }

  /**
   * List all active templates
   */
  listActiveTemplates(): AgreementTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.isActive);
  }

  /**
   * Render template with variables
   */
  async renderTemplate(
    templateId: string,
    variables: Record<string, string>,
  ): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    try {
      // Validate provided variables
      this.validateProvidedVariables(variables, template.variables);

      // Render template
      let content = template.content;
      content = this.applyTemplateHelpers(content, variables);
      const rendered = renderTemplate(content, variables);

      return rendered;
    } catch (error) {
      throw new Error(`Failed to render template: ${error}`);
    }
  }

  /**
   * Get template version history
   */
  getVersionHistory(templateId: string): AgreementTemplate[] {
    return this.templateVersions.get(templateId) || [];
  }

  /**
   * Get specific template version
   */
  getTemplateVersion(templateId: string, version: number): AgreementTemplate | null {
    const versions = this.templateVersions.get(templateId) || [];
    return versions.find(v => v.version === version) || null;
  }

  /**
   * Revert to previous version
   */
  async revertToVersion(templateId: string, version: number): Promise<AgreementTemplate> {
    const previousVersion = this.getTemplateVersion(templateId, version);
    if (!previousVersion) {
      throw new Error(`Version not found: ${version}`);
    }

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Create new version based on previous
    const newVersion = template.version + 1;
    const revertedTemplate: AgreementTemplate = {
      ...previousVersion,
      templateId,
      version: newVersion,
      updatedAt: new Date(),
    };

    this.templates.set(templateId, revertedTemplate);

    // Add to version history
    const versions = this.templateVersions.get(templateId) || [];
    versions.push({ ...revertedTemplate });
    this.templateVersions.set(templateId, versions);

    return revertedTemplate;
  }

  /**
   * Deactivate template
   */
  deactivateTemplate(templateId: string): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.isActive = false;
      template.updatedAt = new Date();
    }
  }

  /**
   * Activate template
   */
  activateTemplate(templateId: string): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.isActive = true;
      template.updatedAt = new Date();
    }
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId: string): void {
    this.templates.delete(templateId);
    this.templateVersions.delete(templateId);
  }

  /**
   * Search templates
   */
  searchTemplates(query: string): AgreementTemplate[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.templates.values()).filter(
      t =>
        t.isActive &&
        (t.name.toLowerCase().includes(lowerQuery) ||
          t.description.toLowerCase().includes(lowerQuery) ||
          t.category.toLowerCase().includes(lowerQuery)),
    );
  }

  /**
   * Validate template content
   */
  private async validateTemplateContent(
    content: string,
    variables: TemplateVariable[],
  ): Promise<void> {
    try {
      // Extract variables from template
      const templateVars = this.extractVariablesFromTemplate(content);

      // Check if all required variables are defined
      const requiredVars = variables.filter(v => v.required).map(v => v.name);
      const missingVars = requiredVars.filter(name => !templateVars.includes(name));

      if (missingVars.length > 0) {
        throw new Error(
          `Missing required variables in template: ${missingVars.join(', ')}`,
        );
      }
    } catch (error) {
      throw new Error(`Invalid template content: ${error}`);
    }
  }

  /**
   * Extract variables from template
   */
  private extractVariablesFromTemplate(content: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (!match[1].startsWith('#') && !match[1].startsWith('/')) {
        matches.push(match[1]);
      }
    }

    const unique = new Set(matches);
    const result: string[] = [];
    unique.forEach(m => result.push(m));
    return result;
  }

  /**
   * Validate variables definition
   */
  private validateVariables(variables: TemplateVariable[]): void {
    const names = new Set<string>();

    for (const variable of variables) {
      // Check for duplicate names
      if (names.has(variable.name)) {
        throw new Error(`Duplicate variable name: ${variable.name}`);
      }
      names.add(variable.name);

      // Validate variable type
      const validTypes = ['text', 'number', 'date', 'email', 'phone', 'address'];
      if (!validTypes.includes(variable.type)) {
        throw new Error(`Invalid variable type: ${variable.type}`);
      }
    }
  }

  /**
   * Validate provided variables
   */
  private validateProvidedVariables(
    provided: Record<string, string>,
    defined: TemplateVariable[],
  ): void {
    for (const variable of defined) {
      if (variable.required && !provided[variable.name]) {
        throw new Error(`Missing required variable: ${variable.name}`);
      }

      if (provided[variable.name]) {
        this.validateVariable(variable.name, provided[variable.name], variable);
      }
    }
  }

  /**
   * Validate single variable
   */
  private validateVariable(
    name: string,
    value: string,
    variable: TemplateVariable,
  ): void {
    const rule = this.validationRules.get(variable.type);

    if (!rule) {
      return;
    }

    // Check required
    if (variable.required && !value) {
      throw new Error(`${name} is required`);
    }

    // Check pattern
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
      throw new Error(`${name} format is invalid`);
    }

    // Check length
    if (rule.max && value.length > rule.max) {
      throw new Error(`${name} exceeds maximum length of ${rule.max}`);
    }

    if (rule.min && value.length < rule.min) {
      throw new Error(`${name} is below minimum length of ${rule.min}`);
    }
  }

  /**
   * Apply template helpers
   */
  private applyTemplateHelpers(template: string, variables: Record<string, string>): string {
    let result = template;

    // Apply format-date helper
    result = result.replace(/\{\{format-date\s*(\w+)\}\}/g, (_, varName) => {
      const value = variables[varName];
      if (!value) return '';
      try {
        const date = new Date(value);
        return date.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        return value;
      }
    });

    // Apply format-phone helper
    result = result.replace(/\{\{format-phone\s*(\w+)\}\}/g, (_, varName) => {
      const value = variables[varName];
      if (!value) return '';
      return value.replace(/(\d{2})(\d{5})(\d{5})/, '+$1-$2-$3');
    });

    // Apply uppercase helper
    result = result.replace(/\{\{uppercase\s*(\w+)\}\}/g, (_, varName) => {
      const value = variables[varName];
      return value ? value.toUpperCase() : '';
    });

    // Apply lowercase helper
    result = result.replace(/\{\{lowercase\s*(\w+)\}\}/g, (_, varName) => {
      const value = variables[varName];
      return value ? value.toLowerCase() : '';
    });

    // Apply capitalize helper
    result = result.replace(/\{\{capitalize\s*(\w+)\}\}/g, (_, varName) => {
      const value = variables[varName];
      if (!value) return '';
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    });

    return result;
  }

  /**
   * Clear templates
   */
  clearCache(): void {
    this.templates.clear();
    this.templateVersions.clear();
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const templates = Array.from(this.templates.values());
    return {
      total: templates.length,
      active: templates.filter(t => t.isActive).length,
      byCategory: templates.reduce(
        (acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      bySigningFlow: templates.reduce(
        (acc, t) => {
          acc[t.signingFlow] = (acc[t.signingFlow] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
