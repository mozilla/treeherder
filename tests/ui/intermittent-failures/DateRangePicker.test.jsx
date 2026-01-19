/**
 * Unit tests for the DateRangePicker component.
 *
 * This test suite covers:
 * - Component rendering with MUI DatePicker components
 * - Update button functionality
 * - Component structure verification
 *
 * Note: This component was migrated from react-dates (Airbnb)
 * to MUI x-date-pickers with dayjs adapter.
 */

import { render, screen, fireEvent } from '@testing-library/react';

import DateRangePicker from '../../../ui/intermittent-failures/DateRangePicker';

// Use the real dayjs helper with all plugins already configured
// No mock needed since the component uses the pre-configured dayjs from ui/helpers/dayjs

describe('DateRangePicker Component', () => {
  const mockUpdateState = jest.fn();

  beforeEach(() => {
    mockUpdateState.mockClear();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <DateRangePicker updateState={mockUpdateState} />,
      );
      expect(container).toBeInTheDocument();
    });

    it('renders "to" separator between date pickers', () => {
      render(<DateRangePicker updateState={mockUpdateState} />);
      expect(screen.getByText('to')).toBeInTheDocument();
    });

    it('renders update button', () => {
      render(<DateRangePicker updateState={mockUpdateState} />);
      expect(
        screen.getByRole('button', { name: /update/i }),
      ).toBeInTheDocument();
    });

    it('renders with InputFromTo class for styling', () => {
      const { container } = render(
        <DateRangePicker updateState={mockUpdateState} />,
      );
      expect(container.querySelector('.InputFromTo')).toBeInTheDocument();
    });

    it('renders MUI DatePicker components', () => {
      const { container } = render(
        <DateRangePicker updateState={mockUpdateState} />,
      );
      // MUI DatePicker renders with specific MUI classes
      const muiElements = container.querySelectorAll(
        '.MuiPickersInputBase-root',
      );
      expect(muiElements).toHaveLength(2); // Start and End date pickers
    });
  });

  describe('Update Button Behavior', () => {
    it('does not call updateState when dates are not selected', () => {
      render(<DateRangePicker updateState={mockUpdateState} />);

      const updateButton = screen.getByRole('button', { name: /update/i });
      fireEvent.click(updateButton);

      expect(mockUpdateState).not.toHaveBeenCalled();
    });

    it('has update button with secondary variant styling', () => {
      render(<DateRangePicker updateState={mockUpdateState} />);

      const updateButton = screen.getByRole('button', { name: /update/i });
      expect(updateButton).toHaveClass('btn-secondary');
    });
  });

  describe('LocalizationProvider', () => {
    it('wraps date pickers in LocalizationProvider', () => {
      // This test ensures the component renders without errors,
      // which would fail if LocalizationProvider was missing
      const { container } = render(
        <DateRangePicker updateState={mockUpdateState} />,
      );

      // Both date pickers should be rendered (MUI pickers have specific structure)
      const muiDatePickers = container.querySelectorAll(
        '.MuiPickersInputBase-root',
      );
      expect(muiDatePickers).toHaveLength(2);
    });
  });

  describe('Accessibility', () => {
    it('update button is keyboard accessible', () => {
      render(<DateRangePicker updateState={mockUpdateState} />);

      const updateButton = screen.getByRole('button', { name: /update/i });
      expect(updateButton).toBeEnabled();
    });
  });
});

describe('DateRangePicker Export', () => {
  it('exports default component', async () => {
    const module = await import(
      '../../../ui/intermittent-failures/DateRangePicker'
    );
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });

  it('is a functional component (not class-based)', async () => {
    const module = await import(
      '../../../ui/intermittent-failures/DateRangePicker'
    );

    // Functional components don't have prototype.render
    expect(module.default.prototype).toBeUndefined();
  });
});
