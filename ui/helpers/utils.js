/* eslint-disable no-bitwise */

export const hashFunction = (someString) => {
  // Borrowed from https://github.com/darkskyapp/string-hash
  let hash = 5381;
  let i = someString.length;

  while (i) {
    hash = (hash * 33) ^ someString.charCodeAt(--i);
  }

  /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
   * integers. Since we want the results to be always positive, convert the
   * signed int to an unsigned by doing an unsigned bitshift. */
  return hash >>> 0;
};

export const scrollToLine = (selector, time, iteration = 0, options = true) => {
  const line = document.querySelector(selector);

  if (line !== null) {
    line.scrollIntoView(options);
    return;
  }
  if (iteration < 10) {
    setTimeout(() => scrollToLine(selector, time, iteration + 1), time);
  }
};
