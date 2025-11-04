/**
 * ShareCookingSession Component Tests
 * Tests sharing functionality for completed cooking sessions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShareCookingSession from '../ShareCookingSession';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('ShareCookingSession Component', () => {
  const defaultProps = {
    sessionId: 'session-1',
    recipeId: 'recipe-1',
    recipeTitle: 'Vietnamese Pho',
    rating: 4,
    notes: 'Delicious recipe!',
    imageUrl: 'https://example.com/pho.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('Regular Share Button', () => {
    it('should render share button', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={false} />);

      const shareButton = screen.getByText('Share');
      expect(shareButton).toBeInTheDocument();
    });

    it('should store session data in sessionStorage when share is clicked', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={false} />);

      const shareButton = screen.getByText('Share');
      fireEvent.click(shareButton);

      const storedData = sessionStorage.getItem('share_cooking_session');
      expect(storedData).toBeTruthy();

      const parsedData = JSON.parse(storedData!);
      expect(parsedData).toEqual({
        session_id: 'session-1',
        recipe_id: 'recipe-1',
        recipe_title: 'Vietnamese Pho',
        rating: 4,
        notes: 'Delicious recipe!',
        image: 'https://example.com/pho.jpg',
      });
    });

    it('should navigate to feed page with share parameter', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={false} />);

      const shareButton = screen.getByText('Share');
      fireEvent.click(shareButton);

      expect(mockPush).toHaveBeenCalledWith('/feed?share=cooking');
    });

    it('should show sharing state when clicked', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={false} />);

      const shareButton = screen.getByText('Share');
      fireEvent.click(shareButton);

      expect(screen.getByText('Sharing...')).toBeInTheDocument();
    });

    it('should disable button while sharing', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={false} />);

      const shareButton = screen.getByText('Share');
      fireEvent.click(shareButton);

      expect(shareButton).toBeDisabled();
    });
  });

  describe('Auto-Suggestion Banner', () => {
    it('should show suggestion banner when autoSuggest is true and rating >= 4', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={true} rating={4} />);

      expect(screen.getByText('Great rating! Share your cooking experience?')).toBeInTheDocument();
      expect(screen.getByText(/You gave "Vietnamese Pho" 4 stars/)).toBeInTheDocument();
    });

    it('should show suggestion banner for 5-star rating', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={true} rating={5} />);

      expect(screen.getByText(/You gave "Vietnamese Pho" 5 stars/)).toBeInTheDocument();
    });

    it('should not show suggestion banner when rating < 4', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={true} rating={3} />);

      expect(screen.queryByText('Great rating! Share your cooking experience?')).not.toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument(); // Shows regular button instead
    });

    it('should not show suggestion banner when autoSuggest is false', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={false} rating={5} />);

      expect(screen.queryByText('Great rating! Share your cooking experience?')).not.toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
    });

    it('should share when "Share to Feed" button is clicked in banner', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={true} rating={4} />);

      const shareButton = screen.getByText('Share to Feed');
      fireEvent.click(shareButton);

      expect(mockPush).toHaveBeenCalledWith('/feed?share=cooking');
      
      const storedData = sessionStorage.getItem('share_cooking_session');
      expect(storedData).toBeTruthy();
    });

    it('should dismiss banner when "Maybe Later" is clicked', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={true} rating={4} />);

      const maybeLaterButton = screen.getByText('Maybe Later');
      fireEvent.click(maybeLaterButton);

      expect(screen.queryByText('Great rating! Share your cooking experience?')).not.toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument(); // Shows regular button
    });

    it('should dismiss banner when X button is clicked', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={true} rating={4} />);

      // Find the X button (close button)
      const closeButtons = screen.getAllByRole('button');
      const xButton = closeButtons.find(btn => 
        btn.querySelector('svg path[fill-rule="evenodd"]')
      );
      
      expect(xButton).toBeDefined();
      fireEvent.click(xButton!);

      expect(screen.queryByText('Great rating! Share your cooking experience?')).not.toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
    });

    it('should show sharing state in banner', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={true} rating={4} />);

      const shareButton = screen.getByText('Share to Feed');
      fireEvent.click(shareButton);

      expect(screen.getByText('Sharing...')).toBeInTheDocument();
    });
  });

  describe('Session Data Handling', () => {
    it('should handle missing optional fields', () => {
      const minimalProps = {
        sessionId: 'session-2',
        recipeId: 'recipe-2',
        recipeTitle: 'Simple Recipe',
      };

      render(<ShareCookingSession {...minimalProps} autoSuggest={false} />);

      const shareButton = screen.getByText('Share');
      fireEvent.click(shareButton);

      const storedData = sessionStorage.getItem('share_cooking_session');
      const parsedData = JSON.parse(storedData!);

      expect(parsedData).toEqual({
        session_id: 'session-2',
        recipe_id: 'recipe-2',
        recipe_title: 'Simple Recipe',
        rating: undefined,
        notes: undefined,
        image: undefined,
      });
    });

    it('should include all provided fields in session data', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={false} />);

      const shareButton = screen.getByText('Share');
      fireEvent.click(shareButton);

      const storedData = sessionStorage.getItem('share_cooking_session');
      const parsedData = JSON.parse(storedData!);

      expect(parsedData.session_id).toBe('session-1');
      expect(parsedData.recipe_id).toBe('recipe-1');
      expect(parsedData.recipe_title).toBe('Vietnamese Pho');
      expect(parsedData.rating).toBe(4);
      expect(parsedData.notes).toBe('Delicious recipe!');
      expect(parsedData.image).toBe('https://example.com/pho.jpg');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rating of exactly 4 stars', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={true} rating={4} />);

      expect(screen.getByText(/You gave "Vietnamese Pho" 4 stars/)).toBeInTheDocument();
    });

    it('should not show banner for rating of 3.9 stars', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={true} rating={3.9} />);

      expect(screen.queryByText('Great rating! Share your cooking experience?')).not.toBeInTheDocument();
    });

    it('should handle undefined rating', () => {
      render(<ShareCookingSession {...defaultProps} autoSuggest={true} rating={undefined} />);

      expect(screen.queryByText('Great rating! Share your cooking experience?')).not.toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
    });

    it('should handle long recipe titles', () => {
      const longTitleProps = {
        ...defaultProps,
        recipeTitle: 'Traditional Vietnamese Beef Pho with Homemade Bone Broth and Fresh Herbs',
      };

      render(<ShareCookingSession {...longTitleProps} autoSuggest={true} rating={5} />);

      expect(screen.getByText(/Traditional Vietnamese Beef Pho with Homemade Bone Broth and Fresh Herbs/)).toBeInTheDocument();
    });
  });
});
