import { authorName, pushUrl } from '../../../ui/simple-view/helpers';
import { LIST } from '../../../ui/simple-view/constants';
import {
  clearRecentPeople,
  personName,
  recentPeople,
  rememberPerson,
} from '../../../ui/simple-view/cache';

beforeEach(() => localStorage.clear());

test("a push's author name comes from its commits", () => {
  const push = {
    author: 'rcurran@mozilla.com',
    revisions: [
      { author: 'Ryan Curran <rcurran@mozilla.com>' },
      { author: 'Someone Else <else@example.com>' },
    ],
  };
  expect(authorName(push)).toBe('Ryan Curran');
  // Pushed from one address, committed from another: one name is still one name.
  expect(
    authorName({
      author: 'fqueze@mozilla.com',
      revisions: [{ author: 'Florian Quèze <florian@queze.net>' }],
    }),
  ).toBe('Florian Quèze');
  expect(authorName({ author: 'x@y', revisions: [] })).toBe(null);
});

test('recent people are newest first, deduplicated, and keep their names', () => {
  rememberPerson('rcurran@mozilla.com', 'Ryan Curran');
  rememberPerson('fqueze@mozilla.com', 'Florian Quèze');
  rememberPerson('RCURRAN@mozilla.com');
  expect(recentPeople().map((p) => p.email)).toEqual([
    'rcurran@mozilla.com',
    'fqueze@mozilla.com',
  ]);
  expect(personName('rcurran@mozilla.com')).toBe('Ryan Curran');
});

test('links carry the author, and an empty one asks', () => {
  expect(pushUrl({ repo: 'try', author: 'a@b.c', revision: 'abc' })).toBe(
    '/simple?repo=try&revision=abc&author=a%40b.c',
  );
  expect(pushUrl({ repo: 'try', author: '' })).toBe('/simple?repo=try&author=');
  expect(pushUrl({ repo: 'try', author: null })).toBe('/simple?repo=try');
  expect(LIST.title('Florian Quèze')).toBe('Florian’s pushes');
});

test('clearing forgets everyone', () => {
  rememberPerson('rcurran@mozilla.com', 'Ryan Curran');
  rememberPerson('fqueze@mozilla.com', 'Florian Quèze');
  clearRecentPeople();
  expect(recentPeople()).toEqual([]);
  expect(personName('rcurran@mozilla.com')).toBe(null);
});
