import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SkeletonBoard from '../components/layout/SkeletonBoard';

describe('SkeletonBoard', () => {
  it('renders (container is not empty)', () => {
    const { container } = render(<SkeletonBoard />);
    expect(container.innerHTML).not.toBe('');
  });

  it('renders 7 column skeletons', () => {
    const { container } = render(<SkeletonBoard />);

    // Each column contains elements with the 'ai-skeleton' class.
    // The top-level flex container has 7 direct children (one per column).
    const columns = container.querySelectorAll('.ai-skeleton');
    // Each of the 7 columns has at least one ai-skeleton element,
    // so there should be 7 or more elements with that class.
    // More precisely: each column has a header icon skeleton, a header text skeleton,
    // a divider skeleton, and card skeletons — but the requirement is to verify
    // there are 7 column skeletons. We check the 7 top-level column containers.
    const columnContainers = container.querySelector('.flex-1.flex.gap-3')?.children;
    expect(columnContainers).toBeDefined();
    expect(columnContainers!.length).toBe(7);

    // Also verify ai-skeleton elements are present
    expect(columns.length).toBeGreaterThan(0);
  });
});
