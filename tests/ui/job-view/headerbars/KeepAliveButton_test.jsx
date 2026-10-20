import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import KeepAliveButton from '../../../../ui/job-view/headerbars/KeepAliveButton';
import { usePollControlStore } from '../../../../ui/shared/stores/pollControlStore';

describe('KeepAliveButton', () => {
  beforeEach(() => {
    usePollControlStore.setState({ keepAlive: false, pollingPaused: false });
  });

  afterEach(cleanup);

  test('toggles keep-alive when clicked', () => {
    render(<KeepAliveButton />);

    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(button);

    expect(usePollControlStore.getState().keepAlive).toBe(true);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });

  test('shows the paused indicator only while polling is paused', () => {
    const { rerender } = render(<KeepAliveButton />);
    expect(screen.queryByText('Updates paused')).toBeNull();

    usePollControlStore.setState({ pollingPaused: true });
    rerender(<KeepAliveButton />);

    expect(screen.getByText('Updates paused')).toBeInTheDocument();
  });
});
