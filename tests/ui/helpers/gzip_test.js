import { gzip } from 'pako';

import decompress from '../../../ui/helpers/gzip';

describe('gzip related functions', () => {
  test('compress and decompress', async () => {
    const str = JSON.stringify({ foo: 'bar' });
    const compressed = await gzip(str);
    const decompressed = await decompress(compressed);
    expect(JSON.stringify(decompressed)).toBe(str);
  });
});
