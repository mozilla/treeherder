export const extendProperties = function extendProperties(dest, src) {
  /* Version of _.extend that works with property descriptors */
  if (dest !== src) {
    for (const key in src) {
      if (!Object.prototype.hasOwnProperty.call(src, key)) {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(src, key);
      if (descriptor && descriptor.get) {
        Object.defineProperty(dest, key, {
          get: descriptor.get,
          set: descriptor.set,
          enumerable: descriptor.enumerable,
          configurable: descriptor.configurable,
        });
      } else {
        dest[key] = src[key];
      }
    }
  }
  return dest;
};

export const didObjectsChange = (firstObj, secondObj, fields) =>
  fields.some((field) => firstObj[field] !== secondObj[field]);
