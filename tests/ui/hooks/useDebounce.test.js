import { renderHook, act } from '@testing-library/react';

import {
  useDebouncedValue,
  useDebouncedCallback,
} from '../../../ui/hooks/useDebounce';

describe('useDebounce hooks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('useDebouncedValue', () => {
    it('returns the initial value immediately', () => {
      const { result } = renderHook(() => useDebouncedValue('initial', 500));

      expect(result.current).toBe('initial');
    });

    it('does not update value before delay has passed', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebouncedValue(value, delay),
        { initialProps: { value: 'initial', delay: 500 } },
      );

      rerender({ value: 'updated', delay: 500 });

      // Value should still be 'initial' before timeout
      expect(result.current).toBe('initial');

      // Advance time partially
      act(() => {
        jest.advanceTimersByTime(250);
      });

      // Should still be 'initial'
      expect(result.current).toBe('initial');
    });

    it('updates value after delay has passed', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebouncedValue(value, delay),
        { initialProps: { value: 'initial', delay: 500 } },
      );

      rerender({ value: 'updated', delay: 500 });

      // Advance time past the delay
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe('updated');
    });

    it('resets timer when value changes before delay', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebouncedValue(value, delay),
        { initialProps: { value: 'initial', delay: 500 } },
      );

      rerender({ value: 'first update', delay: 500 });

      // Advance partially
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Update again before delay completes
      rerender({ value: 'second update', delay: 500 });

      // Advance past first delay but not second
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should still be 'initial' because timer was reset
      expect(result.current).toBe('initial');

      // Complete the delay
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Now should be 'second update'
      expect(result.current).toBe('second update');
    });

    it('handles different delay values', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebouncedValue(value, delay),
        { initialProps: { value: 'initial', delay: 100 } },
      );

      rerender({ value: 'updated', delay: 100 });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current).toBe('updated');
    });

    it('works with different value types', () => {
      // Test with object
      const { result: objectResult, rerender: rerenderObject } = renderHook(
        ({ value, delay }) => useDebouncedValue(value, delay),
        { initialProps: { value: { count: 0 }, delay: 100 } },
      );

      const newObject = { count: 1 };
      rerenderObject({ value: newObject, delay: 100 });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(objectResult.current).toEqual({ count: 1 });

      // Test with number
      const { result: numberResult, rerender: rerenderNumber } = renderHook(
        ({ value, delay }) => useDebouncedValue(value, delay),
        { initialProps: { value: 0, delay: 100 } },
      );

      rerenderNumber({ value: 42, delay: 100 });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(numberResult.current).toBe(42);
    });

    it('handles zero delay', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebouncedValue(value, delay),
        { initialProps: { value: 'initial', delay: 0 } },
      );

      rerender({ value: 'updated', delay: 0 });

      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(result.current).toBe('updated');
    });
  });

  describe('useDebouncedCallback', () => {
    it('returns a function', () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 500));

      expect(typeof result.current).toBe('function');
    });

    it('does not call callback immediately', () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 500));

      result.current('test');

      expect(callback).not.toHaveBeenCalled();
    });

    it('calls callback after delay', () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 500));

      result.current('test');

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(callback).toHaveBeenCalledWith('test');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('passes all arguments to callback', () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 500));

      result.current('arg1', 'arg2', { key: 'value' });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' });
    });

    it('debounces multiple rapid calls', () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 500));

      result.current('first');
      result.current('second');
      result.current('third');

      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Only the last call should go through
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('third');
    });

    it('resets timer on each call', () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 500));

      result.current('first');

      act(() => {
        jest.advanceTimersByTime(300);
      });

      result.current('second');

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Callback should not have been called yet
      expect(callback).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Now it should be called with 'second'
      expect(callback).toHaveBeenCalledWith('second');
    });

    it('uses latest callback when callback changes', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const { result, rerender } = renderHook(
        ({ callback, delay }) => useDebouncedCallback(callback, delay),
        { initialProps: { callback: callback1, delay: 500 } },
      );

      result.current('test');

      // Change the callback before delay completes
      rerender({ callback: callback2, delay: 500 });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Should call the updated callback
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith('test');
    });

    it('cleans up timeout on unmount', () => {
      const callback = jest.fn();
      const { result, unmount } = renderHook(() =>
        useDebouncedCallback(callback, 500),
      );

      result.current('test');

      unmount();

      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Callback should not be called after unmount
      expect(callback).not.toHaveBeenCalled();
    });

    it('maintains stable reference when delay does not change', () => {
      const callback = jest.fn();
      const { result, rerender } = renderHook(
        ({ callback, delay }) => useDebouncedCallback(callback, delay),
        { initialProps: { callback, delay: 500 } },
      );

      const firstRef = result.current;

      // Rerender with same delay
      rerender({ callback, delay: 500 });

      const secondRef = result.current;

      // Reference should be stable
      expect(firstRef).toBe(secondRef);
    });

    it('creates new function when delay changes', () => {
      const callback = jest.fn();
      const { result, rerender } = renderHook(
        ({ callback, delay }) => useDebouncedCallback(callback, delay),
        { initialProps: { callback, delay: 500 } },
      );

      const firstRef = result.current;

      rerender({ callback, delay: 1000 });

      const secondRef = result.current;

      // Reference should change when delay changes
      expect(firstRef).not.toBe(secondRef);
    });
  });
});
