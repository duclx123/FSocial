/**
 * UI Components Tests
 * Tests Toast and ConfirmDialog components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Toast from '../Toast';
import ConfirmDialog from '../ConfirmDialog';

describe('Toast Component', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it('should render toast with message', () => {
    render(<Toast message="Test message" onClose={mockOnClose} />);
    
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should render success toast by default', () => {
    const { container } = render(<Toast message="Success message" onClose={mockOnClose} />);
    
    const toastElement = container.querySelector('.bg-green-500');
    expect(toastElement).toBeInTheDocument();
  });

  it('should render error toast when type is error', () => {
    const { container } = render(<Toast message="Error message" type="error" onClose={mockOnClose} />);
    
    const toastElement = container.querySelector('.bg-red-500');
    expect(toastElement).toBeInTheDocument();
  });

  it('should render info toast when type is info', () => {
    const { container } = render(<Toast message="Info message" type="info" onClose={mockOnClose} />);
    
    const toastElement = container.querySelector('.bg-blue-500');
    expect(toastElement).toBeInTheDocument();
  });

  it('should auto-dismiss after default duration', () => {
    render(<Toast message="Auto dismiss" onClose={mockOnClose} />);
    
    expect(mockOnClose).not.toHaveBeenCalled();
    
    // Fast-forward time by 3000ms (default duration)
    jest.advanceTimersByTime(3000);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should auto-dismiss after custom duration', () => {
    render(<Toast message="Custom duration" onClose={mockOnClose} duration={5000} />);
    
    expect(mockOnClose).not.toHaveBeenCalled();
    
    // Fast-forward time by 5000ms
    jest.advanceTimersByTime(5000);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when close button is clicked', () => {
    render(<Toast message="Closeable toast" onClose={mockOnClose} />);
    
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => 
      btn.querySelector('path[d*="M6 18L18 6M6 6l12 12"]')
    );
    
    expect(closeButton).toBeInTheDocument();
    
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should display success icon for success type', () => {
    const { container } = render(<Toast message="Success" type="success" onClose={mockOnClose} />);
    
    const successIcon = container.querySelector('path[d*="M5 13l4 4L19 7"]');
    expect(successIcon).toBeInTheDocument();
  });

  it('should display error icon for error type', () => {
    const { container } = render(<Toast message="Error" type="error" onClose={mockOnClose} />);
    
    const errorIcon = container.querySelector('path[d*="M6 18L18 6M6 6l12 12"]');
    expect(errorIcon).toBeInTheDocument();
  });

  it('should display info icon for info type', () => {
    const { container } = render(<Toast message="Info" type="info" onClose={mockOnClose} />);
    
    const infoIcon = container.querySelector('path[d*="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"]');
    expect(infoIcon).toBeInTheDocument();
  });

  it('should clear timer on unmount', () => {
    const { unmount } = render(<Toast message="Unmount test" onClose={mockOnClose} />);
    
    unmount();
    
    // Fast-forward time after unmount
    jest.advanceTimersByTime(3000);
    
    // onClose should not be called after unmount
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog Component', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render confirm dialog with title and message', () => {
    render(
      <ConfirmDialog
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('should render default confirm and cancel buttons', () => {
    render(
      <ConfirmDialog
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText('Xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Hủy')).toBeInTheDocument();
  });

  it('should render custom confirm and cancel text', () => {
    render(
      <ConfirmDialog
        title="Delete Item"
        message="Delete this item?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', () => {
    render(
      <ConfirmDialog
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    
    const confirmButton = screen.getByText('Xác nhận');
    fireEvent.click(confirmButton);
    
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <ConfirmDialog
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    
    const cancelButton = screen.getByText('Hủy');
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('should render danger type with red button by default', () => {
    const { container } = render(
      <ConfirmDialog
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    
    const confirmButton = container.querySelector('.bg-red-600');
    expect(confirmButton).toBeInTheDocument();
  });

  it('should render warning type with yellow button', () => {
    const { container } = render(
      <ConfirmDialog
        title="Warning"
        message="This is a warning"
        type="warning"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    
    const confirmButton = container.querySelector('.bg-yellow-600');
    expect(confirmButton).toBeInTheDocument();
  });

  it('should render info type with blue button', () => {
    const { container } = render(
      <ConfirmDialog
        title="Information"
        message="This is info"
        type="info"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    
    const confirmButton = container.querySelector('.bg-blue-600');
    expect(confirmButton).toBeInTheDocument();
  });

  it('should display danger icon for danger type', () => {
    const { container } = render(
      <ConfirmDialog
        title="Danger"
        message="This is dangerous"
        type="danger"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    
    const dangerIcon = container.querySelector('.bg-red-100');
    expect(dangerIcon).toBeInTheDocument();
  });
});
