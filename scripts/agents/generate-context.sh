#!/bin/bash
# Generate delegation context for a spec and role
# Usage: ./generate-context.sh <spec_name> <role>

set -e

SPEC_NAME="${1}"
ROLE="${2:-all}"
PROJECT_DIR="${HOME}/Downloads/vow"
SPECS_DIR="${PROJECT_DIR}/.kiro/specs"
SPEC_DIR="${SPECS_DIR}/${SPEC_NAME}"

if [ -z "${SPEC_NAME}" ]; then
    echo "Usage: ./generate-context.sh <spec_name> [role]"
    echo ""
    echo "Available specs:"
    ls -1 "${SPECS_DIR}" | head -20
    echo "..."
    exit 1
fi

if [ ! -d "${SPEC_DIR}" ]; then
    echo "Error: Spec '${SPEC_NAME}' not found"
    exit 1
fi

OUTPUT_FILE="${SPEC_DIR}/delegation-${ROLE}.md"

echo "Generating delegation context for ${SPEC_NAME} (${ROLE})..."

cat > "${OUTPUT_FILE}" << EOF
# Delegation Context: ${SPEC_NAME}

**Generated**: $(date -Iseconds)
**Role**: ${ROLE}

## Task Overview

- **Spec Reference**: .kiro/specs/${SPEC_NAME}/
- **Project**: VOW (Habit & Goal Tracker)

## Project Context

- **Tech Stack**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend**: TypeScript Lambda, Supabase (PostgreSQL)
- **Deployment**: AWS Amplify (frontend), Lambda (backend)

## Specification Summary

EOF

# Add requirements summary
if [ -f "${SPEC_DIR}/requirements.md" ]; then
    echo "### From requirements.md" >> "${OUTPUT_FILE}"
    echo "" >> "${OUTPUT_FILE}"
    head -50 "${SPEC_DIR}/requirements.md" | grep -E "^##|^###|^\*\*User Story" >> "${OUTPUT_FILE}" 2>/dev/null || true
    echo "" >> "${OUTPUT_FILE}"
fi

# Add tasks
if [ -f "${SPEC_DIR}/tasks.md" ]; then
    echo "### Tasks from tasks.md" >> "${OUTPUT_FILE}"
    echo "" >> "${OUTPUT_FILE}"

    case "${ROLE}" in
        frontend)
            echo "#### Frontend Tasks" >> "${OUTPUT_FILE}"
            grep -E "^\- \[|\s+component|frontend|UI|Modal|Widget|Section" "${SPEC_DIR}/tasks.md" >> "${OUTPUT_FILE}" 2>/dev/null || true
            ;;
        backend)
            echo "#### Backend Tasks" >> "${OUTPUT_FILE}"
            grep -E "^\- \[|\s+service|backend|API|router|Lambda" "${SPEC_DIR}/tasks.md" >> "${OUTPUT_FILE}" 2>/dev/null || true
            ;;
        test)
            echo "#### Test Tasks" >> "${OUTPUT_FILE}"
            grep -E "^\- \[|\s+test|property|validation" "${SPEC_DIR}/tasks.md" >> "${OUTPUT_FILE}" 2>/dev/null || true
            ;;
        *)
            cat "${SPEC_DIR}/tasks.md" >> "${OUTPUT_FILE}"
            ;;
    esac
    echo "" >> "${OUTPUT_FILE}"
fi

# Add coding conventions
cat >> "${OUTPUT_FILE}" << 'EOF'

## Coding Conventions

### Frontend (Next.js/React)
- Component naming: PascalCase (e.g., `Modal.Habit.tsx`, `Widget.Calendar.tsx`)
- Hook naming: `use` prefix (e.g., `useAuth.ts`, `useHabits.ts`)
- Use design tokens from CSS variables, not hardcoded colors
- Minimum touch target: 44x44px
- Use Tailwind CSS classes with design tokens:
  - `bg-background`, `bg-card`, `bg-primary`
  - `text-foreground`, `text-muted-foreground`
  - `border-border`, `rounded-md`, `shadow-sm`

### Backend (TypeScript Lambda)
- Service naming: `{name}Service.ts` (e.g., `aiCoachService.ts`)
- Router naming: `{name}.ts` in routers/ (e.g., `level.ts`)
- Use Zod schemas for validation
- Handle errors with try-catch and proper error responses

### Testing
- Unit tests with Jest
- Property-based tests with fast-check
- Test file naming: `*.test.ts` or `*.test.tsx`

## Git Workflow

1. Create feature branch from develop:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/${spec_name}-${role}
   ```

2. Make changes and commit:
   ```bash
   git add <files>
   git commit -m "feat(${scope}): ${description}"
   ```

3. Run tests before pushing:
   ```bash
   cd frontend && npm run lint && npm test
   cd ../backend && npm run build && npm test
   ```

4. Push and create PR (do NOT merge directly):
   ```bash
   git push -u origin feat/${spec_name}-${role}
   ```

## Completion Checklist

- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Linting passes (no ESLint errors)
- [ ] Changes committed to feature branch
- [ ] No hardcoded values (use design tokens)
- [ ] Responsive design tested (if UI changes)
- [ ] API changes documented (if backend changes)

## Reference Files

- `.kiro/specs/project-overview/design.md` - Project architecture
- `.kiro/steering/design-system.md` - UI guidelines
- `.kiro/steering/deployment.md` - Deployment procedures
EOF

echo ""
echo "Context generated: ${OUTPUT_FILE}"
echo ""
echo "To view: cat ${OUTPUT_FILE}"
