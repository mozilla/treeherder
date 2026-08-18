import { createTaskLimiter } from '../../../ui/helpers/http';

describe('createTaskLimiter', () => {
  test('runs at most `limit` tasks concurrently and completes them all', async () => {
    const limiter = createTaskLimiter(2);
    let active = 0;
    let maxActive = 0;

    const makeTask = (result) => () => {
      active++;
      maxActive = Math.max(maxActive, active);
      return new Promise((resolve) => {
        setTimeout(() => {
          active--;
          resolve(result);
        }, 5);
      });
    };

    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => limiter(makeTask(n))),
    );

    expect(results).toEqual([1, 2, 3, 4, 5]);
    expect(maxActive).toBe(2);
  });

  test('keeps processing the queue after a task rejects', async () => {
    const limiter = createTaskLimiter(1);
    const failing = limiter(() => Promise.reject(new Error('boom')));
    const following = limiter(() => Promise.resolve('ok'));

    await expect(failing).rejects.toThrow('boom');
    await expect(following).resolves.toBe('ok');
  });
});
