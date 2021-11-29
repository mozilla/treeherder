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
    await page.setDefaultNavigationTimeout(3000);
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

  test('Clicking on Table View / Graphs view button should toggle between views', async () => {
    expect(context.polly).not.toBeNull();

    await page.goto(
      `${URL}/perfherder/graphs?highlightAlerts=1&highlightChangelogData=1&highlightCommonAlerts=0&series=mozilla-central,3140832,1,1&series=mozilla-central,3140831,1,1&timerange=86400`,
    );

    const toggleButton =
      'button[title="Toggle between table view and graphs view"]';

    await page.waitForSelector(toggleButton);

    const toggleButtonText = await page.$eval(
      toggleButton,
      (element) => element.innerText,
    );

    expect(toggleButtonText).toBe('Table View');

    await page.click(toggleButton, { clickCount: 1 });

    await page.waitForSelector(toggleButton);

    const toggleButtonTextAfterClick = await page.$eval(
      toggleButton,
      (element) => element.innerText,
    );

    expect(toggleButtonTextAfterClick).toBe('Graphs View');

    await context.polly.flush();
  });
});
