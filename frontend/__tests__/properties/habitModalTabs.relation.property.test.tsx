/**
 * Property-Based Tests for Habit Modal Tabs - Relation Add/Remove
 * 
 * **Feature: habit-modal-tabs, Property 4: Relation add/remove consistency**
 * **Validates: Requirements 5.4**
 * 
 * Tests that:
 * - For any habit relation added to the relations list, the relation should appear in the list.
 * - For any relation removed from the list, the relation should no longer appear in the list.
 * 
 * Uses fast-check for property-based testing with at least 100 iterations.
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, fireEvent, within, cleanup } from '@testing-library/react';
import { DetailTab, HabitRelation, RelationType, Goal, Tag } from '../../app/dashboard/components/tabs/DetailTab';
import type { Habit, HabitFormState } from '../../app/dashboard/components/tabs/BasicTab';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid RelationType values
 */
const relationTypeArb: fc.Arbitrary<RelationType> = fc.constantFrom('main', 'sub', 'next');

/**
 * Generator for a unique ID (UUID-like)
 */
const idArb: fc.Arbitrary<string> = fc.uuid();

/**
 * Generator for a habit name - alphanumeric without trailing spaces to avoid aria-label issues
 */
const habitNameArb: fc.Arbitrary<string> = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,19}$/);

/**
 * Generator for a Habit object
 */
const habitArb: fc.Arbitrary<Habit> = fc.record({
  id: idArb,
  name: habitNameArb,
  type: fc.constantFrom('do', 'avoid') as fc.Arbitrary<'do' | 'avoid'>,
  timings: fc.constant([]),
  notes: fc.string(),
  outdates: fc.constant([]),
  workloadUnit: fc.string(),
  workloadTotal: fc.string(),
  workloadTotalEnd: fc.string(),
  workloadPerCount: fc.string(),
  goalId: fc.option(idArb, { nil: undefined }),
  selectedTagIds: fc.constant([]),
  relations: fc.constant([]),
});

/**
 * Generator for a HabitRelation object
 */
const habitRelationArb = (habitId: string, availableHabitIds: string[]): fc.Arbitrary<HabitRelation> => {
  if (availableHabitIds.length === 0) {
    // Return a relation with a generated ID if no available habits
    return fc.record({
      id: idArb,
      habitId: fc.constant(habitId),
      relatedHabitId: idArb,
      relation: relationTypeArb,
    });
  }
  return fc.record({
    id: idArb,
    habitId: fc.constant(habitId),
    relatedHabitId: fc.constantFrom(...availableHabitIds),
    relation: relationTypeArb,
  });
};

/**
 * Generator for an array of unique habits
 */
const habitsArrayArb: fc.Arbitrary<Habit[]> = fc.array(habitArb, { minLength: 2, maxLength: 10 })
  .map(habits => {
    // Ensure unique IDs
    const seen = new Set<string>();
    return habits.filter(h => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    });
  })
  .filter(habits => habits.length >= 2);

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a default form state for testing
 */
function createDefaultFormState(): HabitFormState {
  return {
    name: 'Test Habit',
    type: 'do',
    timings: [],
    notes: '',
    outdates: [],
    workloadUnit: '',
    workloadTotal: '',
    workloadTotalEnd: '',
    workloadPerCount: '',
    goalId: undefined,
    selectedTagIds: [],
    relations: [],
  };
}

/**
 * Creates default props for DetailTab
 */
