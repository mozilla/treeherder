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

export const scrollToLine = (selector, options = true, timeout = 10000) => {
  const line = document.querySelector(selector);

  if (line !== null) {
    line.scrollIntoView(options);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let timeoutId;

    const observer = new MutationObserver(() => {
      const line = document.querySelector(selector);
      if (line !== null) {
        clearTimeout(timeoutId);
        observer.disconnect();
        line.scrollIntoView(options);
        resolve();
      }
    });

    timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Line ${selector} not found within timeout`));
    }, timeout);

    // Observe the log container for new elements
    const logContainer =
      document.querySelector('.log-contents') || document.body;
    observer.observe(logContainer, {
      childList: true,
      subtree: true,
    });
  });
};
