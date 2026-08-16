import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

import PushRangeSection from '../../../../../ui/job-view/headerbars/filter-panel/PushRangeSection';

const mockGetList = jest.fn().mockResolvedValue({
  data: {
    results: [
      { author: 'sheriff@mozilla.com', revision: 'abcdef1234567890abcd' },
      { author: 'dev@mozilla.com', revision: '123456abcdef7890abcd' },
    ],
  },
  failureStatus: null,
});

jest.mock('../../../../../ui/models/push', () => ({
  __esModule: true,
  default: { getList: (...args) => mockGetList(...args) },
}));

let currentSearch;
function LocationSpy() {
  currentSearch = useLocation().search;
  return null;
}

const renderSection = (initialSearch = '?repo=autoland') =>
  render(
    <MemoryRouter initialEntries={[`/jobs${initialSearch}`]}>
      <PushRangeSection />
      <LocationSpy />
    </MemoryRouter>,
  );

describe('PushRangeSection', () => {
  it('seeds inputs from the URL', () => {
    renderSection('?repo=autoland&startdate=2026-08-01&author=me@example.com');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('Author')).toHaveValue('me@example.com');
  });

  it('disables Apply for a reversed date range', () => {
    renderSection();
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-08-15' },
    });
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-08-01' },
    });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('applies staged params to the URL on Apply', () => {
    renderSection();
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.change(screen.getByLabelText('Author'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(currentSearch).toContain('startdate=2026-08-01');
    expect(currentSearch).toContain('author=me%40example.com');
  });

  it('disables Apply and hides the staged hint until a field changes', () => {
    renderSection('?repo=autoland&author=me@example.com');

    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(screen.queryByText(/STAGED — takes effect/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Author'), {
      target: { value: 'someone-else@example.com' },
    });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(screen.getByText(/STAGED — takes effect/)).toBeInTheDocument();

    // Reverting back to the URL value makes it clean again
    fireEvent.change(screen.getByLabelText('Author'), {
      target: { value: 'me@example.com' },
    });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(screen.queryByText(/STAGED — takes effect/)).not.toBeInTheDocument();
  });

  it('shows a clear control on author/revision only when non-empty', () => {
    renderSection('?repo=autoland&author=me@example.com');

    expect(screen.queryByLabelText('Clear revision')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Clear author'));
    expect(screen.getByLabelText('Author')).toHaveValue('');
    expect(screen.queryByLabelText('Clear author')).not.toBeInTheDocument();
  });

  it('offers author and revision suggestions from fetched pushes', async () => {
    const { container } = renderSection();

    await waitFor(() => {
      expect(
        container.querySelector(
          '#push-author-suggestions option[value="sheriff@mozilla.com"]',
        ),
      ).toBeInTheDocument();
    });
    // Revisions are suggested as 12-char short hashes
    expect(
      container.querySelector(
        '#push-revision-suggestions option[value="abcdef123456"]',
      ),
    ).toBeInTheDocument();
    expect(mockGetList).toHaveBeenCalledWith(
      expect.objectContaining({ repo: 'autoland' }),
    );
  });

  it('a quick-range button sets the start date and clears the end date', () => {
    renderSection('?repo=autoland&enddate=2026-08-10');
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(screen.getByLabelText('Start date')).not.toHaveValue('');
    expect(screen.getByLabelText('End date')).toHaveValue('');
  });
});
