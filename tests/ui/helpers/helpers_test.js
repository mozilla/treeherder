import { displayNumber } from '../../../ui/perfherder/helpers';
import { getRevisionUrl } from '../../../ui/helpers/url';

describe('getRevisionUrl helper', () => {
  test('escapes some html symbols', () => {
    expect(getRevisionUrl('1234567890ab', 'mozilla-inbound')).toEqual(
      '/jobs?repo=mozilla-inbound&revision=1234567890ab',
    );
  });
});

describe('displayNumber helper', () => {
  test('returns expected values', () => {
    expect(displayNumber('123.53222')).toEqual('123.53');
    expect(displayNumber('123123123.53222')).toEqual('123123123.53');
    expect(displayNumber(1 / 0)).toEqual('Infinity');
    expect(displayNumber(Number.NaN)).toEqual('N/A');
  });
});
