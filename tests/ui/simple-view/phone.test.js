import {
  isMobileUserAgent,
  simpleViewFor,
} from '../../../ui/simple-view/phone';

const phone = { phone: true, fullView: false };

test('a desktop keeps the jobs view', () => {
  expect(
    simpleViewFor('?repo=try&revision=abc', { phone: false, fullView: false }),
  ).toBe(null);
});

test('a phone opening a shared push lands on that push, keeping every parameter', () => {
  expect(
    simpleViewFor('?repo=try&revision=41f3091&selectedTaskRun=x.0', phone),
  ).toBe('/simple?repo=try&revision=41f3091&selectedTaskRun=x.0');
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

describe('mobile detection by user agent', () => {
  const ua = {
    iPhone:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    pixel:
      'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    fenix: 'Mozilla/5.0 (Android 15; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
    macFirefox:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0',
    windowsTouchLaptop:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    linuxDesktop:
      'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
  };

  test.each(['iPhone', 'pixel', 'fenix'])('%s is mobile', (name) => {
    expect(isMobileUserAgent(ua[name])).toBe(true);
  });

  test.each(['macFirefox', 'windowsTouchLaptop', 'linuxDesktop'])(
    '%s is not',
    (name) => {
      expect(isMobileUserAgent(ua[name])).toBe(false);
    },
  );
});
