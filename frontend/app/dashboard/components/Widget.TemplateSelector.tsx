"use client";

/**
 * TemplateSelector Widget
 *
 * TASK-2.3: Quick template selection with variable input form
 *
 * Features:
 * - Template cards in responsive grid (2 columns mobile, 4 columns desktop)
 * - Inline variable input form expansion
 * - Input preview display with fillTemplate
 * - Required field validation
 * - Optional category filtering
 *
 * @module Widget.TemplateSelector
 */

import { useState, useMemo, useCallback, memo } from 'react';
import type { TaskTemplate, TemplateCategory, TemplateVariable } from '../types/template.types';
import { taskTemplates, fillTemplate } from '../data/taskTemplates';

// ============================================================================
// Types
// ============================================================================

export interface TemplateSelectorProps {
  onSelect: (template: TaskTemplate, variables: Record<string, string | number>) => void;
  locale?: 'ja' | 'en';
  category?: TemplateCategory;
  disabled?: boolean;
}

interface TemplateCardProps {
  template: TaskTemplate;
  locale: 'ja' | 'en';
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
}

interface VariableFormProps {
  template: TaskTemplate;
  locale: 'ja' | 'en';
  disabled: boolean;
  onSubmit: (variables: Record<string, string | number>) => void;
  onCancel: () => void;
}

// ============================================================================
// Icon Components
// ============================================================================

/**
 * Icon mapping for templates
 */
function TemplateIcon({ icon, className = "" }: { icon: string; className?: string }) {
  const iconMap: Record<string, string> = {
    'chart-bar': '\u{1F4CA}',      // Habit Analysis
    'calendar-week': '\u{1F4C5}',  // Weekly Review
    'target': '\u{1F3AF}',         // Goal Planning
    'document-text': '\u{1F4DD}',  // SPEC Draft
    'code': '\u{1F4BB}',           // Code Review
  };

  const emoji = iconMap[icon] || '\u{1F4CB}'; // Default: clipboard

  return (
    <span className={`${className}`} role="img" aria-hidden="true">
      {emoji}
    </span>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Category Filter Dropdown
 */
function CategoryFilter({
  value,
  onChange,
  locale,
}: {
  value: TemplateCategory | 'all';
  onChange: (category: TemplateCategory | 'all') => void;
  locale: 'ja' | 'en';
}) {
  const labels: Record<TemplateCategory | 'all', { ja: string; en: string }> = {
    all: { ja: '\u5168\u3066', en: 'All' },
    coaching: { ja: '\u30B3\u30FC\u30C1\u30F3\u30B0', en: 'Coaching' },
    development: { ja: '\u958B\u767A', en: 'Development' },
    analysis: { ja: '\u5206\u6790', en: 'Analysis' },
  };

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TemplateCategory | 'all')}
      className="text-xs px-2 py-1 bg-muted border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {(['all', 'coaching', 'development', 'analysis'] as const).map((cat) => (
        <option key={cat} value={cat}>
          {labels[cat][locale]}
        </option>
      ))}
    </select>
  );
}

/**
 * Individual Template Card
 */
const TemplateCard = memo(function TemplateCard({
  template,
  locale,
  isSelected,
  disabled,
  onClick,
}: TemplateCardProps) {
  const name = locale === 'ja' ? template.nameJa : template.name;
  const description = locale === 'ja' ? template.descriptionJa : template.description;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center
        p-3 min-h-[88px]
        bg-card border rounded-lg
        transition-all duration-150
        focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
        ${isSelected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={description}
    >
      <TemplateIcon icon={template.icon} className="text-2xl mb-1" />
      <span className="text-sm font-medium text-foreground text-center line-clamp-2">
        {name}
      </span>
    </button>
  );
});

/**
 * Variable Input Field
 */
