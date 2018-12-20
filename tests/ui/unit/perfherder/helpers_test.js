import {
  calcPercentOf,
  calcAverage,
  getStdDev,
  getAlertStatusText,
} from '../../../../ui/perfherder/helpers';

test('calcPercent', () => {
  expect(calcPercentOf(10, 100)).toBe(10);

  expect(calcPercentOf(250, 1000)).toBe(25);

  expect(calcPercentOf(58670234, 0)).toBe(0);
});

test('calcAverage', () => {
  expect(calcAverage([1, 2, 3])).toBe(2);

  expect(calcAverage([])).toBe(0);

  expect(calcAverage([4])).toBe(4);

  expect(calcAverage([5, 5, 5])).toBe(5);
});

test('getStdDev', () => {
  expect(getStdDev([1], 10)).toBeUndefined();

  expect(getStdDev([2, 4, 4, 4, 5, 5, 7, 9], 5)).toBeCloseTo(2.14);

  expect(getStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.14);
});

test('getAlertStatusText', () => {
  const alert = { status: 0 };

  expect(getAlertStatusText(alert)).toBe('untriaged');

  alert.status = 1;
  expect(getAlertStatusText(alert)).toBe('downstream');

  alert.status = 2;
  expect(getAlertStatusText(alert)).toBe('reassigned');

  alert.status = 3;
  expect(getAlertStatusText(alert)).toBe('invalid');

  alert.status = 4;
  expect(getAlertStatusText(alert)).toBe('acknowledged');

  alert.status = 5;
  expect(getAlertStatusText(alert)).toBe('confirming');

  alert.status = 2340234; // nonexistent value
  expect(() => getAlertStatusText(alert)).toThrow(TypeError);
});
