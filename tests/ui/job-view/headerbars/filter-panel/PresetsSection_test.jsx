import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

import FilterModel from '../../../../../ui/models/filter';
import PresetsSection from '../../../../../ui/job-view/headerbars/filter-panel/PresetsSection';
import { savePreset } from '../../../../../ui/job-view/headerbars/filter-panel/helpers';

let currentSearch;
function LocationSpy() {
  currentSearch = useLocation().search;
  return null;
}

const renderSection = (search = '?repo=autoland') =>
  render(
    <MemoryRouter initialEntries={[`/jobs${search}`]}>
      <PresetsSection
        filterModel={new FilterModel(jest.fn(), { search, pathname: '/jobs' })}
      />
      <LocationSpy />
    </MemoryRouter>,
  );

afterEach(() => localStorage.clear());

describe('PresetsSection', () => {
  it('saves the current filters under a name', () => {
    renderSection('?repo=autoland&platform=linux');
    fireEvent.change(screen.getByLabelText('Preset name'), {
      target: { value: 'my linux' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save current' }));
    expect(screen.getByRole('button', { name: 'my linux' })).toBeInTheDocument();
  });

  it('applying a preset navigates to its params plus current repo', () => {
    savePreset('failures', { resultStatus: ['testfailed', 'busted'] });
    renderSection('?repo=mozilla-central');
    fireEvent.click(screen.getByRole('button', { name: 'failures' }));
    expect(currentSearch).toContain('repo=mozilla-central');
    expect(currentSearch).toContain('resultStatus=testfailed%2Cbusted');
  });

  it('deletes a preset', () => {
    savePreset('old', {});
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Delete preset old' }));
    expect(screen.queryByRole('button', { name: 'old' })).not.toBeInTheDocument();
  });

  it('disables save with an empty name', () => {
    renderSection();
    expect(screen.getByRole('button', { name: 'Save current' })).toBeDisabled();
  });
});
