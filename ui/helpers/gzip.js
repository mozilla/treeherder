import { inflate } from 'pako';

export const unGzip = async (binData) => {
  const decompressed = await inflate(binData, { to: 'string' });
  return JSON.parse(decompressed);
};

export default unGzip;
