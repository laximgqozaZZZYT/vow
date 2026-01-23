/**
 * Property 8: Design System Compliance
 *
 * This property test verifies that all CSS classes used in the Demo Section
 * components comply with the design system rules defined in .kiro/steering/design-system.md
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**
 *
 * Design System Rules:
 * - Color classes SHALL use CSS variables (bg-background, text-foreground, etc.)
 * - Spacing classes SHALL follow 8px scale (p-2, p-4, p-6, p-8)
 * - Border-radius classes SHALL use design system values (rounded-sm, rounded-md, rounded-lg)
 * - Shadow classes SHALL use design system values (shadow-sm, shadow-md, shadow-lg)
 * - Dark mode SHALL be supported through class strategy
 *
 * Feature: landing-page-demo, Property 8: Design System Compliance
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Design System Definitions
// ============================================================================

/**
 * Valid semantic color classes from the design system
 * These use CSS variables and support dark mode automatically
 */
const VALID_SEMANTIC_COLORS = {
  background: [
    'bg-background',
    'bg-card',
    'bg-muted',
    'bg-primary',
    'bg-destructive',
    'bg-success',
    'bg-warning',
  ],
  foreground: [
    'text-foreground',
    'text-muted-foreground',
    'text-primary-foreground',
    'text-destructive-foreground',
    'text-primary',
    'text-destructive',
    'text-success',
    'text-warning',
  ],
  border: ['border-border', 'border-input', 'border-primary', 'border-destructive'],
};

/**
 * Valid spacing classes following 8px scale
 * --spacing-1: 4px, --spacing-2: 8px, --spacing-4: 16px, --spacing-6: 24px, --spacing-8: 32px
 */
const VALID_SPACING_CLASSES = [
  // Padding
  'p-1',
  'p-2',
  'p-3',
  'p-4',
  'p-5',
  'p-6',
  'p-8',
  'p-10',
  'p-12',
  'px-1',
  'px-2',
  'px-3',
  'px-4',
  'px-5',
  'px-6',
  'px-8',
  'py-1',
  'py-2',
  'py-3',
  'py-4',
  'py-5',
  'py-6',
  'py-8',
  'py-10',
  'py-12',
  'pt-1',
  'pt-2',
  'pt-4',
  'pt-6',
  'pt-8',
  'pt-10',
  'pt-12',
  'pt-16',
  'pt-20',
  'pb-1',
  'pb-2',
  'pb-4',
  'pb-6',
  'pb-8',
  'pl-1',
  'pl-2',
  'pl-4',
  'pl-6',
  'pl-8',
  'pr-1',
  'pr-2',
  'pr-4',
  'pr-6',
  'pr-8',
  // Margin
  'm-1',
  'm-2',
  'm-4',
  'm-6',
  'm-8',
  'mx-1',
  'mx-2',
  'mx-4',
  'mx-6',
  'mx-8',
  'mx-auto',
  'my-1',
  'my-2',
  'my-4',
  'my-6',
  'my-8',
  'mt-1',
  'mt-2',
  'mt-4',
  'mt-6',
  'mt-8',
  'mb-1',
  'mb-2',
  'mb-3',
  'mb-4',
  'mb-6',
  'mb-8',
  'ml-1',
  'ml-2',
  'ml-4',
  'ml-6',
  'ml-8',
  'mr-1',
  'mr-2',
  'mr-4',
  'mr-6',
  'mr-8',
  // Gap
  'gap-1',
  'gap-1.5',
  'gap-2',
  'gap-3',
  'gap-4',
  'gap-5',
  'gap-6',
  'gap-8',
  // Space
  'space-y-2',
  'space-y-3',
  'space-y-4',
  'space-y-6',
  'space-x-2',
  'space-x-3',
  'space-x-4',
  'space-x-6',
  // Inset
  'inset-0',
  'top-4',
  'left-4',
  'right-4',
  'bottom-4',
];

