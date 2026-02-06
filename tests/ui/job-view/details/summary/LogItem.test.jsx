/**
 * Unit tests for the LogItem component.
 *
 * This component displays log links with different behaviors based on:
 * - Number of log URLs (single, multiple, or none)
 * - Log parse status (parsed, failed, skipped-size, pending)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import LogItem from '../../../../../ui/job-view/details/summary/LogItem';

describe('LogItem', () => {
  const createLogUrl = (overrides = {}) => ({
    id: 1,
    name: 'live_backing.log',
    url: 'https://example.com/log.txt',
    parse_status: 'parsed',
    ...overrides,
  });

  describe('single log URL', () => {
    it('renders a link when there is exactly one log URL', () => {
      const logUrls = [createLogUrl()];

      render(
        <LogItem
          logUrls={logUrls}
          logKey="logviewer"
          logDescription="log"
          logViewerUrl="/logviewer/1"
          logViewerFullUrl="https://example.com/logviewer/1"
        >
          View Log
        </LogItem>,
      );

      const link = screen.getByTestId('logviewer-btn');
      expect(link).toBeInTheDocument();
      expect(screen.getByText('View Log')).toBeInTheDocument();
    });

    it('sets correct attributes for parsed log', () => {
      const logUrls = [createLogUrl({ id: 42, parse_status: 'parsed' })];

      render(
        <LogItem
          logUrls={logUrls}
          logKey="logviewer"
          logDescription="log"
          logViewerUrl="/logviewer/42"
          logViewerFullUrl="https://example.com/logviewer/42"
        >
          View Log
        </LogItem>,
      );

      const link = screen.getByTestId('logviewer-btn');
      expect(link).toHaveAttribute('href', '/logviewer/42');
      expect(link).toHaveAttribute(
        'title',
        'Open the log viewer in a new window (l)',
      );
      expect(link).toHaveAttribute(
        'copy-value',
        'https://example.com/logviewer/42',
      );
    });

    it('sets disabled class for failed parse status', () => {
      const logUrls = [createLogUrl({ parse_status: 'failed' })];

      render(
        <LogItem logUrls={logUrls} logKey="logviewer" logDescription="log">
          View Log
        </LogItem>,
      );

      const link = screen.getByTestId('logviewer-btn');
      expect(link).toHaveClass('disabled');
      expect(link).toHaveAttribute('title', 'Log parsing has failed');
    });

    it('sets disabled class for skipped-size parse status', () => {
      const logUrls = [createLogUrl({ parse_status: 'skipped-size' })];

      render(
        <LogItem logUrls={logUrls} logKey="logviewer" logDescription="log">
          View Log
        </LogItem>,
      );

      const link = screen.getByTestId('logviewer-btn');
      expect(link).toHaveClass('disabled');
      expect(link).toHaveAttribute('title', 'Log parsing was skipped');
    });

    it('sets disabled class for pending parse status', () => {
      const logUrls = [createLogUrl({ parse_status: 'pending' })];

      render(
        <LogItem logUrls={logUrls} logKey="logviewer" logDescription="log">
          View Log
        </LogItem>,
      );

      const link = screen.getByTestId('logviewer-btn');
      expect(link).toHaveClass('disabled');
      expect(link).toHaveAttribute('title', 'Log parsing in progress');
    });
  });

  describe('raw log link', () => {
    it('renders raw log link with correct attributes', () => {
      const logUrls = [createLogUrl({ url: 'https://example.com/raw.log' })];

      render(
        <LogItem logUrls={logUrls} logKey="rawlog" logDescription="raw log">
          Raw Log
        </LogItem>,
      );

      const link = screen.getByTestId('logviewer-btn');
      expect(link).toHaveAttribute('href', 'https://example.com/raw.log');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute(
        'title',
        'Open the raw log in a new window (shift+l)',
      );
      expect(link).toHaveAttribute('copy-value', 'https://example.com/raw.log');
    });
  });

  describe('multiple log URLs', () => {
    it('renders a dropdown when there are multiple log URLs', () => {
      const logUrls = [
        createLogUrl({ id: 1, name: 'log1.txt' }),
        createLogUrl({ id: 2, name: 'log2.txt' }),
      ];

      render(
        <LogItem
          logUrls={logUrls}
          logKey="logviewer"
          logDescription="log"
          logViewerUrl="/logviewer"
          logViewerFullUrl="https://example.com/logviewer"
        >
          View Logs
        </LogItem>,
      );

      // Should render dropdown toggle with children text
      expect(screen.getByText('View Logs')).toBeInTheDocument();
      // Should have dropdown toggle button
      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'Select a log',
      );
    });

    it('renders dropdown items for each log URL when dropdown is opened', async () => {
      const logUrls = [
        createLogUrl({ id: 1, name: 'first.log' }),
        createLogUrl({ id: 2, name: 'second.log' }),
      ];

      render(
        <LogItem
          logUrls={logUrls}
          logKey="logviewer"
          logDescription="log"
          logViewerUrl="/logviewer"
          logViewerFullUrl="https://example.com/logviewer"
        >
          View Logs
        </LogItem>,
      );

      // Open the dropdown
      const toggle = screen.getByRole('button');
      fireEvent.click(toggle);

      // Dropdown menu should contain items for each log
      expect(screen.getByText('first.log (1)')).toBeInTheDocument();
      expect(screen.getByText('second.log (2)')).toBeInTheDocument();
    });
  });

  describe('no log URLs', () => {
    it('renders disabled button when there are no log URLs', () => {
      render(
        <LogItem logUrls={[]} logKey="logviewer" logDescription="log">
          No Logs
        </LogItem>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled');
      expect(button).toHaveAttribute('title', 'No logs available for this job');
      expect(button).toHaveAttribute(
        'aria-label',
        'No logs available for this job',
      );
    });

    it('renders children text in disabled button', () => {
      render(
        <LogItem logUrls={[]} logKey="logviewer" logDescription="log">
          Log Unavailable
        </LogItem>,
      );

      expect(screen.getByText('Log Unavailable')).toBeInTheDocument();
    });
  });

  describe('list item wrapper', () => {
    it('renders inside an li element', () => {
      const logUrls = [createLogUrl()];

      const { container } = render(
        <LogItem
          logUrls={logUrls}
          logKey="logviewer"
          logDescription="log"
          logViewerUrl="/logviewer"
          logViewerFullUrl="https://example.com/logviewer"
        >
          View Log
        </LogItem>,
      );

      expect(container.querySelector('li')).toBeInTheDocument();
    });
  });

  describe('CSS classes', () => {
    it('has logviewer-btn class on single log link', () => {
      const logUrls = [createLogUrl()];

      render(
        <LogItem
          logUrls={logUrls}
          logKey="logviewer"
          logDescription="log"
          logViewerUrl="/logviewer"
          logViewerFullUrl="https://example.com/logviewer"
        >
          View Log
        </LogItem>,
      );

      const link = screen.getByTestId('logviewer-btn');
      expect(link).toHaveClass('logviewer-btn');
    });

    it('has logviewer-btn class on dropdown toggle', () => {
      const logUrls = [createLogUrl({ id: 1 }), createLogUrl({ id: 2 })];

      render(
        <LogItem logUrls={logUrls} logKey="logviewer" logDescription="log">
          View Logs
        </LogItem>,
      );

      const toggle = screen.getByRole('button');
      expect(toggle).toHaveClass('logviewer-btn');
      expect(toggle).toHaveClass('btn-view-nav');
    });
  });
});
