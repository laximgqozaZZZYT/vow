/**
 * Unit tests for ExpandButton Component
 * 
 * Tests the expand/collapse button for Habit cards in the Kanban board.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 * - 2.1: WHEN a Habit has one or more associated Sticky_n items, THE Habit_Card SHALL display an Expand_Button
 * - 2.2: WHEN a Habit has no associated Sticky_n items, THE Habit_Card SHALL NOT display an Expand_Button
 * - 2.3: THE Expand_Button SHALL display [▼] when collapsed and [▲] when expanded
 * - 2.4: THE Expand_Button SHALL have a minimum touch target of 44x44 pixels for accessibility
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpandButton, type ExpandButtonProps } from '../../app/dashboard/components/Board.ExpandButton';

describe('ExpandButton', () => {
  const defaultProps: ExpandButtonProps = {
    isExpanded: false,
    onClick: jest.fn(),
    count: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Visibility based on count', () => {
    /**
     * **Validates: Requirement 2.1**
     * WHEN a Habit has one or more associated Sticky_n items, THE Habit_Card SHALL display an Expand_Button
     */
    it('should render when count is greater than 0', () => {
      render(<ExpandButton {...defaultProps} count={1} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should render when count is 5', () => {
      render(<ExpandButton {...defaultProps} count={5} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    /**
     * **Validates: Requirement 2.2**
     * WHEN a Habit has no associated Sticky_n items, THE Habit_Card SHALL NOT display an Expand_Button
     */
    it('should not render when count is 0', () => {
      render(<ExpandButton {...defaultProps} count={0} />);
      
      const button = screen.queryByRole('button');
      expect(button).not.toBeInTheDocument();
    });

    it('should not render when count is negative', () => {
      render(<ExpandButton {...defaultProps} count={-1} />);
      
      const button = screen.queryByRole('button');
      expect(button).not.toBeInTheDocument();
    });
  });

  describe('Icon display based on expanded state', () => {
    /**
     * **Validates: Requirement 2.3**
     * THE Expand_Button SHALL display [▼] when collapsed and [▲] when expanded
     */
    it('should display ▼ when collapsed (isExpanded=false)', () => {
      render(<ExpandButton {...defaultProps} isExpanded={false} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('▼');
      expect(button).not.toHaveTextContent('▲');
    });

    it('should display ▲ when expanded (isExpanded=true)', () => {
      render(<ExpandButton {...defaultProps} isExpanded={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('▲');
      expect(button).not.toHaveTextContent('▼');
    });
  });

  describe('Touch target accessibility', () => {
    /**
     * **Validates: Requirement 2.4**
     * THE Expand_Button SHALL have a minimum touch target of 44x44 pixels for accessibility
     */
    it('should have min-w-[44px] class for minimum width', () => {
      render(<ExpandButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button.className).toContain('min-w-[44px]');
    });

    it('should have min-h-[44px] class for minimum height', () => {
      render(<ExpandButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button.className).toContain('min-h-[44px]');
    });
  });

  describe('Click behavior', () => {
    it('should call onClick when clicked', () => {
      const mockOnClick = jest.fn();
      render(<ExpandButton {...defaultProps} onClick={mockOnClick} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should stop event propagation when clicked', () => {
      const mockOnClick = jest.fn();
      const mockParentClick = jest.fn();
      
      render(
        <div onClick={mockParentClick}>
          <ExpandButton {...defaultProps} onClick={mockOnClick} />
        </div>
      );
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockParentClick).not.toHaveBeenCalled();
    });
  });

  describe('Count badge display', () => {
    it('should display the count in the badge', () => {
      render(<ExpandButton {...defaultProps} count={7} />);
      
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('should display count of 1', () => {
      render(<ExpandButton {...defaultProps} count={1} />);
      
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should display large count numbers', () => {
      render(<ExpandButton {...defaultProps} count={99} />);
      
      expect(screen.getByText('99')).toBeInTheDocument();
    });
  });

  describe('Accessibility attributes', () => {
    it('should have aria-expanded attribute set to false when collapsed', () => {
      render(<ExpandButton {...defaultProps} isExpanded={false} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have aria-expanded attribute set to true when expanded', () => {
      render(<ExpandButton {...defaultProps} isExpanded={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have aria-label for collapsed state', () => {
      render(<ExpandButton {...defaultProps} isExpanded={false} count={3} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'サブタスクを展開 (3件)');
    });

    it('should have aria-label for expanded state', () => {
      render(<ExpandButton {...defaultProps} isExpanded={true} count={3} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'サブタスクを折りたたむ (3件)');
    });

    it('should have title attribute for collapsed state', () => {
      render(<ExpandButton {...defaultProps} isExpanded={false} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'サブタスクを展開');
    });

    it('should have title attribute for expanded state', () => {
      render(<ExpandButton {...defaultProps} isExpanded={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'サブタスクを折りたたむ');
    });

    it('should have type="button" attribute', () => {
      render(<ExpandButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('Styling', () => {
    it('should have focus-visible outline classes for keyboard accessibility', () => {
      render(<ExpandButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button.className).toContain('focus-visible:outline');
    });

    it('should have transition classes for smooth interactions', () => {
      render(<ExpandButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button.className).toContain('transition');
    });

    it('should use design system color tokens', () => {
      render(<ExpandButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      // Should use semantic colors from design system
      expect(button.className).toContain('text-muted-foreground');
      expect(button.className).toContain('bg-muted');
    });
  });
});
