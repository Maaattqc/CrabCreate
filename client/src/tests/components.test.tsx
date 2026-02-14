import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationToast from '../components/layout/NotificationToast';
import type { Notification } from '../types';

describe('NotificationToast', () => {
  const mockNotifications: Notification[] = [
    { id: 1, message: 'Success!', type: 'success' },
    { id: 2, message: 'Error occurred', type: 'error' },
  ];

  it('renders nothing when no notifications', () => {
    const { container } = render(<NotificationToast notifications={[]} onRemove={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders notifications', () => {
    render(<NotificationToast notifications={mockNotifications} onRemove={() => {}} />);
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  it('calls onRemove when close button clicked', () => {
    const onRemove = vi.fn();
    render(<NotificationToast notifications={[mockNotifications[0]]} onRemove={onRemove} />);

    const closeButtons = screen.getAllByRole('button');
    fireEvent.click(closeButtons[0]);

    expect(onRemove).toHaveBeenCalledWith(1);
  });
});
