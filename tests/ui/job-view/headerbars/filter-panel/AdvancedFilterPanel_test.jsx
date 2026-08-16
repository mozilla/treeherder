import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import FilterModel from '../../../../../ui/models/filter';
import AdvancedFilterPanel from '../../../../../ui/job-view/headerbars/filter-panel/AdvancedFilterPanel';
import {
  usePushesStore,
  initialState,
} from '../../../../../ui/shared/stores/pushesStore';

const mockNavigate = jest.fn();

afterEach(() => {
  mockNavigate.mockClear();
  usePushesStore.setState({ ...initialState });
});

const renderPanel = ({ search = '?repo=autoland', filterModel } = {}) => {
  const fm =
    filterModel || new FilterModel(mockNavigate, { search, pathname: '/jobs' });
  const target = createRef();

  return render(
    <MemoryRouter initialEntries={[`/jobs${search}`]}>
      <button type="button" ref={target}>
        anchor
      </button>
      <AdvancedFilterPanel
        isOpen
        onClose={jest.fn()}
        target={target}
        filterModel={fm}
        classificationTypes={[{ id: 4, name: 'intermittent' }]}
      />
    </MemoryRouter>,
  );
};

describe('AdvancedFilterPanel', () => {
  it('renders all sections', () => {
    renderPanel();
    expect(screen.getByText('Result status')).toBeInTheDocument();
    expect(screen.getByText('Tier')).toBeInTheDocument();
    expect(screen.getByText('Field filters')).toBeInTheDocument();
    expect(screen.getByText('Push range')).toBeInTheDocument();
    expect(screen.getByText('Presets')).toBeInTheDocument();
  });

  it('status pill reflects and toggles resultStatus', () => {
    const fm = new FilterModel(mockNavigate, {
      search: '?repo=autoland',
      pathname: '/jobs',
    });
    const spy = jest.spyOn(fm, 'toggleResultStatuses');

    renderPanel({ filterModel: fm });
    const pill = screen.getByRole('checkbox', { name: 'Toggle testfailed' });
    expect(pill).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(pill);
    expect(spy).toHaveBeenCalledWith(['testfailed']);
  });

  it('tier pill calls toggleFilter', () => {
    const fm = new FilterModel(mockNavigate, {
      search: '?repo=autoland',
      pathname: '/jobs',
    });
    const spy = jest.spyOn(fm, 'toggleFilter');

    renderPanel({ filterModel: fm });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Toggle tier 3 jobs' }));
    expect(spy).toHaveBeenCalledWith('tier', '3');
  });

  it('adding a field filter calls addFilter', () => {
    const fm = new FilterModel(mockNavigate, {
      search: '?repo=autoland',
      pathname: '/jobs',
    });
    const spy = jest.spyOn(fm, 'addFilter');

    renderPanel({ filterModel: fm });
    fireEvent.change(screen.getByLabelText('Field'), {
      target: { value: 'platform' },
    });
    fireEvent.change(screen.getByLabelText('New filter value'), {
      target: { value: 'linux' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    expect(spy).toHaveBeenCalledWith('platform', 'linux');
  });

  it('Clear all clears filters and push-range params', () => {
    const fm = new FilterModel(mockNavigate, {
      search: '?repo=autoland&platform=linux&startdate=2026-08-01',
      pathname: '/jobs',
    });
    const spy = jest.spyOn(fm, 'clearNonStatusFilters');

    renderPanel({
      search: '?repo=autoland&platform=linux&startdate=2026-08-01',
      filterModel: fm,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(spy).toHaveBeenCalled();
  });
});
