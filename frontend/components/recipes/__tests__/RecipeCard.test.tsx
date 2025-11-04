/**
 * RecipeCard Component Tests
 * Tests recipe card rendering, recipe details display, and interactions
 */

import React from 'react';
import { screen, fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecipeCard from '../RecipeCard';
import { mockRecipes } from '../../../__tests__/test-utils/test-data';

describe('RecipeCard Component - Recipe Details Rendering', () => {
  it('should render recipe title correctly', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    expect(screen.getByText(mockRecipes.recipe1.title)).toBeInTheDocument();
  });

  it('should render recipe description when available', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    expect(screen.getByText(mockRecipes.recipe1.description)).toBeInTheDocument();
  });

  it('should display recipe image when image_url is provided', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    const image = screen.getByAltText(mockRecipes.recipe1.title);
    expect(image).toHaveAttribute('src', mockRecipes.recipe1.image_url);
  });

  it('should show placeholder when no image_url provided', () => {
    const mockOnClick = jest.fn();
    const recipeWithoutImage = { ...mockRecipes.recipe2, image_url: undefined };

    render(
      <RecipeCard recipe={recipeWithoutImage} onClick={mockOnClick} />
    );

    // Should show SVG placeholder - check for the SVG element
    const container = screen.getByText(recipeWithoutImage.title).closest('div');
    const svg = container?.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should display cooking method badge with correct label', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    // Recipe1 has cooking_method: 'simmer' which should display as 'Kho/Rim'
    expect(screen.getByText('Kho/Rim')).toBeInTheDocument();
  });

  it('should display total cooking time', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    // Recipe1: prep_time_minutes: 30 + cook_time_minutes: 370 = 400 minutes = 6 giờ 40 phút
    expect(screen.getByText(/6 giờ 40 phút/i)).toBeInTheDocument();
  });

  it('should display servings count', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    expect(screen.getByText(/4 người/i)).toBeInTheDocument();
  });
});

describe('RecipeCard Component - Ingredient List Display', () => {
  it('should display ingredient count correctly', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    // Recipe1 has 5 ingredients
    expect(screen.getByText(/5 nguyên liệu/i)).toBeInTheDocument();
  });

  it('should display correct ingredient count for different recipes', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe2} onClick={mockOnClick} />
    );

    // Recipe2 has 5 ingredients
    expect(screen.getByText(/5 nguyên liệu/i)).toBeInTheDocument();
  });
});

describe('RecipeCard Component - Source Badge', () => {
  it('should show AI badge for AI-generated recipes', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe2} onClick={mockOnClick} />
    );

    expect(screen.getByText('🤖 AI')).toBeInTheDocument();
  });

  it('should show database badge for non-AI recipes', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    expect(screen.getByText('📚 DB')).toBeInTheDocument();
  });
});

describe('RecipeCard Component - Basic Rendering', () => {
  it('should render recipe without errors', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe2} onClick={mockOnClick} />
    );

    expect(screen.getByText(mockRecipes.recipe2.title)).toBeInTheDocument();
  });
});

describe('RecipeCard Component - Nutritional Info', () => {
  it('should display calories when nutritional info is available', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    expect(screen.getByText('450 kcal')).toBeInTheDocument();
  });

  it('should not display nutritional section when not available', () => {
    const mockOnClick = jest.fn();
    const recipeWithoutNutrition = { ...mockRecipes.recipe2, nutritional_info: undefined };

    render(
      <RecipeCard recipe={recipeWithoutNutrition} onClick={mockOnClick} />
    );

    expect(screen.queryByText(/kcal/i)).not.toBeInTheDocument();
  });
});

describe('RecipeCard Component - Click Interaction', () => {
  it('should call onClick when card is clicked', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    const card = screen.getByText(mockRecipes.recipe1.title).closest('div');
    if (card) {
      fireEvent.click(card);
      expect(mockOnClick).toHaveBeenCalled();
    }
  });

  it('should have cursor pointer style to indicate clickability', () => {
    const mockOnClick = jest.fn();

    const { container } = render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    const card = container.querySelector('.cursor-pointer');
    expect(card).toBeInTheDocument();
  });
});

describe('RecipeCard Component - Time Formatting', () => {
  it('should format time correctly for recipes under 60 minutes', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe2} onClick={mockOnClick} />
    );

    // Recipe2: prep_time_minutes: 20 + cook_time_minutes: 25 = 45 minutes
    expect(screen.getByText(/45 phút/i)).toBeInTheDocument();
  });

  it('should format time correctly for recipes over 60 minutes', () => {
    const mockOnClick = jest.fn();

    render(
      <RecipeCard recipe={mockRecipes.recipe1} onClick={mockOnClick} />
    );

    // Recipe1: 400 minutes = 6 giờ 40 phút
    expect(screen.getByText(/6 giờ 40 phút/i)).toBeInTheDocument();
  });
});
