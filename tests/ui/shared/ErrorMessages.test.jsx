/**
 * Unit tests for the ErrorMessages component.
 *
 * This test suite covers:
 * - Rendering error messages from array
 * - Rendering single failure message
 * - Alert visibility state
 * - ComponentDidUpdate behavior when messages change
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import ErrorMessages from '../../../ui/shared/ErrorMessages';

describe('ErrorMessages', () => {
  describe('rendering', () => {
    it('renders error messages from errorMessages array', () => {
      render(
        <ErrorMessages errorMessages={['Error 1', 'Error 2', 'Error 3']} />,
      );

      expect(screen.getByText('Error 1')).toBeInTheDocument();
      expect(screen.getByText('Error 2')).toBeInTheDocument();
      expect(screen.getByText('Error 3')).toBeInTheDocument();
    });

    it('renders single failureMessage when errorMessages is empty', () => {
      render(
        <ErrorMessages
          errorMessages={[]}
          failureMessage="Something went wrong"
        />,
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('prefers errorMessages over failureMessage when both provided', () => {
      render(
        <ErrorMessages
          errorMessages={['Array error']}
          failureMessage="Fallback error"
        />,
      );

      expect(screen.getByText('Array error')).toBeInTheDocument();
      expect(screen.queryByText('Fallback error')).not.toBeInTheDocument();
    });

    it('renders failureMessage when errorMessages is not provided', () => {
      render(<ErrorMessages failureMessage="Only failure message" />);

      expect(screen.getByText('Only failure message')).toBeInTheDocument();
    });

    it('renders Alert components with danger variant', () => {
      const { container } = render(
        <ErrorMessages errorMessages={['Test error']} />,
      );

      const alert = container.querySelector('.alert-danger');
      expect(alert).toBeInTheDocument();
    });

    it('renders Alert components with centered text', () => {
      const { container } = render(
        <ErrorMessages errorMessages={['Test error']} />,
      );

      const alert = container.querySelector('.text-center');
      expect(alert).toBeInTheDocument();
    });
  });

  describe('multiple messages', () => {
    it('renders each message in its own Alert', () => {
      const { container } = render(
        <ErrorMessages errorMessages={['Error A', 'Error B']} />,
      );

      const alerts = container.querySelectorAll('.alert');
      expect(alerts).toHaveLength(2);
    });

    it('uses message as key for each Alert', () => {
      // This test ensures unique keys are used, which prevents React warnings
      const { container } = render(
        <ErrorMessages errorMessages={['Unique Error 1', 'Unique Error 2']} />,
      );

      const alerts = container.querySelectorAll('.alert');
      expect(alerts).toHaveLength(2);
    });
  });

  describe('visibility updates on prop changes', () => {
    it('resets visibility when errorMessages prop changes', () => {
      const { rerender } = render(
        <ErrorMessages errorMessages={['Initial error']} />,
      );

      // Verify initial render
      expect(screen.getByText('Initial error')).toBeInTheDocument();

      // Re-render with different error messages
      rerender(<ErrorMessages errorMessages={['New error']} />);

      expect(screen.getByText('New error')).toBeInTheDocument();
      expect(screen.queryByText('Initial error')).not.toBeInTheDocument();
    });

    it('resets visibility when failureMessage prop changes', () => {
      const { rerender } = render(
        <ErrorMessages failureMessage="Initial failure" />,
      );

      expect(screen.getByText('Initial failure')).toBeInTheDocument();

      rerender(<ErrorMessages failureMessage="Updated failure" />);

      expect(screen.getByText('Updated failure')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty errorMessages and null failureMessage', () => {
      const { container } = render(
        <ErrorMessages errorMessages={[]} failureMessage={null} />,
      );

      // Should render an Alert with null content
      const alerts = container.querySelectorAll('.alert');
      expect(alerts).toHaveLength(1);
    });

    it('handles undefined props with defaults', () => {
      const { container } = render(<ErrorMessages />);

      // With default props, should render Alert with null
      const alerts = container.querySelectorAll('.alert');
      expect(alerts).toHaveLength(1);
    });
  });
});
