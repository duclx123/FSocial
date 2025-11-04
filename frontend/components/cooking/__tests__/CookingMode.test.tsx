/**
 * CookingMode Component Tests
 * Tests cooking mode rendering, step navigation, and timer functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CookingMode from '../CookingMode';
import { Recipe } from '@/types/recipe';

// Mock recipe data
const mockRecipe: Recipe = {
  recipe_id: 'recipe-1',
  user_id: 'user-1',
  title: 'Vietnamese Pho',
  description: 'Traditional Vietnamese beef noodle soup',
  cuisine_type: 'vietnamese',
  cooking_method: 'simmer',
  meal_type: 'lunch',
  prep_time_minutes: 30,
  cook_time_minutes: 370,
  servings: 4,
  ingredients: [
    { ingredient_name: 'rice noodles', quantity: '500', unit: 'g' },
    { ingredient_name: 'beef broth', quantity: '2', unit: 'L' },
    { ingredient_name: 'beef slices', quantity: '300', unit: 'g' },
  ],
  instructions: [
    { 
      step_number: 1, 
      description: 'Prepare broth by simmering bones',
      duration_minutes: 10,
      tips: 'Use low heat for best results'
    },
    { 
      step_number: 2, 
      description: 'Cook rice noodles',
      duration_minutes: 5
    },
    { 
      step_number: 3, 
      description: 'Assemble bowl with noodles and toppings'
    },
  ],
  is_public: true,
  is_ai_generated: false,
  is_approved: true,
  created_at: '2025-01-10T00:00:00.000Z',
  updated_at: '2025-01-10T00:00:00.000Z',
};

describe('CookingMode Component', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it('should render cooking mode with recipe data', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText(mockRecipe.title)).toBeInTheDocument();
    expect(screen.getByText('Prepare broth by simmering bones')).toBeInTheDocument();
    expect(screen.getByText('Bước 1/3')).toBeInTheDocument();
  });

  it('should display current step number and progress', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('Bước 1/3')).toBeInTheDocument();
    expect(screen.getByText('0/3 hoàn thành')).toBeInTheDocument();
  });

  it('should display step tips when available', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText(/Use low heat for best results/)).toBeInTheDocument();
  });

  it('should display ingredients list', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('rice noodles')).toBeInTheDocument();
    expect(screen.getByText('500 g')).toBeInTheDocument();
    expect(screen.getByText('beef broth')).toBeInTheDocument();
  });

  it('should navigate to next step when next button is clicked', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    const nextButton = screen.getByText('Bước tiếp theo');
    fireEvent.click(nextButton);

    expect(screen.getByText('Cook rice noodles')).toBeInTheDocument();
    expect(screen.getByText('Bước 2/3')).toBeInTheDocument();
    expect(screen.getByText('1/3 hoàn thành')).toBeInTheDocument();
  });

  it('should navigate to previous step when previous button is clicked', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // Go to step 2
    const nextButton = screen.getByText('Bước tiếp theo');
    fireEvent.click(nextButton);
    expect(screen.getByText('Cook rice noodles')).toBeInTheDocument();

    // Go back to step 1
    const prevButton = screen.getByText('Bước trước');
    fireEvent.click(prevButton);
    expect(screen.getByText('Prepare broth by simmering bones')).toBeInTheDocument();
    expect(screen.getByText('Bước 1/3')).toBeInTheDocument();
  });

  it('should disable previous button on first step', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    const prevButton = screen.getByText('Bước trước');
    expect(prevButton).toBeDisabled();
  });

  it('should show completion screen when last step is completed', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // Complete all steps
    const nextButton = screen.getByText('Bước tiếp theo');
    fireEvent.click(nextButton); // Step 2
    fireEvent.click(screen.getByText('Bước tiếp theo')); // Step 3
    
    const completeButton = screen.getByText('Hoàn thành');
    fireEvent.click(completeButton);

    expect(screen.getByText('Hoàn thành!')).toBeInTheDocument();
    expect(screen.getByText(/Bạn đã nấu xong món Vietnamese Pho/)).toBeInTheDocument();
  });

  it('should call onComplete when completion button is clicked', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // Complete all steps
    fireEvent.click(screen.getByText('Bước tiếp theo')); // Step 2
    fireEvent.click(screen.getByText('Bước tiếp theo')); // Step 3
    fireEvent.click(screen.getByText('Hoàn thành')); // Complete

    // Click the final completion button
    const finalCompleteButton = screen.getAllByText('Hoàn thành')[0];
    fireEvent.click(finalCompleteButton);

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    const cancelButton = screen.getByRole('button', { name: '' }); // X button
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should auto-start timer when step has duration_minutes', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // First step has 10 minutes duration, should auto-start
    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByText(/đang đếm ngược/)).toBeInTheDocument();
  });

  it('should countdown timer correctly', () => {
    const { rerender } = render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // Initial time: 10:00
    expect(screen.getByText('10:00')).toBeInTheDocument();

    // Advance timer by 1 second and force re-render
    jest.advanceTimersByTime(1000);
    rerender(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );
    
    // Timer should have counted down (checking for 9:5x pattern)
    const timerElement = screen.getByText(/\d+:\d+/);
    expect(timerElement.textContent).toMatch(/9:5\d/);
  });

  it('should stop timer when stop button is clicked', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    const stopButton = screen.getByText('Dừng hẹn giờ');
    fireEvent.click(stopButton);

    // Timer should stop counting
    const currentTime = screen.getByText(/\d+:\d+/).textContent;
    jest.advanceTimersByTime(5000);
    expect(screen.getByText(currentTime!)).toBeInTheDocument();
  });

  it('should allow setting custom timer durations', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // Stop the auto-started timer first
    fireEvent.click(screen.getByText('Dừng hẹn giờ'));

    // Set 5 minute timer
    const fiveMinButton = screen.getByText('5m');
    fireEvent.click(fiveMinButton);

    expect(screen.getByText('5:00')).toBeInTheDocument();
  });

  it('should reset timer when navigating to next step', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // First step has timer running
    expect(screen.getByText('10:00')).toBeInTheDocument();

    // Go to next step
    fireEvent.click(screen.getByText('Bước tiếp theo'));

    // Second step should have its own timer (5 minutes)
    expect(screen.getByText('5:00')).toBeInTheDocument();
  });

  it('should show no timer for steps without duration_minutes', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // Navigate to step 3 (no duration)
    fireEvent.click(screen.getByText('Bước tiếp theo')); // Step 2
    fireEvent.click(screen.getByText('Bước tiếp theo')); // Step 3

    expect(screen.getByText('--:--')).toBeInTheDocument();
  });

  it('should update progress bar as steps are completed', () => {
    render(
      <CookingMode 
        recipe={mockRecipe} 
        onComplete={mockOnComplete} 
        onCancel={mockOnCancel} 
      />
    );

    // Initial progress: 0%
    const progressBar = document.querySelector('.bg-green-600');
    expect(progressBar).toHaveStyle({ width: '0%' });

    // Complete step 1 (1/3 = 33.33%)
    fireEvent.click(screen.getByText('Bước tiếp theo'));
    const width1 = (progressBar as HTMLElement).style.width;
    expect(parseFloat(width1)).toBeCloseTo(33.33, 1);

    // Complete step 2 (2/3 = 66.67%)
    fireEvent.click(screen.getByText('Bước tiếp theo'));
    const width2 = (progressBar as HTMLElement).style.width;
    expect(parseFloat(width2)).toBeCloseTo(66.67, 1);
  });
});
