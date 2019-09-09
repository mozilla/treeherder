import { getAction } from '../../../ui/helpers/taskcluster';

describe('taskcluster helper', () => {
  const results = [{ name: 'foo' }, { name: 'bar' }, { name: 'baz' }];

  test('getAction finds the right action', () => {
    const action = getAction(results, 'baz');

    expect(action).toEqual({ name: 'baz' });
  });

  test('getAction throws exception when action is missing', () => {
    const results = [{ name: 'foo' }, { name: 'bar' }, { name: 'baz' }];

    expect(() => getAction(results, 'meh')).toThrow(
      "'meh' action is not available for this task.  Available: foo, bar, baz",
    );
  });
});