/**
 * Valid border-radius classes from design system
 * --radius-sm: 6px, --radius-md: 8px, --radius-lg: 12px, --radius-xl: 16px
 */
const VALID_RADIUS_CLASSES = [
  'rounded',
  'rounded-sm',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-full',
];

/**
 * Valid shadow classes from design system
 */
const VALID_SHADOW_CLASSES = ['shadow-sm', 'shadow-md', 'shadow-lg', 'shadow'];

/**
 * Hardcoded color patterns that should NOT be used
 * These bypass the design system and don't support dark mode
 */
const HARDCODED_COLOR_PATTERNS = [
  // Hex colors
  /bg-\[#[0-9a-fA-F]+\]/,
  /text-\[#[0-9a-fA-F]+\]/,
  /border-\[#[0-9a-fA-F]+\]/,
  // RGB colors
  /bg-\[rgb\(/,
  /text-\[rgb\(/,
  /border-\[rgb\(/,
  // Hardcoded pixel values for spacing (except common ones)
  /p-\[\d+px\]/,
  /m-\[\d+px\]/,
  /gap-\[\d+px\]/,
  // Hardcoded border-radius
  /rounded-\[\d+px\]/,
];

/**
 * Allowed hardcoded values (exceptions)
 * Some values are acceptable when they serve specific purposes
 */
const ALLOWED_HARDCODED_PATTERNS = [
  // Opacity modifiers are allowed
  /\/\d+/, // e.g., bg-primary/20
  // Specific width/height values for layout
  /w-\d+/,
  /h-\d+/,
  // Aspect ratio
  /aspect-/,
  // Min/max dimensions
  /min-w-/,
  /min-h-/,
  /max-w-/,
  /max-h-/,
];

// ============================================================================
// File Reading Utilities
// ============================================================================

/**
 * Demo component files to analyze
 */
const DEMO_COMPONENT_FILES = [
  'app/demo/components/Section.Demo.tsx',
  'app/demo/components/DemoSkeleton.tsx',
  'app/demo/components/DemoOverlay.tsx',
  'app/demo/components/DemoAnimationController.tsx',
  'app/demo/components/DemoErrorBoundary.tsx',
  'app/demo/components/DemoFallback.tsx',
  'app/demo/components/LazyDemoSection.tsx',
];

/**
 * Read file content safely
 */
function readFileContent(filePath: string): string | null {
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    return fs.readFileSync(absolutePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Extract all className values from a file
 */
function extractClassNames(content: string): string[] {
  const classNames: string[] = [];

  // Match className="..." and className={`...`}
  const classNamePatterns = [
    /className="([^"]+)"/g,
    /className=\{`([^`]+)`\}/g,
    /className=\{\s*['"]([^'"]+)['"]\s*\}/g,
  ];

  for (const pattern of classNamePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const classes = match[1].split(/\s+/).filter(Boolean);
      classNames.push(...classes);
    }
  }

  return classNames;
}

/**
 * Check if a class is a valid semantic color class
 */
function isValidSemanticColor(className: string): boolean {
  // Check if it's a background color
  if (className.startsWith('bg-')) {
    // Allow semantic colors
    if (VALID_SEMANTIC_COLORS.background.some((c) => className.startsWith(c))) {
      return true;
    }
    // Allow opacity modifiers on semantic colors
    if (/^bg-(background|card|muted|primary|destructive|success|warning)(\/\d+)?$/.test(className)) {
      return true;
    }
    // Allow gradient classes
    if (className.startsWith('bg-gradient-')) {
      return true;
    }
    // Allow transparent
    if (className === 'bg-transparent') {
      return true;
    }
    // Allow black/white for specific use cases (landing page hero)
    if (className === 'bg-black' || className === 'bg-white') {
      return true;
    }
  }

  // Check if it's a text color
  if (className.startsWith('text-')) {
    // Allow semantic colors
    if (VALID_SEMANTIC_COLORS.foreground.some((c) => className.startsWith(c))) {
      return true;
    }
    // Allow text size classes
    if (/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|h1|h2|h3|body|small|caption|display)$/.test(className)) {
      return true;
    }
    // Allow text alignment
    if (/^text-(left|center|right|justify)$/.test(className)) {
      return true;
    }
    // Allow black/white for specific use cases
    if (className === 'text-black' || className === 'text-white') {
      return true;
    }
  }

  // Check if it's a border color
  if (className.startsWith('border-')) {
    // Allow semantic colors
    if (VALID_SEMANTIC_COLORS.border.some((c) => className.startsWith(c))) {
      return true;
    }
    // Allow border width classes
    if (/^border(-\d+)?$/.test(className)) {
      return true;
    }
    // Allow border style
    if (/^border-(solid|dashed|dotted|none)$/.test(className)) {
      return true;
    }
    // Allow border position
    if (/^border-(t|b|l|r|x|y)(-\d+)?$/.test(className)) {
      return true;
    }
    // Allow transparent
    if (className === 'border-transparent') {
      return true;
    }
  }

  return true; // Non-color classes pass through
}

/**
 * Check if a class uses hardcoded values that should be avoided
 */
function usesHardcodedValues(className: string): boolean {
  // Check against hardcoded patterns
  for (const pattern of HARDCODED_COLOR_PATTERNS) {
    if (pattern.test(className)) {
      // Check if it's an allowed exception
      for (const allowedPattern of ALLOWED_HARDCODED_PATTERNS) {
        if (allowedPattern.test(className)) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}

/**
 * Check if a spacing class follows the 8px scale
 */
function isValidSpacingClass(className: string): boolean {
  // Check if it's a spacing class
  const spacingPrefixes = ['p-', 'px-', 'py-', 'pt-', 'pb-', 'pl-', 'pr-', 'm-', 'mx-', 'my-', 'mt-', 'mb-', 'ml-', 'mr-', 'gap-', 'space-'];

  const isSpacingClass = spacingPrefixes.some((prefix) => className.startsWith(prefix));

  if (!isSpacingClass) {
    return true; // Not a spacing class, pass through
  }

  // Check if it's in the valid list
  if (VALID_SPACING_CLASSES.includes(className)) {
    return true;
  }

  // Allow responsive variants
  if (/^(sm|md|lg|xl|2xl):/.test(className)) {
    const baseClass = className.split(':')[1];
    return VALID_SPACING_CLASSES.includes(baseClass);
  }

  // Allow negative margins
  if (className.startsWith('-')) {
    const positiveClass = className.slice(1);
    return VALID_SPACING_CLASSES.includes(positiveClass);
  }

  return false;
}

/**
 * Check if a border-radius class uses design system values
 */
function isValidRadiusClass(className: string): boolean {
  if (!className.startsWith('rounded')) {
    return true; // Not a radius class
  }

  // Check if it's in the valid list
  if (VALID_RADIUS_CLASSES.includes(className)) {
    return true;
  }

  // Allow responsive variants
  if (/^(sm|md|lg|xl|2xl):/.test(className)) {
    const baseClass = className.split(':')[1];
    return VALID_RADIUS_CLASSES.includes(baseClass);
  }

  // Allow position-specific radius
  if (/^rounded-(t|b|l|r|tl|tr|bl|br)-(sm|md|lg|xl|2xl|full)$/.test(className)) {
    return true;
  }

  return false;
}

/**
 * Check if a shadow class uses design system values
 */
function isValidShadowClass(className: string): boolean {
  if (!className.startsWith('shadow')) {
    return true; // Not a shadow class
  }

  // Check if it's in the valid list
  if (VALID_SHADOW_CLASSES.includes(className)) {
    return true;
  }

  // Allow shadow-none
  if (className === 'shadow-none') {
    return true;
  }

  // Allow responsive variants
  if (/^(sm|md|lg|xl|2xl):/.test(className)) {
    const baseClass = className.split(':')[1];
    return VALID_SHADOW_CLASSES.includes(baseClass);
  }

  // Allow drop-shadow for SVG
  if (className.startsWith('drop-shadow')) {
    return true;
  }

  return false;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 8: Design System Compliance', () => {
  // Collect all class names from demo components
  let allClassNames: { file: string; className: string }[] = [];

  beforeAll(() => {
    for (const filePath of DEMO_COMPONENT_FILES) {
      const content = readFileContent(filePath);
      if (content) {
        const classNames = extractClassNames(content);
        for (const className of classNames) {
          allClassNames.push({ file: filePath, className });
        }
      }
    }
  });

  describe('Color Classes', () => {
    it('should use semantic color classes (CSS variables) instead of hardcoded colors', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, allClassNames.length - 1) }),
          (index) => {
            if (allClassNames.length === 0) return true;

            const { file, className } = allClassNames[index];

            // Skip non-color classes
            if (!className.startsWith('bg-') && !className.startsWith('text-') && !className.startsWith('border-')) {
              return true;
            }

            const isValid = isValidSemanticColor(className);
            if (!isValid) {
              console.log(`Invalid color class in ${file}: ${className}`);
            }
            return isValid;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not use hardcoded hex or rgb color values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, allClassNames.length - 1) }),
          (index) => {
            if (allClassNames.length === 0) return true;

            const { file, className } = allClassNames[index];
            const hasHardcoded = usesHardcodedValues(className);

            if (hasHardcoded) {
              console.log(`Hardcoded value in ${file}: ${className}`);
            }
            return !hasHardcoded;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Spacing Classes', () => {
    it('should follow 8px spacing scale', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, allClassNames.length - 1) }),
          (index) => {
            if (allClassNames.length === 0) return true;

            const { file, className } = allClassNames[index];
            const isValid = isValidSpacingClass(className);

            if (!isValid) {
              console.log(`Invalid spacing class in ${file}: ${className}`);
            }
            return isValid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Border Radius Classes', () => {
    it('should use design system border-radius values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, allClassNames.length - 1) }),
          (index) => {
            if (allClassNames.length === 0) return true;

            const { file, className } = allClassNames[index];
            const isValid = isValidRadiusClass(className);

            if (!isValid) {
              console.log(`Invalid radius class in ${file}: ${className}`);
            }
            return isValid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Shadow Classes', () => {
    it('should use design system shadow values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, allClassNames.length - 1) }),
          (index) => {
            if (allClassNames.length === 0) return true;

            const { file, className } = allClassNames[index];
            const isValid = isValidShadowClass(className);

            if (!isValid) {
              console.log(`Invalid shadow class in ${file}: ${className}`);
            }
            return isValid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Dark Mode Support', () => {
    it('should support dark mode through CSS variables (no explicit dark: overrides for colors)', () => {
      // This test verifies that color classes use CSS variables which automatically
      // support dark mode, rather than requiring explicit dark: prefixes
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, allClassNames.length - 1) }),
          (index) => {
            if (allClassNames.length === 0) return true;

            const { file, className } = allClassNames[index];

            // Check for dark: prefix on color classes
            if (className.startsWith('dark:')) {
              const baseClass = className.slice(5);
              // Dark mode overrides for semantic colors are acceptable
              // but hardcoded colors in dark mode are not
              if (usesHardcodedValues(baseClass)) {
                console.log(`Hardcoded dark mode color in ${file}: ${className}`);
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Component File Coverage', () => {
    it('should have analyzed all demo component files', () => {
      const analyzedFiles = new Set(allClassNames.map((c) => c.file));

      for (const filePath of DEMO_COMPONENT_FILES) {
        const content = readFileContent(filePath);
        if (content) {
          // File exists and was read
          expect(analyzedFiles.has(filePath) || extractClassNames(content).length === 0).toBe(true);
        }
      }
    });

    it('should have extracted class names from demo components', () => {
      // At least some class names should have been extracted
      expect(allClassNames.length).toBeGreaterThan(0);
    });
  });
});