function VariableInput({
  variable,
  value,
  onChange,
  locale,
  error,
}: {
  variable: TemplateVariable;
  value: string | number;
  onChange: (value: string | number) => void;
  locale: 'ja' | 'en';
  error?: string;
}) {
  const label = locale === 'ja' ? variable.labelJa : variable.label;

  if (variable.type === 'select' && variable.options) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
          {variable.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full px-3 py-2 text-sm
            bg-background border rounded-md
            text-foreground
            focus:outline-none focus:ring-2 focus:ring-primary/50
            ${error ? 'border-red-500' : 'border-border'}
          `}
        >
          {variable.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {variable.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={variable.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(variable.type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={label}
        className={`
          w-full px-3 py-2 text-sm
          bg-background border rounded-md
          text-foreground placeholder:text-muted-foreground
          focus:outline-none focus:ring-2 focus:ring-primary/50
          ${error ? 'border-red-500' : 'border-border'}
        `}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

/**
 * Variable Input Form with Preview
 */
function VariableForm({
  template,
  locale,
  disabled,
  onSubmit,
  onCancel,
}: VariableFormProps) {
  const name = locale === 'ja' ? template.nameJa : template.name;

  // Initialize form state with default values
  const [values, setValues] = useState<Record<string, string | number>>(() => {
    const initial: Record<string, string | number> = {};
    for (const variable of template.variables) {
      initial[variable.key] = variable.defaultValue ?? (variable.type === 'number' ? 0 : '');
    }
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update a single variable
  const handleChange = useCallback((key: string, value: string | number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear error when user types
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [errors]);

  // Validate and submit
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, string> = {};
    for (const variable of template.variables) {
      if (variable.required) {
        const value = values[variable.key];
        if (value === '' || value === undefined) {
          newErrors[variable.key] = locale === 'ja' ? '\u5FC5\u9808\u9805\u76EE\u3067\u3059' : 'Required';
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(values);
  }, [values, template.variables, locale, onSubmit]);

  // Generate preview
  const preview = useMemo(() => {
    try {
      const result = fillTemplate(template, values);
      // Show first line or truncated description
      const firstLine = result.description.split('\n')[0];
      return firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine;
    } catch {
      return '';
    }
  }, [template, values]);

  return (
    <div className="mt-3 p-4 bg-muted/50 border border-border rounded-lg animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <TemplateIcon icon={template.icon} className="text-xl" />
        <span className="font-medium text-sm text-foreground">{name}</span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Variable Inputs */}
        <div className="space-y-3 mb-3">
          {template.variables.map((variable) => (
            <VariableInput
              key={variable.key}
              variable={variable}
              value={values[variable.key]}
              onChange={(v) => handleChange(variable.key, v)}
              locale={locale}
              error={errors[variable.key]}
            />
          ))}
        </div>

        {/* Preview */}
        {preview && (
          <div className="mb-3 p-2 bg-background/50 border border-border/50 rounded text-xs text-muted-foreground">
            <span className="font-medium">Preview: </span>
            <span className="italic">{preview}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            {locale === 'ja' ? '\u00D7' : '\u00D7'}
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {locale === 'ja' ? '\u4F5C\u6210' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * TemplateSelector Component
 *
 * Quick template selection widget with:
 * - Responsive grid of template cards
 * - Category filter dropdown
 * - Inline variable input form
 * - Live preview with fillTemplate
 * - Required field validation
 */
function TemplateSelectorComponent({
  onSelect,
  locale = 'ja',
  category: initialCategory,
  disabled = false,
}: TemplateSelectorProps) {
  // State
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [filterCategory, setFilterCategory] = useState<TemplateCategory | 'all'>(initialCategory ?? 'all');

  // Filter templates
  const filteredTemplates = useMemo(() => {
    if (filterCategory === 'all') {
      return taskTemplates;
    }
    return taskTemplates.filter((t) => t.category === filterCategory);
  }, [filterCategory]);

  // Handle template card click
  const handleTemplateClick = useCallback((template: TaskTemplate) => {
    if (disabled) return;

    // If template has no variables, select immediately
    if (template.variables.length === 0) {
      onSelect(template, {});
      return;
    }

    // Toggle selection or switch to new template
    setSelectedTemplate((prev) => (prev?.id === template.id ? null : template));
  }, [disabled, onSelect]);

  // Handle form submit
  const handleFormSubmit = useCallback((variables: Record<string, string | number>) => {
    if (selectedTemplate) {
      onSelect(selectedTemplate, variables);
      setSelectedTemplate(null);
    }
  }, [selectedTemplate, onSelect]);

  // Handle form cancel
  const handleFormCancel = useCallback(() => {
    setSelectedTemplate(null);
  }, []);

  // Localized title
  const title = locale === 'ja' ? 'Quick Templates' : 'Quick Templates';

  return (
    <div className="space-y-3">
      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <CategoryFilter
          value={filterCategory}
          onChange={setFilterCategory}
          locale={locale}
        />
      </div>

      {/* Template Grid: 2 columns mobile, 4 columns desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            locale={locale}
            isSelected={selectedTemplate?.id === template.id}
            disabled={disabled}
            onClick={() => handleTemplateClick(template)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <div className="text-2xl mb-2">{'\u{1F4CB}'}</div>
          <div className="text-sm">
            {locale === 'ja'
              ? '\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093'
              : 'No templates found'}
          </div>
        </div>
      )}

      {/* Variable Input Form (inline expansion) */}
      {selectedTemplate && selectedTemplate.variables.length > 0 && (
        <VariableForm
          template={selectedTemplate}
          locale={locale}
          disabled={disabled}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}

export const TemplateSelector = memo(TemplateSelectorComponent);
export default TemplateSelector;
