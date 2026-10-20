import { getData } from '../../../ui/helpers/http';
import { fetchFirstFailingTest } from '../../../ui/simple-view/helpers';

jest.mock('../../../ui/helpers/http');

const line = 'TEST-UNEXPECTED-FAIL | dom/tests/test_a.html | boom';

test('each job is asked once, whichever section asks first', async () => {
  getData.mockResolvedValue({ data: [{ line }] });
  const [a, b] = await Promise.all([
    fetchFirstFailingTest('try', 1),
    fetchFirstFailingTest('try', 1),
  ]);
  expect(a).toBe('dom/tests/test_a.html');
  expect(b).toBe(a);
  expect(getData).toHaveBeenCalledTimes(1);
});

test('a failed request is forgotten, so the next ask retries', async () => {
  getData.mockReset();
  getData
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ data: [{ line }] });
  expect(await fetchFirstFailingTest('try', 2)).toBeNull();
  expect(await fetchFirstFailingTest('try', 2)).toBe('dom/tests/test_a.html');
  expect(getData).toHaveBeenCalledTimes(2);
});
