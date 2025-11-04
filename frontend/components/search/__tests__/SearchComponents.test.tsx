/**
 * Search Components Tests
 * Tests IngredientInput and SectionCard components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import IngredientInput from '../IngredientInput';
import SectionCard from '../SectionCard';

// Mock PostCard component
jest.mock('../../posts/PostCard', () => {
  return function MockPostCard({ post }: any) {
    return <div data-testid={`post-${post.postId}`}>{post.title}</div>;
  };
});

describe('IngredientInput Component', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render input field with placeholder', () => {
    render(<IngredientInput value={[]} onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Nhập thành phần (VD: Cá Rô, Tiêu)');
    expect(input).toBeInTheDocument();
  });

  it('should render add button', () => {
    render(<IngredientInput value={[]} onChange={mockOnChange} />);
    
    const addButton = screen.getByRole('button', { name: /thêm/i });
    expect(addButton).toBeInTheDocument();
  });

  it('should handle text input', () => {
    render(<IngredientInput value={[]} onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Nhập thành phần (VD: Cá Rô, Tiêu)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Cá Rô' } });

    expect(input.value).toBe('Cá Rô');
  });

  it('should add ingredient when add button is clicked', () => {
    render(<IngredientInput value={[]} onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Nhập thành phần (VD: Cá Rô, Tiêu)');
    const addButton = screen.getByRole('button', { name: /thêm/i });

    fireEvent.change(input, { target: { value: 'Cá Rô' } });
    fireEvent.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith(['Cá Rô']);
  });

  it('should add ingredient when Enter key is pressed', () => {
    render(<IngredientInput value={[]} onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Nhập thành phần (VD: Cá Rô, Tiêu)');

    fireEvent.change(input, { target: { value: 'Tiêu' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(mockOnChange).toHaveBeenCalledWith(['Tiêu']);
  });

  it('should not add empty ingredient', () => {
    render(<IngredientInput value={[]} onChange={mockOnChange} />);
    
    const addButton = screen.getByRole('button', { name: /thêm/i });
    fireEvent.click(addButton);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should not add duplicate ingredient', () => {
    render(<IngredientInput value={['Cá Rô']} onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Nhập thành phần (VD: Cá Rô, Tiêu)');
    const addButton = screen.getByRole('button', { name: /thêm/i });

    fireEvent.change(input, { target: { value: 'Cá Rô' } });
    fireEvent.click(addButton);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should display existing ingredients as tags', () => {
    render(<IngredientInput value={['Cá Rô', 'Tiêu', 'Hành']} onChange={mockOnChange} />);
    
    expect(screen.getByText('Cá Rô')).toBeInTheDocument();
    expect(screen.getByText('Tiêu')).toBeInTheDocument();
    expect(screen.getByText('Hành')).toBeInTheDocument();
  });

  it('should remove ingredient when remove button is clicked', () => {
    render(<IngredientInput value={['Cá Rô', 'Tiêu']} onChange={mockOnChange} />);
    
    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith(['Tiêu']);
  });

  it('should clear input after adding ingredient', () => {
    const { rerender } = render(<IngredientInput value={[]} onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Nhập thành phần (VD: Cá Rô, Tiêu)') as HTMLInputElement;
    const addButton = screen.getByRole('button', { name: /thêm/i });

    fireEvent.change(input, { target: { value: 'Cá Rô' } });
    fireEvent.click(addButton);

    // Component clears its internal state after adding
    expect(input.value).toBe('');
  });

  it('should trim whitespace from ingredient', () => {
    render(<IngredientInput value={[]} onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Nhập thành phần (VD: Cá Rô, Tiêu)');
    const addButton = screen.getByRole('button', { name: /thêm/i });

    fireEvent.change(input, { target: { value: '  Cá Rô  ' } });
    fireEvent.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith(['Cá Rô']);
  });
});

describe('SectionCard Component', () => {
  const mockOnLoadPosts = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render section header with icon, title, and count', () => {
    render(
      <SectionCard
        icon="🏠"
        title="My Recipes"
        count={5}
        section="my"
        ingredients={['Cá Rô']}
        sortBy="date"
        onLoadPosts={mockOnLoadPosts}
      />
    );

    expect(screen.getByText(/🏠 My Recipes \(5\)/)).toBeInTheDocument();
  });

  it('should render expand button', () => {
    render(
      <SectionCard
        icon="🏠"
        title="My Recipes"
        count={5}
        section="my"
        ingredients={['Cá Rô']}
        sortBy="date"
        onLoadPosts={mockOnLoadPosts}
      />
    );

    expect(screen.getByText('Xem >')).toBeInTheDocument();
  });

  it('should expand section when header is clicked', async () => {
    render(
      <SectionCard
        icon="🏠"
        title="My Recipes"
        count={5}
        section="my"
        ingredients={['Cá Rô']}
        sortBy="date"
        onLoadPosts={mockOnLoadPosts}
      />
    );

    const header = screen.getByText(/🏠 My Recipes \(5\)/).closest('div');
    fireEvent.click(header!);

    await waitFor(() => {
      expect(mockOnLoadPosts).toHaveBeenCalledWith('my', 1);
    });
  });

  it('should show loading state when expanding', async () => {
    mockOnLoadPosts.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10)));

    render(
      <SectionCard
        icon="🏠"
        title="My Recipes"
        count={5}
        section="my"
        ingredients={['Cá Rô']}
        sortBy="date"
        onLoadPosts={mockOnLoadPosts}
      />
    );

    const header = screen.getByText(/🏠 My Recipes \(5\)/).closest('div');
    fireEvent.click(header!);

    await waitFor(() => {
      expect(screen.getByText('Đang tải...')).toBeInTheDocument();
    });
  });

  it('should show empty state when no posts are found', async () => {
    mockOnLoadPosts.mockResolvedValue(undefined);

    render(
      <SectionCard
        icon="🏠"
        title="My Recipes"
        count={0}
        section="my"
        ingredients={['Cá Rô']}
        sortBy="date"
        onLoadPosts={mockOnLoadPosts}
      />
    );

    const header = screen.getByText(/🏠 My Recipes \(0\)/).closest('div');
    fireEvent.click(header!);

    await waitFor(() => {
      expect(screen.getByText('Không có món ăn nào')).toBeInTheDocument();
    });
  });

  it('should collapse section when close button is clicked', async () => {
    render(
      <SectionCard
        icon="🏠"
        title="My Recipes"
        count={5}
        section="my"
        ingredients={['Cá Rô']}
        sortBy="date"
        onLoadPosts={mockOnLoadPosts}
      />
    );

    // Expand first
    const header = screen.getByText(/🏠 My Recipes \(5\)/).closest('div');
    fireEvent.click(header!);

    await waitFor(() => {
      expect(screen.getByText('Đóng')).toBeInTheDocument();
    });

    // Then collapse
    const closeButton = screen.getByText('Đóng');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Đóng')).not.toBeInTheDocument();
    });
  });

  it('should handle error when loading posts fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockOnLoadPosts.mockRejectedValue(new Error('Failed to load'));

    render(
      <SectionCard
        icon="🏠"
        title="My Recipes"
        count={5}
        section="my"
        ingredients={['Cá Rô']}
        sortBy="date"
        onLoadPosts={mockOnLoadPosts}
      />
    );

    const header = screen.getByText(/🏠 My Recipes \(5\)/).closest('div');
    fireEvent.click(header!);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load posts:', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  });
});
