import path from 'path';

import { Polly } from '@pollyjs/core';
import PuppeteerAdapter from '@pollyjs/adapter-puppeteer';
import FsPersister from '@pollyjs/persister-fs';
import { setupPolly } from 'setup-polly-jest';

Polly.register(PuppeteerAdapter);
Polly.register(FsPersister);

describe('GraphsViewRecord Test Pupeteer', () => {
  const context = setupPolly({
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

  beforeEach(async () => {
    jest.setTimeout(60000);

    await page.setRequestInterception(true);
    await page.goto(`${URL}/perfherder/graphs`);
  });

  test('Record requests', async () => {
    expect(context.polly).not.toBeNull();

    // Set selector Add test data
    const addTestDataSelector = 'button[title="Add test data"]';

    // Wait for selector to appear in the page
    await page.waitForSelector(addTestDataSelector);

    // Click button Add test data
    await page.click(addTestDataSelector, { clickCount: 1 });

    // Check details from Add Test Data Modal
    await page.waitForSelector('div[title="Framework"]');

    const frameworks = await page.$$eval(
      'div[title="Framework"] a.dropdown-item',
      (element) => element.length,
    );

    expect(frameworks).toBe(9);

    // Wait for all requests to resolve
    await context.polly.flush();
  });
});
