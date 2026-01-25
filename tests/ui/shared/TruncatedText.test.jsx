/**
 * Unit tests for the TruncatedText component.
 *
 * This test suite covers:
 * - Rendering text with truncation
 * - Show more/less toggle functionality
 * - Title display
 * - Color variant options
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import TruncatedText from '../../../ui/shared/TruncatedText';

describe('TruncatedText', () => {
  const shortText = 'Short text';
  const longText = 'A'.repeat(200);

  describe('rendering', () => {
    it('renders the text content', () => {
      render(<TruncatedText text={shortText} maxLength={100} />);

      expect(screen.getByText(shortText)).toBeInTheDocument();
    });

    it('renders title when provided', () => {
      render(
        <TruncatedText text={shortText} maxLength={100} title="Test Title" />,
      );

      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('does not render title when not provided', () => {
      const { container } = render(
        <TruncatedText text={shortText} maxLength={100} />,
      );

      expect(
        container.querySelector('.font-weight-bold'),
      ).not.toBeInTheDocument();
    });

    it('applies text-truncate class by default', () => {
      const { container } = render(
        <TruncatedText text={shortText} maxLength={100} />,
      );

      expect(container.querySelector('p')).toHaveClass('text-truncate');
    });
  });

  describe('show more/less button', () => {
    it('does not show button when text is shorter than maxLength', () => {
      render(<TruncatedText text={shortText} maxLength={100} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows "show more" button when text is longer than maxLength', () => {
      render(<TruncatedText text={longText} maxLength={100} />);

      expect(
        screen.getByRole('button', { name: 'show more' }),
      ).toBeInTheDocument();
    });

    it('toggles to "show less" when clicked', () => {
      render(<TruncatedText text={longText} maxLength={100} />);

      const button = screen.getByRole('button', { name: 'show more' });
      fireEvent.click(button);

      expect(
        screen.getByRole('button', { name: 'show less' }),
      ).toBeInTheDocument();
    });

    it('toggles back to "show more" when clicked twice', () => {
      render(<TruncatedText text={longText} maxLength={100} />);

      const button = screen.getByRole('button', { name: 'show more' });
      fireEvent.click(button);
      fireEvent.click(screen.getByRole('button', { name: 'show less' }));

      expect(
        screen.getByRole('button', { name: 'show more' }),
      ).toBeInTheDocument();
    });

    it('removes text-truncate class when expanded', () => {
      const { container } = render(
        <TruncatedText text={longText} maxLength={100} />,
      );

      const button = screen.getByRole('button', { name: 'show more' });
      fireEvent.click(button);

      expect(container.querySelector('p')).not.toHaveClass('text-truncate');
    });

    it('re-adds text-truncate class when collapsed', () => {
      const { container } = render(
        <TruncatedText text={longText} maxLength={100} />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'show more' }));
      fireEvent.click(screen.getByRole('button', { name: 'show less' }));

      expect(container.querySelector('p')).toHaveClass('text-truncate');
    });
  });

  describe('color variants', () => {
    it('uses "link" variant by default', () => {
      render(<TruncatedText text={longText} maxLength={100} />);

      const button = screen.getByRole('button', { name: 'show more' });
      expect(button).toHaveClass('btn-link');
    });

    it('uses outline variant when color is not "link"', () => {
      render(<TruncatedText text={longText} maxLength={100} color="primary" />);

      const button = screen.getByRole('button', { name: 'show more' });
      expect(button).toHaveClass('btn-outline-primary');
    });

    it('applies text-reset class only for link color', () => {
      render(<TruncatedText text={longText} maxLength={100} color="link" />);

      const button = screen.getByRole('button', { name: 'show more' });
      expect(button).toHaveClass('text-reset');
    });
  });

  describe('edge cases', () => {
    it('handles text exactly at maxLength (no button shown)', () => {
      const exactText = 'A'.repeat(100);
      render(<TruncatedText text={exactText} maxLength={100} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows button when text is one character over maxLength', () => {
      const justOverText = 'A'.repeat(101);
      render(<TruncatedText text={justOverText} maxLength={100} />);

      expect(
        screen.getByRole('button', { name: 'show more' }),
      ).toBeInTheDocument();
    });

    it('handles empty text', () => {
      render(<TruncatedText text="" maxLength={100} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
