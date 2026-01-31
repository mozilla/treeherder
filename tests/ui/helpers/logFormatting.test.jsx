/**
 * Unit tests for the logFormatting helper module.
 *
 * This test suite covers:
 * - formatLogLineWithLinks: Transforms log lines by adding clickable links
 *   - Profile upload detection and linking to Firefox Profiler
 *   - Process crash detection and linking to crash viewer
 */

import { render, screen } from '@testing-library/react';

import formatLogLineWithLinks from '../../../ui/helpers/logFormatting';

// Mock the URL helpers
jest.mock('../../../ui/helpers/url', () => ({
  getCrashViewerUrl: jest.fn(
    (url) =>
      `https://crash-viewer.example.com?trace=${encodeURIComponent(url)}`,
  ),
  getPerfAnalysisUrl: jest.fn(
    (url) =>
      `https://profiler.firefox.com?profileUrl=${encodeURIComponent(url)}`,
  ),
}));

describe('formatLogLineWithLinks', () => {
  const mockJob = {
    job_type_name: 'test-job',
  };

  describe('when jobDetails is empty or missing', () => {
    it('returns original line when jobDetails is empty array', () => {
      const line = 'Some log line';
      const result = formatLogLineWithLinks(line, [], mockJob);

      expect(result).toBe(line);
    });

    it('returns original line when jobDetails is null', () => {
      const line = 'Some log line';
      const result = formatLogLineWithLinks(line, null, mockJob);

      expect(result).toBe(line);
    });

    it('returns original line when jobDetails is undefined', () => {
      const line = 'Some log line';
      const result = formatLogLineWithLinks(line, undefined, mockJob);

      expect(result).toBe(line);
    });
  });

  describe('profile upload detection', () => {
    const profileJobDetails = [
      {
        value: 'profile_test.js.json',
        url: 'https://taskcluster.example.com/artifacts/profile_test.js.json',
      },
    ];

    it('returns array with link when profile uploaded pattern is found', () => {
      const line =
        'INFO profile uploaded in profile_test.js.json to TaskCluster';

      const result = formatLogLineWithLinks(line, profileJobDetails, mockJob);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('creates link with correct href to Firefox Profiler', () => {
      const line =
        'INFO profile uploaded in profile_test.js.json to TaskCluster';

      const result = formatLogLineWithLinks(line, profileJobDetails, mockJob);
      const Wrapper = () => <>{result}</>;
      render(<Wrapper />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining('profiler.firefox.com'),
      );
    });

    it('creates link with correct title', () => {
      const line =
        'INFO profile uploaded in profile_test.js.json to TaskCluster';

      const result = formatLogLineWithLinks(line, profileJobDetails, mockJob);
      const Wrapper = () => <>{result}</>;
      render(<Wrapper />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('title', 'open in Firefox Profiler');
    });

    it('creates link with correct text', () => {
      const line =
        'INFO profile uploaded in profile_test.js.json to TaskCluster';

      const result = formatLogLineWithLinks(line, profileJobDetails, mockJob);
      const Wrapper = () => <>{result}</>;
      render(<Wrapper />);

      expect(
        screen.getByText('open profile_test.js.json in the Firefox Profiler'),
      ).toBeInTheDocument();
    });

    it('returns original line when profile artifact not found in jobDetails', () => {
      const line =
        'INFO profile uploaded in profile_other.js.json to TaskCluster';

      const result = formatLogLineWithLinks(line, profileJobDetails, mockJob);

      expect(result).toBe(line);
    });

    it('returns original line when no profile pattern matches', () => {
      const line = 'Some regular log line without profile info';

      const result = formatLogLineWithLinks(line, profileJobDetails, mockJob);

      expect(result).toBe(line);
    });
  });

  describe('process crash detection', () => {
    const crashId = '12345678-1234-1234-1234-123456789abc';
    const crashJobDetails = [
      {
        value: `${crashId}.json`,
        url: `https://taskcluster.example.com/artifacts/${crashId}.json`,
      },
    ];

    it('detects PROCESS-CRASH pattern with UUID', () => {
      const line = `PROCESS-CRASH | ${crashId} | some crash info`;

      const result = formatLogLineWithLinks(line, crashJobDetails, mockJob);

      expect(Array.isArray(result)).toBe(true);
    });

    it('detects INFO crashed process pattern with UUID', () => {
      const line = `INFO crashed process | ${crashId} | details`;

      const result = formatLogLineWithLinks(line, crashJobDetails, mockJob);

      expect(Array.isArray(result)).toBe(true);
    });

    it('creates crash viewer link with correct href', () => {
      const line = `PROCESS-CRASH | ${crashId} | crash info`;

      const result = formatLogLineWithLinks(line, crashJobDetails, mockJob);
      const Wrapper = () => <>{result}</>;
      render(<Wrapper />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining('crash-viewer.example.com'),
      );
    });

    it('creates link with correct title for crash viewer', () => {
      const line = `PROCESS-CRASH | ${crashId} | crash info`;

      const result = formatLogLineWithLinks(line, crashJobDetails, mockJob);
      const Wrapper = () => <>{result}</>;
      render(<Wrapper />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('title', 'open in crash viewer');
    });

    it('returns original line when crash artifact not found in jobDetails', () => {
      const differentCrashId = '00000000-0000-0000-0000-000000000000';
      const line = `PROCESS-CRASH | ${differentCrashId} | crash info`;

      const result = formatLogLineWithLinks(line, crashJobDetails, mockJob);

      expect(result).toBe(line);
    });

    it('returns original line when no crash pattern matches', () => {
      const line = 'Some regular log line without crash info';

      const result = formatLogLineWithLinks(line, crashJobDetails, mockJob);

      expect(result).toBe(line);
    });
  });

  describe('link attributes', () => {
    const profileJobDetails = [
      {
        value: 'profile_test.js.json',
        url: 'https://taskcluster.example.com/artifacts/profile_test.js.json',
      },
    ];

    it('adds target="_blank" to links', () => {
      const line =
        'INFO profile uploaded in profile_test.js.json to TaskCluster';

      const result = formatLogLineWithLinks(line, profileJobDetails, mockJob);
      const Wrapper = () => <>{result}</>;
      render(<Wrapper />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('adds rel="noopener noreferrer" to links', () => {
      const line =
        'INFO profile uploaded in profile_test.js.json to TaskCluster';

      const result = formatLogLineWithLinks(line, profileJobDetails, mockJob);
      const Wrapper = () => <>{result}</>;
      render(<Wrapper />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('adds log-line-link class to links', () => {
      const line =
        'INFO profile uploaded in profile_test.js.json to TaskCluster';

      const result = formatLogLineWithLinks(line, profileJobDetails, mockJob);
      const Wrapper = () => <>{result}</>;
      render(<Wrapper />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('log-line-link');
    });
  });

  describe('options.onLinkClick', () => {
    const profileJobDetails = [
      {
        value: 'profile_test.js.json',
        url: 'https://taskcluster.example.com/artifacts/profile_test.js.json',
      },
    ];

    it('attaches onClick handler when provided', () => {
      const onLinkClick = jest.fn();
      const line =
        'INFO profile uploaded in profile_test.js.json to TaskCluster';

      const result = formatLogLineWithLinks(line, profileJobDetails, mockJob, {
        onLinkClick,
      });
      const Wrapper = () => <>{result}</>;
      render(<Wrapper />);

      const link = screen.getByRole('link');
      link.click();

      expect(onLinkClick).toHaveBeenCalled();
    });
  });
});
