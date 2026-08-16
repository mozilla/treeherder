import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

import PushRangeSection from '../../../../../ui/job-view/headerbars/filter-panel/PushRangeSection';

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

  it('a quick-range button sets the start date and clears the end date', () => {
    renderSection('?repo=autoland&enddate=2026-08-10');
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(screen.getByLabelText('Start date')).not.toHaveValue('');
    expect(screen.getByLabelText('End date')).toHaveValue('');
  });
});
