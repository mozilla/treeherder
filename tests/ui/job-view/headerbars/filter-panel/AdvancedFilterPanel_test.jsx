import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

import FilterModel from '../../../../../ui/models/filter';
import AdvancedFilterPanel from '../../../../../ui/job-view/headerbars/filter-panel/AdvancedFilterPanel';
import {
  usePushesStore,
  initialState,
} from '../../../../../ui/shared/stores/pushesStore';

const mockNavigate = jest.fn();

let currentSearch;
function LocationSpy() {
  currentSearch = useLocation().search;
  return null;
}

afterEach(() => {
  mockNavigate.mockClear();
  usePushesStore.setState({ ...initialState });
});

const renderPanel = ({
  search = '?repo=autoland',
  filterModel,
  isOpen = true,
  onClose = jest.fn(),
} = {}) => {
  const fm =
    filterModel || new FilterModel(mockNavigate, { search, pathname: '/jobs' });
  const target = createRef();

  return render(
    <MemoryRouter initialEntries={[`/jobs${search}`]}>
      <button type="button" ref={target}>
        anchor
      </button>
      <AdvancedFilterPanel
        isOpen={isOpen}
        onClose={onClose}
        target={target}
        filterModel={fm}
        classificationTypes={[{ id: 4, name: 'intermittent' }]}
      />
      <LocationSpy />
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

  it('renders nothing when closed', () => {
    renderPanel({ isOpen: false });
    expect(screen.queryByText('Advanced Filters')).not.toBeInTheDocument();
  });

  it('renders the Presets section last', () => {
    const { container } = renderPanel();
    const sections = container.querySelectorAll('.filter-panel-section');

    expect(sections[sections.length - 1]).toHaveTextContent('Presets');
  });

  it('Escape closes the panel', () => {
    const onClose = jest.fn();

    renderPanel({ onClose });
    fireEvent.keyDown(screen.getByLabelText('Author'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
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

  it('Enter applies a dirty push range from anywhere in the panel', () => {
    renderPanel();
    const authorInput = screen.getByLabelText('Author');

    fireEvent.change(authorInput, { target: { value: 'me@example.com' } });
    fireEvent.keyDown(authorInput, { key: 'Enter' });
    expect(currentSearch).toContain('author=me%40example.com');
  });

  it('Enter does nothing when the push range is clean', () => {
    renderPanel();
    const before = currentSearch;

    fireEvent.keyDown(screen.getByLabelText('Author'), { key: 'Enter' });
    expect(currentSearch).toBe(before);
  });

  it('Enter in the field-filter draft adds the filter without applying the push range', () => {
    const fm = new FilterModel(mockNavigate, {
      search: '?repo=autoland',
      pathname: '/jobs',
    });
    const spy = jest.spyOn(fm, 'addFilter');

    renderPanel({ filterModel: fm });
    const before = currentSearch;

    fireEvent.change(screen.getByLabelText('Field'), {
      target: { value: 'platform' },
    });
    const valueInput = screen.getByLabelText('New filter value');
    fireEvent.change(valueInput, { target: { value: 'linux' } });
    fireEvent.keyDown(valueInput, { key: 'Enter' });

    expect(spy).toHaveBeenCalledWith('platform', 'linux');
    expect(currentSearch).toBe(before);
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
