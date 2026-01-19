import { renderHook, act } from '@testing-library/react';

import {
  registerJobButton,
  unregisterJobButton,
  getJobButtonInstance,
  useJobButtonRegistry,
} from '../../../ui/hooks/useJobButtonRegistry';
import * as locationHelpers from '../../../ui/helpers/location';

// Mock the location helper
jest.mock('../../../ui/helpers/location', () => ({
  getUrlParam: jest.fn(),
}));

describe('useJobButtonRegistry', () => {
  beforeEach(() => {
    // Clear the registry before each test
    // We do this by unregistering any test IDs we might use
    ['1', '2', '3', '100', '200', '999'].forEach((id) => {
      unregisterJobButton(id);
    });

    // Reset mocks
    jest.clearAllMocks();
    locationHelpers.getUrlParam.mockReturnValue(null);
  });

  describe('registry functions', () => {
    describe('registerJobButton', () => {
      it('registers a job button instance', () => {
        const instance = { setSelected: jest.fn() };
        registerJobButton(1, instance);

        expect(getJobButtonInstance(1)).toBe(instance);
      });

      it('converts numeric job ID to string', () => {
        const instance = { setSelected: jest.fn() };
        registerJobButton(123, instance);

        // Should be retrievable by both number and string
        expect(getJobButtonInstance(123)).toBe(instance);
        expect(getJobButtonInstance('123')).toBe(instance);
      });

      it('overwrites existing registration for same ID', () => {
        const instance1 = { name: 'first' };
        const instance2 = { name: 'second' };

        registerJobButton(1, instance1);
        registerJobButton(1, instance2);

        expect(getJobButtonInstance(1)).toBe(instance2);
      });
    });

    describe('unregisterJobButton', () => {
      it('removes a job button instance from registry', () => {
        const instance = { setSelected: jest.fn() };
        registerJobButton(1, instance);

        unregisterJobButton(1);

        expect(getJobButtonInstance(1)).toBeUndefined();
      });

      it('handles unregistering non-existent ID gracefully', () => {
        expect(() => unregisterJobButton(999)).not.toThrow();
      });
    });

    describe('getJobButtonInstance', () => {
      it('returns undefined for non-existent ID', () => {
        expect(getJobButtonInstance(999)).toBeUndefined();
      });

      it('returns the registered instance', () => {
        const instance = { data: 'test' };
        registerJobButton(1, instance);

        expect(getJobButtonInstance(1)).toBe(instance);
      });

      it('handles string and number IDs equivalently', () => {
        const instance = { data: 'test' };
        registerJobButton('100', instance);

        expect(getJobButtonInstance(100)).toBe(instance);
        expect(getJobButtonInstance('100')).toBe(instance);
      });
    });
  });

  describe('useJobButtonRegistry hook', () => {
    const createMockJob = (overrides = {}) => ({
      id: 1,
      task_run: 'task-run-123',
      visible: true,
      ...overrides,
    });

    const createMockFilterModel = (overrides = {}) => ({
      showJob: jest.fn(() => true),
      ...overrides,
    });

    it('returns expected properties', () => {
      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      const { result } = renderHook(() =>
        useJobButtonRegistry(job, filterModel, filterPlatformCb),
      );

      expect(result.current).toHaveProperty('isSelected');
      expect(result.current).toHaveProperty('isRunnableSelected');
      expect(result.current).toHaveProperty('setSelected');
      expect(result.current).toHaveProperty('toggleRunnableSelected');
      expect(result.current).toHaveProperty('refilter');
      expect(result.current).toHaveProperty('buttonRef');
    });

    it('initializes isSelected based on URL param', () => {
      const job = createMockJob({ task_run: 'my-task-run' });
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      locationHelpers.getUrlParam.mockReturnValue('my-task-run');

      const { result } = renderHook(() =>
        useJobButtonRegistry(job, filterModel, filterPlatformCb),
      );

      expect(result.current.isSelected).toBe(true);
    });

    it('initializes isSelected as false when URL param does not match', () => {
      const job = createMockJob({ task_run: 'my-task-run' });
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      locationHelpers.getUrlParam.mockReturnValue('different-task-run');

      const { result } = renderHook(() =>
        useJobButtonRegistry(job, filterModel, filterPlatformCb),
      );

      expect(result.current.isSelected).toBe(false);
    });

    it('initializes isRunnableSelected as false', () => {
      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      const { result } = renderHook(() =>
        useJobButtonRegistry(job, filterModel, filterPlatformCb),
      );

      expect(result.current.isRunnableSelected).toBe(false);
    });

    describe('setSelected', () => {
      it('updates isSelected state', () => {
        const job = createMockJob();
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        const { result } = renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        expect(result.current.isSelected).toBe(false);

        act(() => {
          result.current.setSelected(true);
        });

        expect(result.current.isSelected).toBe(true);
      });

      it('calls filterModel.showJob to update visibility', () => {
        const job = createMockJob();
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        const { result } = renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        act(() => {
          result.current.setSelected(true);
        });

        expect(filterModel.showJob).toHaveBeenCalledWith(job);
      });

      it('calls filterPlatformCb with task_run when selecting', () => {
        const job = createMockJob({ task_run: 'test-task-run' });
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        const { result } = renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        act(() => {
          result.current.setSelected(true);
        });

        expect(filterPlatformCb).toHaveBeenCalledWith('test-task-run');
      });

      it('calls filterPlatformCb with null when deselecting', () => {
        const job = createMockJob({ task_run: 'test-task-run' });
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        locationHelpers.getUrlParam.mockReturnValue('test-task-run');

        const { result } = renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        // Initially selected based on URL
        expect(result.current.isSelected).toBe(true);

        act(() => {
          result.current.setSelected(false);
        });

        expect(filterPlatformCb).toHaveBeenCalledWith(null);
      });
    });

    describe('toggleRunnableSelected', () => {
      it('toggles isRunnableSelected state', () => {
        const job = createMockJob();
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        const { result } = renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        expect(result.current.isRunnableSelected).toBe(false);

        act(() => {
          result.current.toggleRunnableSelected();
        });

        expect(result.current.isRunnableSelected).toBe(true);

        act(() => {
          result.current.toggleRunnableSelected();
        });

        expect(result.current.isRunnableSelected).toBe(false);
      });
    });

    describe('refilter', () => {
      it('calls filterPlatformCb with current URL selectedTaskRun param', () => {
        const job = createMockJob();
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        const { result } = renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        locationHelpers.getUrlParam.mockReturnValue('url-task-run');

        act(() => {
          result.current.refilter();
        });

        expect(locationHelpers.getUrlParam).toHaveBeenCalledWith(
          'selectedTaskRun',
        );
        expect(filterPlatformCb).toHaveBeenCalledWith('url-task-run');
      });
    });

    describe('registration lifecycle', () => {
      it('registers job button on mount', () => {
        const job = createMockJob({ id: 100 });
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        const instance = getJobButtonInstance(100);
        expect(instance).toBeDefined();
        expect(instance.props.job).toBe(job);
      });

      it('unregisters job button on unmount', () => {
        const job = createMockJob({ id: 200 });
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        const { unmount } = renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        expect(getJobButtonInstance(200)).toBeDefined();

        unmount();

        expect(getJobButtonInstance(200)).toBeUndefined();
      });

      it('registered instance has setSelected method', () => {
        const job = createMockJob({ id: 100 });
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        const instance = getJobButtonInstance(100);
        expect(typeof instance.setSelected).toBe('function');
      });

      it('registered instance has toggleRunnableSelected method', () => {
        const job = createMockJob({ id: 100 });
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        const instance = getJobButtonInstance(100);
        expect(typeof instance.toggleRunnableSelected).toBe('function');
      });

      it('registered instance has refilter method', () => {
        const job = createMockJob({ id: 100 });
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        const instance = getJobButtonInstance(100);
        expect(typeof instance.refilter).toBe('function');
      });

      it('updates registration when job changes', () => {
        const job1 = createMockJob({ id: 1, task_run: 'task-1' });
        const job2 = createMockJob({ id: 1, task_run: 'task-2' });
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        const { rerender } = renderHook(
          ({ job }) => useJobButtonRegistry(job, filterModel, filterPlatformCb),
          { initialProps: { job: job1 } },
        );

        expect(getJobButtonInstance(1).props.job.task_run).toBe('task-1');

        rerender({ job: job2 });

        expect(getJobButtonInstance(1).props.job.task_run).toBe('task-2');
      });
    });

    describe('buttonRef callback', () => {
      it('returns a function for buttonRef', () => {
        const job = createMockJob();
        const filterModel = createMockFilterModel();
        const filterPlatformCb = jest.fn();

        const { result } = renderHook(() =>
          useJobButtonRegistry(job, filterModel, filterPlatformCb),
        );

        expect(typeof result.current.buttonRef).toBe('function');
      });
    });
  });
});
