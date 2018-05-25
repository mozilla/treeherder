// eslint-disable-next-line import/prefer-default-export
export const extendProperties = function extendProperties(dest, src) {
  /* Version of _.extend that works with property descriptors */
  if (dest !== src) {
    for (const key in src) {
      if (!src.hasOwnProperty(key)) {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(src, key);
      if (descriptor && descriptor.get) {
        Object.defineProperty(dest, key, {
          get: descriptor.get,
          set: descriptor.set,
          enumerable: descriptor.enumerable,
          configurable: descriptor.configurable
        });
      } else {
        dest[key] = src[key];
      }
    }
  }
  return dest;
};
