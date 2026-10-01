import { simpleViewFor } from '../../../ui/simple-view/phone';

const phone = { phone: true, fullView: false };

test('a desktop keeps the jobs view', () => {
  expect(
    simpleViewFor('?repo=try&revision=abc', { phone: false, fullView: false }),
  ).toBe(null);
});

test('a phone opening a shared push lands on that push', () => {
  expect(
    simpleViewFor('?repo=try&revision=41f3091&selectedTaskRun=x.0', phone),
  ).toBe('/simple?repo=try&revision=41f3091');
});

test('a phone opening a tree lands on the push list for that repo', () => {
  expect(simpleViewFor('?repo=autoland', phone)).toBe('/simple?repo=autoland');
  expect(simpleViewFor('', phone)).toBe('/simple');
});

test('choosing the full view on a phone is respected', () => {
  expect(
    simpleViewFor('?repo=try&revision=abc', { phone: true, fullView: true }),
  ).toBe(null);
});

test('an author in the link comes along', () => {
  expect(simpleViewFor('?repo=try&author=fqueze%40mozilla.com', phone)).toBe(
    '/simple?repo=try&author=fqueze%40mozilla.com',
  );
});
