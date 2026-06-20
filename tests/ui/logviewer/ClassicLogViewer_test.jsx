import { render, screen } from '@testing-library/react';

import ClassicLogViewer from '../../../ui/logviewer/ClassicLogViewer';

describe('ClassicLogViewer error states', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('shows an expired message when the log fetch returns 404', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    render(<ClassicLogViewer url="https://example.com/expired.log" />);

    expect(
      await screen.findByText(
        'This log has expired and is no longer available.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the generic error message for non-404 failures', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    render(<ClassicLogViewer url="https://example.com/broken.log" />);

    expect(
      await screen.findByText(/Error loading log:/),
    ).toBeInTheDocument();
  });
});
