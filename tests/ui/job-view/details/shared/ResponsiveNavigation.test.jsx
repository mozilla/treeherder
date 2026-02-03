/**
 * Unit tests for the ResponsiveNavigation component.
 *
 * This component handles responsive navigation by moving overflow items
 * into a dropdown menu when the container width is insufficient.
 *
 * Note: Some tests are limited because the component relies on ResizeObserver
 * and DOM measurements which behave differently in the test environment.
 */

import { render, screen } from '@testing-library/react';

import ResponsiveNavigation from '../../../../../ui/job-view/details/shared/ResponsiveNavigation';

// Mock ResizeObserver with a callback that can be triggered
let resizeCallback;
class MockResizeObserver {
  constructor(callback) {
    resizeCallback = callback;
  }

  observe() {
    // Trigger the callback immediately with empty entries
    resizeCallback([]);
  }

  unobserve() {}

  disconnect() {}
}

global.ResizeObserver = MockResizeObserver;

describe('ResponsiveNavigation', () => {
  describe('rendering', () => {
    it('renders with navigation role', () => {
      render(
        <ResponsiveNavigation>
          <button type="button">Item</button>
        </ResponsiveNavigation>,
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('applies default aria-label', () => {
      render(
        <ResponsiveNavigation>
          <button type="button">Item</button>
        </ResponsiveNavigation>,
      );

      expect(screen.getByRole('navigation')).toHaveAttribute(
        'aria-label',
        'Navigation',
      );
    });

    it('applies custom aria-label when provided', () => {
      render(
        <ResponsiveNavigation ariaLabel="Custom Navigation">
          <button type="button">Item</button>
        </ResponsiveNavigation>,
      );

      expect(screen.getByRole('navigation')).toHaveAttribute(
        'aria-label',
        'Custom Navigation',
      );
    });

    it('applies additional className when provided', () => {
      const { container } = render(
        <ResponsiveNavigation className="custom-class">
          <button type="button">Item</button>
        </ResponsiveNavigation>,
      );

      expect(container.querySelector('.responsive-navigation')).toHaveClass(
        'custom-class',
      );
    });

    it('has responsive-navigation and d-flex classes', () => {
      const { container } = render(
        <ResponsiveNavigation>
          <button type="button">Item</button>
        </ResponsiveNavigation>,
      );

      const nav = container.querySelector('.responsive-navigation');
      expect(nav).toHaveClass('d-flex');
      expect(nav).toHaveClass('align-items-center');
    });
  });

  describe('default props', () => {
    it('uses empty string for className when not provided', () => {
      const { container } = render(
        <ResponsiveNavigation>
          <button type="button">Item</button>
        </ResponsiveNavigation>,
      );

      // The className should have the base classes
      const nav = container.querySelector('.responsive-navigation');
      expect(nav.className).toContain('responsive-navigation');
    });

    it('defaults ariaLabel to "Navigation"', () => {
      render(
        <ResponsiveNavigation>
          <button type="button">Item</button>
        </ResponsiveNavigation>,
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Navigation');
    });
  });

  describe('container ref', () => {
    it('attaches ref to the navigation container', () => {
      const { container } = render(
        <ResponsiveNavigation>
          <button type="button">Item</button>
        </ResponsiveNavigation>,
      );

      // The container should exist and have correct role
      const nav = container.querySelector('.responsive-navigation');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('role', 'navigation');
    });
  });

  describe('overflow dropdown', () => {
    it('renders overflow dropdown button when items overflow', () => {
      // When ResizeObserver triggers with overflow, the dropdown appears
      // In our mock, items are moved to overflow immediately
      render(
        <ResponsiveNavigation>
          <button type="button">Item 1</button>
          <button type="button">Item 2</button>
        </ResponsiveNavigation>,
      );

      // The overflow dropdown should be present
      expect(
        screen.getByRole('button', { name: 'More navigation items' }),
      ).toBeInTheDocument();
    });

    it('overflow dropdown has correct title', () => {
      render(
        <ResponsiveNavigation>
          <button type="button">Item</button>
        </ResponsiveNavigation>,
      );

      const dropdownToggle = screen.getByTitle('More actions');
      expect(dropdownToggle).toBeInTheDocument();
    });
  });
});
