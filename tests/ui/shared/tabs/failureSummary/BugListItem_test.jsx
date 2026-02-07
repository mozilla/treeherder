import { render, screen, fireEvent } from '@testing-library/react';

import BugListItem from '../../../../../ui/shared/tabs/failureSummary/BugListItem';

describe('BugListItem', () => {
  const baseProps = {
    selectedJob: { id: 1 },
    toggleBugFiler: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('bug with id (Bugzilla bug)', () => {
    test('should render bug link with highlighted search terms', () => {
      const bug = {
        id: 123456,
        bugzilla_id: 123456,
        summary: 'Test failure in browser_test.js',
        resolution: '',
      };
      const suggestion = {
        search: 'browser_test.js Test failure',
      };

      render(
        <BugListItem bug={bug} suggestion={suggestion} {...baseProps} />,
      );

      // Check the bug is rendered
      // The Highlighter component adds spaces, so the accessible name includes spaces
      const bugLink = screen.getByRole('link', {
        name: /Test failure in browser_test.*js.*\(bug 123456\)/i,
      });
      expect(bugLink).toBeInTheDocument();
      expect(bugLink).toHaveAttribute(
        'href',
        'https://bugzilla.mozilla.org/show_bug.cgi?id=123456',
      );

      // Verify the summary text is present
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('failure')).toBeInTheDocument();
    });

    test('should render strike-through for resolved bugs', () => {
      const bug = {
        id: 123456,
        bugzilla_id: 123456,
        summary: 'Fixed bug',
        resolution: 'FIXED',
      };
      const suggestion = {
        search: 'Fixed',
      };

      render(
        <BugListItem bug={bug} suggestion={suggestion} {...baseProps} />,
      );

      const bugLink = screen.getByRole('link', { name: /Fixed bug/i });
      expect(bugLink).toHaveClass('strike-through');
    });

    test('should render duplicate bug link when dupe_of is present', () => {
      const bug = {
        id: 123456,
        bugzilla_id: 123456,
        summary: 'Duplicate bug',
        resolution: 'DUPLICATE',
        dupe_of: 789012,
      };
      const suggestion = {
        search: 'Duplicate',
      };

      render(
        <BugListItem bug={bug} suggestion={suggestion} {...baseProps} />,
      );

      // Check main bug link
      expect(
        screen.getByRole('link', { name: /Duplicate bug/i }),
      ).toBeInTheDocument();

      // Check duplicate link
      const dupeLink = screen.getByRole('link', { name: '789012' });
      expect(dupeLink).toHaveAttribute(
        'href',
        'https://bugzilla.mozilla.org/show_bug.cgi?id=789012',
      );
    });

    test('should apply custom bugClassName', () => {
      const bug = {
        id: 123456,
        bugzilla_id: 123456,
        summary: 'Test bug',
        resolution: '',
      };
      const suggestion = {
        search: 'Test',
      };

      render(
        <BugListItem
          bug={bug}
          suggestion={suggestion}
          bugClassName="custom-class"
          {...baseProps}
        />,
      );

      const bugLink = screen.getByRole('link', { name: /Test bug/i });
      expect(bugLink).toHaveClass('custom-class');
    });

    test('should set custom title attribute', () => {
      const bug = {
        id: 123456,
        bugzilla_id: 123456,
        summary: 'Test bug',
        resolution: '',
      };
      const suggestion = {
        search: 'Test',
      };

      render(
        <BugListItem
          bug={bug}
          suggestion={suggestion}
          title="Custom title"
          {...baseProps}
        />,
      );

      const bugLink = screen.getByRole('link', { name: /Test bug/i });
      expect(bugLink).toHaveAttribute('title', 'Custom title');
    });
  });

  describe('internal bug (no Bugzilla id)', () => {
    test('should render internal bug without link', () => {
      const bug = {
        internal_id: 1,
        summary: 'Internal classification issue',
        occurrences: 5,
        bugzilla_id: null,
      };
      const suggestion = {
        search: 'classification',
      };

      render(
        <BugListItem bug={bug} suggestion={suggestion} {...baseProps} />,
      );

      expect(screen.getByText(/i1/)).toBeInTheDocument();
      expect(screen.getByText(/5 occurrences/)).toBeInTheDocument();
      expect(screen.getByText('Internal classification issue')).toBeInTheDocument();
    });

    test('should show pin button when occurrences < requiredInternalOccurrences and addBug provided', () => {
      const addBug = jest.fn();
      const bug = {
        internal_id: 1,
        summary: 'Internal issue',
        occurrences: 2, // Less than requiredInternalOccurrences (3)
        bugzilla_id: null,
      };
      const suggestion = {
        search: 'issue',
      };

      render(
        <BugListItem
          bug={bug}
          suggestion={suggestion}
          addBug={addBug}
          {...baseProps}
        />,
      );

      const pinButton = screen.getByTitle(
        'Add to list of bugs to associate with all pinned jobs',
      );
      expect(pinButton).toBeInTheDocument();

      fireEvent.click(pinButton);
      expect(addBug).toHaveBeenCalledWith(bug, baseProps.selectedJob);
    });

    test('should show bugzilla button when occurrences >= requiredInternalOccurrences', () => {
      const bug = {
        internal_id: 1,
        summary: 'Internal issue',
        occurrences: 5, // Greater than requiredInternalOccurrences (3)
        bugzilla_id: null,
      };
      const suggestion = {
        search: 'issue',
      };

      render(
        <BugListItem bug={bug} suggestion={suggestion} {...baseProps} />,
      );

      const bugzillaButton = screen.getByTitle(
        'File a bug for this internal issue',
      );
      expect(bugzillaButton).toBeInTheDocument();

      fireEvent.click(bugzillaButton);
      expect(baseProps.toggleBugFiler).toHaveBeenCalledWith(suggestion);
    });

    test('should show force file button when occurrences < requiredInternalOccurrences', () => {
      const bug = {
        internal_id: 1,
        summary: 'Internal issue',
        occurrences: 2, // Less than requiredInternalOccurrences (3)
        bugzilla_id: null,
      };
      const suggestion = {
        search: 'issue',
      };

      render(
        <BugListItem bug={bug} suggestion={suggestion} {...baseProps} />,
      );

      const forceFileButton = screen.getByTitle(
        'Force file a bug (2/3 occurrences)',
      );
      expect(forceFileButton).toBeInTheDocument();

      fireEvent.click(forceFileButton);
      expect(baseProps.toggleBugFiler).toHaveBeenCalledWith(suggestion);
    });

    test('should show pin button after bugzilla button when occurrences >= requiredInternalOccurrences and addBug provided', () => {
      const addBug = jest.fn();
      const bug = {
        internal_id: 1,
        summary: 'Internal issue',
        occurrences: 5,
        bugzilla_id: null,
      };
      const suggestion = {
        search: 'issue',
      };

      render(
        <BugListItem
          bug={bug}
          suggestion={suggestion}
          addBug={addBug}
          {...baseProps}
        />,
      );

      // Both buttons should be present
      const bugzillaButton = screen.getByTitle(
        'File a bug for this internal issue',
      );
      const pinButton = screen.getByTitle(
        'Add to list of bugs to associate with all pinned jobs',
      );

      expect(bugzillaButton).toBeInTheDocument();
      expect(pinButton).toBeInTheDocument();
    });
  });

  describe('highlighting behavior', () => {
    test('should extract search words from suggestion.search', () => {
      const bug = {
        id: 123456,
        bugzilla_id: 123456,
        summary: 'Test failure in browser_test.js application crashed',
        resolution: '',
      };
      const suggestion = {
        search: 'browser_test.js | application crashed',
      };

      render(
        <BugListItem bug={bug} suggestion={suggestion} {...baseProps} />,
      );

      // The component should render with highlighted text
      // react-highlight-words will highlight "browser_test", "js", "application", "crashed"
      expect(screen.getByText(/Test failure/i)).toBeInTheDocument();
    });

    test('should handle empty search terms gracefully', () => {
      const bug = {
        id: 123456,
        bugzilla_id: 123456,
        summary: 'Test bug',
        resolution: '',
      };
      const suggestion = {
        search: '',
      };

      render(
        <BugListItem bug={bug} suggestion={suggestion} {...baseProps} />,
      );

      expect(screen.getByText('Test bug')).toBeInTheDocument();
    });
  });

  describe('data-testid', () => {
    test('should render with data-testid attribute', () => {
      const bug = {
        id: 123456,
        bugzilla_id: 123456,
        summary: 'Test bug',
        resolution: '',
      };
      const suggestion = {
        search: 'Test',
      };

      render(
        <BugListItem bug={bug} suggestion={suggestion} {...baseProps} />,
      );

      expect(screen.getByTestId('bug-list-item')).toBeInTheDocument();
    });
  });
});
