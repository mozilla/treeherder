import path from 'path';

import { Polly } from '@pollyjs/core';
import PuppeteerAdapter from '@pollyjs/adapter-puppeteer';
import FsPersister from '@pollyjs/persister-fs';
import { setupPolly } from 'setup-polly-jest';

Polly.register(PuppeteerAdapter);
Polly.register(FsPersister);

/**
 * Common test utilities for Puppeteer integration tests
 */

export const DEFAULT_TIMEOUT = 30000;
export const NAVIGATION_TIMEOUT = 10000;

/**
 * Setup Polly for HTTP request recording/mocking
 * @param {string} testName - Name of the test for recording directory
 * @returns {Object} Polly context
 */
export const setupPollyForTest = (testName) => {
  return setupPolly({
    adapters: ['puppeteer'],
    adapterOptions: {
      puppeteer: { page },
    },
    persister: 'fs',
    persisterOptions: {
      fs: {
        recordingsDir: path.resolve(__dirname, '../recordings'),
      },
    },
    recordIfMissing: true,
    matchRequestsBy: {
      headers: {
        exclude: ['user-agent'],
      },
    },
  });
};

/**
 * Wait for page to load and be ready
 * @param {Page} page - Puppeteer page instance
 * @param {string} url - URL to navigate to
 * @param {Object} options - Navigation options
 */
export const navigateAndWaitForLoad = async (page, url, options = {}) => {
  await page.setRequestInterception(true);
  await page.setDefaultNavigationTimeout(options.timeout || NAVIGATION_TIMEOUT);

  await page.goto(url, {
    waitUntil: 'networkidle2',
    ...options,
  });

  // Wait for React to render
  await page.waitForSelector('body', { timeout: DEFAULT_TIMEOUT });
};

/**
 * Wait for element to be visible and clickable
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 * @param {Object} options - Wait options
 */
export const waitForClickableElement = async (page, selector, options = {}) => {
  await page.waitForSelector(selector, {
    visible: true,
    timeout: options.timeout || DEFAULT_TIMEOUT,
  });

  // Ensure element is not disabled
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      return element && !element.disabled && !element.hasAttribute('disabled');
    },
    { timeout: options.timeout || DEFAULT_TIMEOUT },
    selector,
  );
};

/**
 * Click element with retry logic
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 * @param {Object} options - Click options
 */
export const clickElement = async (page, selector, options = {}) => {
  await waitForClickableElement(page, selector, options);

  try {
    await page.click(selector, { clickCount: 1, ...options });
  } catch (error) {
    // Retry with JavaScript click if regular click fails
    await page.evaluate((sel) => {
      document.querySelector(sel).click();
    }, selector);
  }
};

/**
 * Type text into input field
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector for input
 * @param {string} text - Text to type
 * @param {Object} options - Type options
 */
export const typeIntoField = async (page, selector, text, options = {}) => {
  await waitForClickableElement(page, selector, options);

  // Clear existing text
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');

  // Type new text
  await page.type(selector, text, { delay: 50, ...options });
};

/**
 * Wait for text content to appear in element
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 * @param {string} expectedText - Expected text content
 * @param {Object} options - Wait options
 */
export const waitForTextContent = async (
  page,
  selector,
  expectedText,
  options = {},
) => {
  await page.waitForFunction(
    (sel, text) => {
      const element = document.querySelector(sel);
      return element && element.textContent.includes(text);
    },
    { timeout: options.timeout || DEFAULT_TIMEOUT },
    selector,
    expectedText,
  );
};

/**
 * Get text content from element
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 * @returns {Promise<string>} Text content
 */
export const getTextContent = async (page, selector) => {
  await page.waitForSelector(selector);
  return page.$eval(selector, (element) => element.textContent.trim());
};

/**
 * Get attribute value from element
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 * @param {string} attribute - Attribute name
 * @returns {Promise<string>} Attribute value
 */
export const getAttribute = async (page, selector, attribute) => {
  await page.waitForSelector(selector);
  return page.$eval(
    selector,
    (element, attr) => element.getAttribute(attr),
    attribute,
  );
};

/**
 * Check if element exists and is visible
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 * @returns {Promise<boolean>} True if element exists and is visible
 */
export const isElementVisible = async (page, selector) => {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: 1000 });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Wait for loading to complete
 * @param {Page} page - Puppeteer page instance
 * @param {Object} options - Wait options
 */
export const waitForLoadingComplete = async (page, options = {}) => {
  // Wait for common loading indicators to disappear
  const loadingSelectors = [
    '.loading-spinner',
    '.spinner',
    '[data-testid="loading"]',
    '.fa-spinner',
  ];

  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 2000 });
    } catch (error) {
      // Selector might not exist, continue
    }
  }

  // Wait for network to be idle
  (await page.waitForLoadState?.('networkidle')) ||
    page.waitForTimeout(options.timeout || 1000);
};

/**
 * Common setup for integration tests
 * @param {string} testName - Name of the test
 * @returns {Object} Test context with polly and helper functions
 */
export const setupIntegrationTest = (testName) => {
  const context = setupPollyForTest(testName);

  beforeEach(async () => {
    jest.setTimeout(60000);
    await page.setRequestInterception(true);
    await page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
  });

  afterEach(async () => {
    if (context.polly) {
      await context.polly.flush();
    }
  });

  return {
    context,
    navigateAndWaitForLoad: (url, options) =>
      navigateAndWaitForLoad(page, url, options),
    clickElement: (selector, options) => clickElement(page, selector, options),
    typeIntoField: (selector, text, options) =>
      typeIntoField(page, selector, text, options),
    waitForTextContent: (selector, text, options) =>
      waitForTextContent(page, selector, text, options),
    getTextContent: (selector) => getTextContent(page, selector),
    getAttribute: (selector, attribute) =>
      getAttribute(page, selector, attribute),
    isElementVisible: (selector) => isElementVisible(page, selector),
    waitForLoadingComplete: (options) => waitForLoadingComplete(page, options),
  };
};
