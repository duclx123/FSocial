/**
 * RecipeDetailModal Component Tests
 * Tests recipe detail view in modal
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecipeDetailModal from '../RecipeDetailModal';
import { Recipe } from '@/types/recipe';

describe('RecipeDetailModal Component', () => {
  const mockRecipe: Recipe = {
    recipe_id: 'recipe-123',
    title: 'Phở Bò',
    description: 'Traditional Vietnamese beef noodle soup',
    cuisine_type: 'vietnamese',
    cooking_method: 'boil',
    meal_type: 'lunch',
    ingredients: [
      {
        ingredient_name: 'Beef',
        quantity: '500',
        unit: 'g',
      },
    ],
    instructions: [
      { step_number: 1, description: 'Boil water' },
      { step_number: 2, description: 'Add beef' },
      { step_number: 3, description: 'Add noodles' }
    ],
    prep_time_minutes: 30,
    cook_time_minutes: 120,
    servings: 4,
    is_public: true,
    is_ai_generated: false,
    is_approved: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render recipe title', () => {
    render(
      <RecipeDetailModal
        recipe={mockRecipe}
        isOpen={true}
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText('Phở Bò')).toBeInTheDocument();
  });

  it('should render recipe description', () => {
    render(
      <RecipeDetailModal
        recipe={mockRecipe}
        isOpen={true}
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText('Traditional Vietnamese beef noodle soup')).toBeInTheDocument();
  });

  it('should display ingredients list', () => {
    render(
      <RecipeDetailModal
        recipe={mockRecipe}
        isOpen={true}
        onClose={mockOnClose}
      />
    );
    // Use getAllByText since "Beef" appears in both description and ingredients
    const beefElements = screen.getAllByText(/Beef/i);
    expect(beefElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/500.*g/i)).toBeInTheDocument();
  });

  it('should display cooking method', () => {
    render(
      <RecipeDetailModal
        recipe={mockRecipe}
        isOpen={true}
        onClose={mockOnClose}
      />
    );
    // Check for cooking method label (Vietnamese)
    expect(screen.getByText(/Luộc/i)).toBeInTheDocument();
  });

  it('should display cooking times', () => {
    render(
      <RecipeDetailModal
        recipe={mockRecipe}
        isOpen={true}
        onClose={mockOnClose}
      />
    );
    // Check for Vietnamese time labels - use getAllByText since times appear multiple times
    const timeElements = screen.getAllByText(/30.*phút/i);
    expect(timeElements.length).toBeGreaterThan(0);
    const cookTimeElements = screen.getAllByText(/2.*giờ/i);
    expect(cookTimeElements.length).toBeGreaterThan(0);
  });

  it('should call onClose when close button is clicked', () => {
    render(
      <RecipeDetailModal
        recipe={mockRecipe}
        isOpen={true}
        onClose={mockOnClose}
      />
    );
    
    // Get the close button by finding the button with X icon
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons[0]; // First button is the close button
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <RecipeDetailModal
        recipe={mockRecipe}
        isOpen={false}
        onClose={mockOnClose}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should display servings information', () => {
    render(
      <RecipeDetailModal
        recipe={mockRecipe}
        isOpen={true}
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
