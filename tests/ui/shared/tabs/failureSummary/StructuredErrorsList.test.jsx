import fs from 'fs';
import path from 'path';

import { render, screen } from '@testing-library/react';

import StructuredErrorsList from '../../../../../ui/shared/tabs/failureSummary/StructuredErrorsList';

import structuredLogs from '../mock/structured_log.json';

describe('StructuredErrorsList', () => {
  test('renders one row per parsed JSONL entry', () => {
    const { container } = render(
      <StructuredErrorsList errors={structuredLogs} />,
    );
    const rows = container.querySelectorAll(
      '[data-testid="structured-log-error"]',
    );
    expect(rows).toHaveLength(structuredLogs.length);
  });

  test('renders the message of the first entry', () => {
    render(<StructuredErrorsList errors={structuredLogs} />);
    const firstMessage = structuredLogs[0]?.message;
    expect(screen.getByText(firstMessage)).toBeTruthy();
  });

  test('renders nothing extra when given an empty list', () => {
    const { container } = render(<StructuredErrorsList errors={[]} />);
    expect(
      container.querySelectorAll('[data-testid="structured-log-error"]'),
    ).toHaveLength(0);
  });
});
