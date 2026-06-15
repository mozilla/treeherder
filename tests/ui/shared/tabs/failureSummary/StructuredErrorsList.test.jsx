import { fireEvent, render, screen } from '@testing-library/react';

import StructuredErrorsList from '../../../../../ui/shared/tabs/failureSummary/StructuredErrorsList';

const sampleErrors = [
  {
    id: 1,
    action: 'test_status',
    level: 'ERROR',
    source: 'mach-test',
    message: '[run_test : 24] true == false',
    test: 'xpcom/tests/unit/test_a.js',
  },
  {
    id: 2,
    action: 'test_status',
    level: 'ERROR',
    source: 'mach-test',
    message: '[run_test : 25] expected PASS',
    test: 'xpcom/tests/unit/test_a.js',
  },
  {
    id: 3,
    action: 'test_end',
    level: 'ERROR',
    source: 'mach-test',
    message: 'xpcshell return code: 1',
    test: 'xpcom/tests/unit/test_b.js',
  },
  {
    id: 4,
    action: 'log',
    level: 'ERROR',
    source: 'mach-test',
    message: 'something unrelated',
    test: '',
  },
];

describe('StructuredErrorsList', () => {
  test('groups errors by test name and shows one toggle per group', () => {
    render(<StructuredErrorsList errors={sampleErrors} />);
    const toggles = screen.getAllByTestId('structured-log-test-toggle');
    expect(toggles).toHaveLength(3);
    expect(toggles[0]).toHaveTextContent('xpcom/tests/unit/test_a.js');
    expect(toggles[1]).toHaveTextContent('xpcom/tests/unit/test_b.js');
    expect(toggles[2]).toHaveTextContent('Other errors');
  });

  test('groups are collapsed by default and expand on click', () => {
    const { container } = render(<StructuredErrorsList errors={sampleErrors} />);
    expect(
      container.querySelectorAll('[data-testid="structured-log-error"]'),
    ).toHaveLength(0);

    const toggles = screen.getAllByTestId('structured-log-test-toggle');
    fireEvent.click(toggles[0]);

    const rows = container.querySelectorAll(
      '[data-testid="structured-log-error"]',
    );
    expect(rows).toHaveLength(2);
    expect(screen.getByText('[run_test : 24] true == false')).toBeTruthy();
  });

  test('clicking an open group hides its assertions again', () => {
    const { container } = render(<StructuredErrorsList errors={sampleErrors} />);
    const toggle = screen.getAllByTestId('structured-log-test-toggle')[0];
    fireEvent.click(toggle);
    expect(
      container.querySelectorAll('[data-testid="structured-log-error"]'),
    ).toHaveLength(2);
    fireEvent.click(toggle);
    expect(
      container.querySelectorAll('[data-testid="structured-log-error"]'),
    ).toHaveLength(0);
  });

  test('renders nothing extra when given an empty list', () => {
    const { container } = render(<StructuredErrorsList errors={[]} />);
    expect(
      container.querySelectorAll('[data-testid="structured-log-test-group"]'),
    ).toHaveLength(0);
  });
});
