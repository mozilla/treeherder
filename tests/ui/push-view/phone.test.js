import { pushViewFor } from '../../../ui/push-view/phone';

const phone = { phone: true, fullView: false };

test('a desktop keeps the jobs view', () => {
  expect(
    pushViewFor('?repo=try&revision=abc', { phone: false, fullView: false }),
  ).toBe(null);
});

test('a phone opening a shared push lands on that push', () => {
  expect(
    pushViewFor('?repo=try&revision=41f3091&selectedTaskRun=x.0', phone),
  ).toBe('/push?repo=try&revision=41f3091');
});

test('a phone opening a tree lands on the push list for that repo', () => {
  expect(pushViewFor('?repo=autoland', phone)).toBe('/push?repo=autoland');
  expect(pushViewFor('', phone)).toBe('/push');
});

test('choosing the full view on a phone is respected', () => {
  expect(
    pushViewFor('?repo=try&revision=abc', { phone: true, fullView: true }),
  ).toBe(null);
});