function createDefaultProps(overrides: Partial<{
  habit: Habit | null;
  allHabits: Habit[];
  relations: HabitRelation[];
  onRelationAdd: (relation: Omit<HabitRelation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onRelationDelete: (id: string) => void;
}> = {}) {
  return {
    isActive: true,
    formState: createDefaultFormState(),
    onFieldChange: jest.fn(),
    goals: [] as Goal[],
    tags: [] as Tag[],
    allHabits: overrides.allHabits ?? [],
    relations: overrides.relations ?? [],
    onRelationAdd: overrides.onRelationAdd ?? jest.fn(),
    onRelationDelete: overrides.onRelationDelete ?? jest.fn(),
    onTagsChange: jest.fn(),
    habit: overrides.habit ?? null,
    loadingRelations: false,
    idPrefix: 'test',
  };
}

// ============================================================================
// Pure Logic Tests for Relation Add/Remove
// ============================================================================

/**
 * Pure function to add a relation to a list
 * This simulates the logic that would be used in the actual component
 */
function addRelation(
  relations: HabitRelation[],
  newRelation: Omit<HabitRelation, 'id' | 'createdAt' | 'updatedAt'>
): HabitRelation[] {
  const relationWithId: HabitRelation = {
    ...newRelation,
    id: `relation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
  return [...relations, relationWithId];
}

/**
 * Pure function to remove a relation from a list
 */
function removeRelation(relations: HabitRelation[], relationId: string): HabitRelation[] {
  return relations.filter(r => r.id !== relationId);
}

/**
 * Check if a relation exists in the list by its properties (excluding id)
 */
function relationExistsInList(
  relations: HabitRelation[],
  relation: Omit<HabitRelation, 'id' | 'createdAt' | 'updatedAt'>
): boolean {
  return relations.some(
    r => r.habitId === relation.habitId &&
         r.relatedHabitId === relation.relatedHabitId &&
         r.relation === relation.relation
  );
}

/**
 * Check if a relation with given ID exists in the list
 */
function relationIdExistsInList(relations: HabitRelation[], relationId: string): boolean {
  return relations.some(r => r.id === relationId);
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Feature: habit-modal-tabs, Property 4: Relation add/remove consistency', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Property 4: Relation Add/Remove Consistency
   * 
   * *For any* habit relation added to the relations list, the relation should appear in the list.
   * *For any* relation removed from the list, the relation should no longer appear in the list.
   * 
   * **Validates: Requirements 5.4**
   */
  describe('Property 4: Relation add/remove consistency', () => {
    
    // ========================================================================
    // Pure Logic Tests (Testing the add/remove logic directly)
    // ========================================================================
    
    describe('Pure logic: Adding relations', () => {
      it('adding a relation should make it appear in the list', () => {
        fc.assert(
          fc.property(
            idArb, // habitId
            idArb, // relatedHabitId
            relationTypeArb,
            (habitId, relatedHabitId, relationType) => {
              const initialRelations: HabitRelation[] = [];
              const newRelation = {
                habitId,
                relatedHabitId,
                relation: relationType,
              };

              const updatedRelations = addRelation(initialRelations, newRelation);

              // The new relation should appear in the list
              expect(relationExistsInList(updatedRelations, newRelation)).toBe(true);
              // List length should increase by 1
              expect(updatedRelations.length).toBe(initialRelations.length + 1);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('adding a relation to a non-empty list should preserve existing relations', () => {
        fc.assert(
          fc.property(
            fc.array(
              fc.record({
                id: idArb,
                habitId: idArb,
                relatedHabitId: idArb,
                relation: relationTypeArb,
              }),
              { minLength: 1, maxLength: 5 }
            ),
            idArb, // new relatedHabitId
            relationTypeArb,
            (existingRelations, newRelatedHabitId, newRelationType) => {
              const habitId = existingRelations[0]?.habitId ?? 'test-habit';
              const newRelation = {
                habitId,
                relatedHabitId: newRelatedHabitId,
                relation: newRelationType,
              };

              const updatedRelations = addRelation(existingRelations, newRelation);

              // All existing relations should still be present
              for (const existing of existingRelations) {
                expect(relationIdExistsInList(updatedRelations, existing.id)).toBe(true);
              }
              // The new relation should also be present
              expect(relationExistsInList(updatedRelations, newRelation)).toBe(true);
              // Length should be original + 1
              expect(updatedRelations.length).toBe(existingRelations.length + 1);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('adding multiple relations sequentially should result in all being present', () => {
        fc.assert(
          fc.property(
            idArb, // habitId
            fc.array(
              fc.record({
                relatedHabitId: idArb,
                relation: relationTypeArb,
              }),
              { minLength: 1, maxLength: 5 }
            ),
            (habitId, relationsToAdd) => {
              let currentRelations: HabitRelation[] = [];

              for (const rel of relationsToAdd) {
                const newRelation = {
                  habitId,
                  relatedHabitId: rel.relatedHabitId,
                  relation: rel.relation,
                };
                currentRelations = addRelation(currentRelations, newRelation);
              }

              // All added relations should be present
              expect(currentRelations.length).toBe(relationsToAdd.length);
              for (const rel of relationsToAdd) {
                expect(
                  relationExistsInList(currentRelations, {
                    habitId,
                    relatedHabitId: rel.relatedHabitId,
                    relation: rel.relation,
                  })
                ).toBe(true);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Pure logic: Removing relations', () => {
      it('removing a relation should make it no longer appear in the list', () => {
        fc.assert(
          fc.property(
            fc.array(
              fc.record({
                id: idArb,
                habitId: idArb,
                relatedHabitId: idArb,
                relation: relationTypeArb,
              }),
              { minLength: 1, maxLength: 5 }
            ),
            fc.nat(),
            (relations, indexSeed) => {
              // Pick a random relation to remove
              const indexToRemove = indexSeed % relations.length;
              const relationToRemove = relations[indexToRemove];

              const updatedRelations = removeRelation(relations, relationToRemove.id);

              // The removed relation should no longer be in the list
              expect(relationIdExistsInList(updatedRelations, relationToRemove.id)).toBe(false);
              // List length should decrease by 1
              expect(updatedRelations.length).toBe(relations.length - 1);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('removing a relation should preserve all other relations', () => {
        fc.assert(
          fc.property(
            fc.array(
              fc.record({
                id: idArb,
                habitId: idArb,
                relatedHabitId: idArb,
                relation: relationTypeArb,
              }),
              { minLength: 2, maxLength: 5 }
            ),
            fc.nat(),
            (relations, indexSeed) => {
              // Pick a random relation to remove
              const indexToRemove = indexSeed % relations.length;
              const relationToRemove = relations[indexToRemove];

              const updatedRelations = removeRelation(relations, relationToRemove.id);

              // All other relations should still be present
              for (let i = 0; i < relations.length; i++) {
                if (i !== indexToRemove) {
                  expect(relationIdExistsInList(updatedRelations, relations[i].id)).toBe(true);
                }
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('removing a non-existent relation should not change the list', () => {
        fc.assert(
          fc.property(
            fc.array(
              fc.record({
                id: idArb,
                habitId: idArb,
                relatedHabitId: idArb,
                relation: relationTypeArb,
              }),
              { minLength: 0, maxLength: 5 }
            ),
            idArb, // non-existent ID
            (relations, nonExistentId) => {
              // Ensure the ID doesn't exist in the list
              const filteredRelations = relations.filter(r => r.id !== nonExistentId);
              
              const updatedRelations = removeRelation(filteredRelations, nonExistentId);

              // List should remain unchanged
              expect(updatedRelations.length).toBe(filteredRelations.length);
              for (const rel of filteredRelations) {
                expect(relationIdExistsInList(updatedRelations, rel.id)).toBe(true);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('removing all relations one by one should result in an empty list', () => {
        fc.assert(
          fc.property(
            fc.array(
              fc.record({
                id: idArb,
                habitId: idArb,
                relatedHabitId: idArb,
                relation: relationTypeArb,
              }),
              { minLength: 1, maxLength: 5 }
            ),
            (relations) => {
              let currentRelations = [...relations];

              // Remove each relation one by one
              for (const rel of relations) {
                currentRelations = removeRelation(currentRelations, rel.id);
              }

              // List should be empty
              expect(currentRelations.length).toBe(0);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Pure logic: Add then remove consistency', () => {
      it('adding then removing a relation should return to original state', () => {
        fc.assert(
          fc.property(
            fc.array(
              fc.record({
                id: idArb,
                habitId: idArb,
                relatedHabitId: idArb,
                relation: relationTypeArb,
              }),
              { minLength: 0, maxLength: 5 }
            ),
            idArb, // new relatedHabitId
            relationTypeArb,
            (initialRelations, newRelatedHabitId, newRelationType) => {
              const habitId = 'test-habit';
              const newRelation = {
                habitId,
                relatedHabitId: newRelatedHabitId,
                relation: newRelationType,
              };

              // Add the relation
              const afterAdd = addRelation(initialRelations, newRelation);
              expect(afterAdd.length).toBe(initialRelations.length + 1);

              // Find the newly added relation's ID
              const addedRelation = afterAdd.find(
                r => r.habitId === newRelation.habitId &&
                     r.relatedHabitId === newRelation.relatedHabitId &&
                     r.relation === newRelation.relation &&
                     !initialRelations.some(ir => ir.id === r.id)
              );
              expect(addedRelation).toBeDefined();

              // Remove the relation
              const afterRemove = removeRelation(afterAdd, addedRelation!.id);

              // Should be back to original length
              expect(afterRemove.length).toBe(initialRelations.length);
              // All original relations should still be present
              for (const rel of initialRelations) {
                expect(relationIdExistsInList(afterRemove, rel.id)).toBe(true);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    // ========================================================================
    // Component Integration Tests
    // ========================================================================

    describe('Component integration: Adding relations via UI', () => {
      it('clicking add button should trigger onRelationAdd with correct data', () => {
        fc.assert(
          fc.property(
            habitsArrayArb,
            relationTypeArb,
            (habits, relationType) => {
              // Use first habit as the current habit, rest as available for relations
              const currentHabit = habits[0];
              const availableHabits = habits.slice(1);
              
              if (availableHabits.length === 0) return; // Skip if no available habits

              let capturedRelation: Omit<HabitRelation, 'id' | 'createdAt' | 'updatedAt'> | null = null;
              const handleRelationAdd = (relation: Omit<HabitRelation, 'id' | 'createdAt' | 'updatedAt'>) => {
                capturedRelation = relation;
              };

              const props = createDefaultProps({
                habit: currentHabit,
                allHabits: habits,
                relations: [],
                onRelationAdd: handleRelationAdd,
              });

              const { container, unmount } = render(<DetailTab {...props} />);

              // Select a habit to relate
              const habitSelector = within(container).getByLabelText('Select habit to relate');
              fireEvent.change(habitSelector, { target: { value: availableHabits[0].id } });

              // Select relation type
              const typeSelector = within(container).getByLabelText('Select relation type');
              fireEvent.change(typeSelector, { target: { value: relationType } });

              // Click add button
              const addButton = within(container).getByLabelText('Add relation');
              fireEvent.click(addButton);

              // Verify the callback was called with correct data
              expect(capturedRelation).not.toBeNull();
              expect(capturedRelation!.habitId).toBe(currentHabit.id);
              expect(capturedRelation!.relatedHabitId).toBe(availableHabits[0].id);
              expect(capturedRelation!.relation).toBe(relationType);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Component integration: Removing relations via UI', () => {
      it('clicking delete button should trigger onRelationDelete with correct ID', () => {
        fc.assert(
          fc.property(
            habitsArrayArb,
            relationTypeArb,
            (habits, relationType) => {
              const currentHabit = habits[0];
              const relatedHabit = habits[1];

              // Create a relation to display
              const existingRelation: HabitRelation = {
                id: `relation-${Date.now()}`,
                habitId: currentHabit.id,
                relatedHabitId: relatedHabit.id,
                relation: relationType,
              };

              let capturedDeleteId: string | null = null;
              const handleRelationDelete = (id: string) => {
                capturedDeleteId = id;
              };

              const props = createDefaultProps({
                habit: currentHabit,
                allHabits: habits,
                relations: [existingRelation],
                onRelationDelete: handleRelationDelete,
              });

              const { container, unmount } = render(<DetailTab {...props} />);

              // Find and click the delete button
              const deleteButton = within(container).getByLabelText(`Remove relation with ${relatedHabit.name}`);
              fireEvent.click(deleteButton);

              // Verify the callback was called with correct ID
              expect(capturedDeleteId).toBe(existingRelation.id);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Component integration: Relation type support', () => {
      it('all relation types (main, sub, next) should be selectable', () => {
        const relationTypes: RelationType[] = ['main', 'sub', 'next'];

        fc.assert(
          fc.property(
            habitsArrayArb,
            fc.constantFrom(...relationTypes),
            (habits, relationType) => {
              const currentHabit = habits[0];
              const availableHabits = habits.slice(1);
              
              if (availableHabits.length === 0) return;

              let capturedRelation: Omit<HabitRelation, 'id' | 'createdAt' | 'updatedAt'> | null = null;
              const handleRelationAdd = (relation: Omit<HabitRelation, 'id' | 'createdAt' | 'updatedAt'>) => {
                capturedRelation = relation;
              };

              const props = createDefaultProps({
                habit: currentHabit,
                allHabits: habits,
                relations: [],
                onRelationAdd: handleRelationAdd,
              });

              const { container, unmount } = render(<DetailTab {...props} />);

              // Select a habit
              const habitSelector = within(container).getByLabelText('Select habit to relate');
              fireEvent.change(habitSelector, { target: { value: availableHabits[0].id } });

              // Select the relation type
              const typeSelector = within(container).getByLabelText('Select relation type');
              fireEvent.change(typeSelector, { target: { value: relationType } });

              // Click add
              const addButton = within(container).getByLabelText('Add relation');
              fireEvent.click(addButton);

              // Verify the relation type was captured correctly
              expect(capturedRelation).not.toBeNull();
              expect(capturedRelation!.relation).toBe(relationType);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
