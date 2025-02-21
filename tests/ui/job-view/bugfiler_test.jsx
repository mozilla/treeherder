import React from 'react';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import fetchMock from 'fetch-mock';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import configureMockStore from 'redux-mock-store';

import { bzComponentEndpoint, bzBaseUrl } from '../../../ui/helpers/url';
import { isReftest } from '../../../ui/helpers/job';
import { BugFilerClass } from '../../../ui/shared/BugFiler';

const mockStore = configureMockStore([thunk]);

describe('BugFiler', () => {
  const fullLog =
    'https://taskcluster.net/api/queue/v1/task/AGs4CgN_RnCTb943uQn8NQ/runs/0/artifacts/public/logs/live_backing.log';
  const parsedLog =
    'http://localhost:5000/logviewer.html#?job_id=89017089&repo=autoland';
  const reftest = '';
  const selectedJob = {
    job_group_name: 'Mochitests executed by TaskCluster',
    job_type_name: 'test-linux64/debug-mochitest-browser-chrome-10',
    job_type_symbol: 'bc10',
    platform: 'windows11-64',
  };
  const suggestions = [
    {
      search: 'ShutdownLeaks | process() called before end of test suite',
    },
    {
      search:
        'browser/components/search/test/browser_searchbar_smallpanel_keyboard_navigation.js | application terminated with exit code 11',
    },
    {
      search:
        'browser/components/search/test/browser_searchbar_smallpanel_keyboard_navigation.js | application crashed [@ js::GCMarker::eagerlyMarkChildren]',
    },
    {
      search:
        'leakcheck | default process: missing output line for total leaks!',
    },
    { search: '# TBPL FAILURE #' },
  ];

  const PdfSuggestions = [
    {
      bugs: {},
      line_number: 10,
      path_end: 'browser/extensions/pdfjs/test/browser_pdfjs_views.js',
      search_terms: [],
      search:
        'TEST-UNEXPECTED-FAIL | browser/extensions/pdfjs/test/browser_pdfjs_views.js | Test timed out -',
    },
    {
      bugs: {},
      line_number: 235,
      path_end: 'browser/extensions/pdfjs/test/browser_pdfjs_views.js',
      search_terms: [],
      search:
        'TEST-UNEXPECTED-FAIL | browser/extensions/pdfjs/test/browser_pdfjs_views.js | Found a tab after previous test timed out: about:blank -',
    },
    {
      bugs: {},
      line_number: 783,
      path_end: 'flee',
      search_terms: [],
      search: 'REFTEST TEST-UNEXPECTED-PASS | flee | floo',
    },
  ];

  const successCallback = () => {};
  const toggle = () => {};
  const isOpen = true;

  beforeEach(async () => {
    fetchMock.mock(
      `/api${bzComponentEndpoint}?path=browser%2Fextensions%2Fpdfjs%2Ftest%2Fbrowser_pdfjs_views.js`,
      [
        {
          product: 'Mock Product',
          component: 'Mock Component',
        },
      ],
    );

    fetchMock.mock(
      `${bzBaseUrl}rest/prod_comp_search/find/firefox%20::%20search?limit=5`,
      {
        products: [
          { product: 'Firefox' },
          { component: 'Search', product: 'Firefox' },
          { product: 'Marketplace' },
          { component: 'Search', product: 'Marketplace' },
          { product: 'Firefox for Android' },
          { component: 'Search Activity', product: 'Firefox for Android' },
          { product: 'Firefox OS' },
          { component: 'Gaia::Search', product: 'Firefox OS' },
          { product: 'Cloud Services' },
          { component: 'Operations: Storage', product: 'Cloud Services' },
        ],
      },
    );
  });

  afterEach(() => {
    cleanup();
    fetchMock.reset();
  });

  const store = mockStore({});
  const bugFilerComponentSuggestions = (suggestions) => (
    <Provider store={store}>
      <BugFilerClass
        isOpen={isOpen}
        toggle={toggle}
        suggestion={suggestions[0]}
        suggestions={suggestions}
        fullLog={fullLog}
        parsedLog={parsedLog}
        reftestUrl={isReftest(selectedJob) ? reftest : ''}
        successCallback={successCallback}
        jobGroupName={selectedJob.job_group_name}
        jobTypeName={selectedJob.job_type_name}
        platform={selectedJob.platform}
        notify={() => {}}
      />
    </Provider>
  );

  const bugFilerComponentSuggestion = (suggestion) => (
    <Provider store={store}>
      <BugFilerClass
        isOpen={isOpen}
        toggle={toggle}
        suggestion={suggestion}
        suggestions={suggestions}
        fullLog={fullLog}
        parsedLog={parsedLog}
        reftestUrl={isReftest(selectedJob) ? reftest : ''}
        successCallback={successCallback}
        jobGroupName={selectedJob.job_group_name}
        jobTypeName={selectedJob.job_type_name}
        platform={selectedJob.platform}
        notify={() => {}}
      />
    </Provider>
  );

  function SummaryAndExpected(summary) {
    const suggestion = {
      summary,
      search_terms: [
        'browser_searchbar_smallpanel_keyboard_navigation.js", "[@ js::GCMarker::eagerlyMarkChildren]',
      ],
      search: summary,
    };

    render(bugFilerComponentSuggestion(suggestion));
    const area = screen.getAllByRole('textbox');
    // TODO: hardcoded '1' in the array index
    // TODO: this used to check specific areas of summary,
    //       I cannot find the parts individually in the rendered html.
    return area[1];
  }

  test('parses a crash suggestion', () => {
    const rawSummary =
      'PROCESS-CRASH | browser/components/search/test/browser_searchbar_smallpanel_keyboard_navigation.js | application crashed [@ js::GCMarker::eagerlyMarkChildren]';
    const expected =
      'Intermittent browser/components/search/test/browser_searchbar_smallpanel_keyboard_navigation.js | single tracking bug';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toHaveValue(expected);
  });

  test('should parse mochitest-bc summaries', () => {
    const rawSummary =
      'browser/components/sessionstore/test/browser_625016.js | observe1: 1 window in data written to disk - Got 0, expected 1';
    const expected =
      'Intermittent browser/components/sessionstore/test/browser_625016.js | single tracking bug';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toHaveValue(expected);
  });

  test('should parse accessibility summaries', () => {
    const rawSummary =
      'chrome://mochitests/content/a11y/accessible/tests/mochitest/states/test_expandable.xul' +
      ' | uncaught exception - TypeError: this.textbox.popup.oneOffButtons is undefined at ' +
      'searchbar_XBL_Constructor@chrome://browser/content/search/search.xml:95:9';
    const expected =
      'Intermittent accessible/tests/mochitest/states/test_expandable.xul | uncaught exception - TypeError: this.textbox.popup.oneOffButtons is undefined at searchbar_XBL_Constructor@chrome://browser/content/search/search.xml:95:9';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toHaveValue(expected);
  });

  test('should parse xpcshell summaries', () => {
    const rawSummary =
      'xpcshell-child-process.ini:dom/indexedDB/test/unit/test_rename_objectStore_errors.js | application crashed [@ mozalloc_abort(char const*)]';
    const expected =
      'Intermittent dom/indexedDB/test/unit/test_rename_objectStore_errors.js | single tracking bug';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toHaveValue(expected);
  });

  test('should parse xpcshell unpack summaries', () => {
    const rawSummary =
      'xpcshell-unpack.ini:dom/indexedDB/test/unit/test_rename_objectStore_errors.js | application crashed [@ mozalloc_abort(char const*)]';
    const expected =
      'Intermittent dom/indexedDB/test/unit/test_rename_objectStore_errors.js | single tracking bug';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toHaveValue(expected);
  });

  test('should parse xpcshell dom summaries', () => {
    const rawSummary =
      'xpcshell.ini:dom/indexedDB/test/unit/test_rename_objectStore_errors.js | application crashed [@ mozalloc_abort(char const*)]';
    const expected =
      'Intermittent dom/indexedDB/test/unit/test_rename_objectStore_errors.js | single tracking bug';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toHaveValue(expected);
  });

  test('should parse Windows reftests on C drive summaries', () => {
    const rawSummary =
      'file:///C:/slave/test/build/tests/reftest/tests/layout/reftests/w3c-css/submitted/variables/variable-supports-12.html | application timed out after 330 seconds with no output';
    const expected =
      'Intermittent layout/reftests/w3c-css/submitted/variables/variable-supports-12.html | application timed out after 330 seconds with no output';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toHaveValue(expected);
  });

  test('should parse Linux reftest summaries', () => {
    const rawSummary =
      'file:///home/worker/workspace/build/tests/reftest/tests/image/test/reftest/encoders-lossless/size-7x7.png | application timed out after 330 seconds with no output';
    const expected =
      'Intermittent image/test/reftest/encoders-lossless/size-7x7.png | application timed out after 330 seconds with no output';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toHaveValue(expected);
  });

  test('should parse Windows reftests on Z drive summaries', () => {
    const rawSummary =
      'file:///Z:/task_1491428153/build/tests/reftest/tests/layout/reftests/font-face/src-list-local-full.html == file:///Z:/task_1491428153/build/tests/reftest/tests/layout/reftests/font-face/src-list-local-full-ref.html | image comparison, max difference: 255, number of differing pixels: 5184';
    const expected =
      'Intermittent layout/reftests/font-face/src-list-local-full.html == layout/reftests/font-face/src-list-local-full-ref.html | image comparison, max difference: 255, number of differing pixels: 5184';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toHaveValue(expected);
  });

  test('should parse android reftests summaries', () => {
    const rawSummary =
      'http://10.0.2.2:8854/tests/layout/reftests/css-display/display-contents-style-inheritance-1.html == http://10.0.2.2:8854/tests/layout/reftests/css-display/display-contents-style-inheritance-1-ref.html | image comparison, max difference: 255, number of differing pixels: 699';
    const expected =
      'Intermittent layout/reftests/css-display/display-contents-style-inheritance-1.html == layout/reftests/css-display/display-contents-style-inheritance-1-ref.html | image comparison, max difference: 255, number of differing pixels: 699';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toHaveValue(expected);
  });

  test('should parse reftest unexpected pass summaries', () => {
    const rawSummary =
      'REFTEST TEST-UNEXPECTED-PASS | file:///home/worker/workspace/build/tests/reftest/tests/layout/' +
      'reftests/backgrounds/vector/empty/wide--cover--width.html == file:///home/worker/workspace/' +
      'build/tests/reftest/tests/layout/reftests/backgrounds/vector/empty/ref-wide-lime.html | image comparison';
    const expected =
      'Intermittent TEST-UNEXPECTED-PASS | layout/reftests/backgrounds/vector/empty/wide--cover--width.html == layout/reftests/backgrounds/vector/empty/ref-wide-lime.html | image comparison';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toHaveValue(expected);
  });

  test('should use test name for unexpected crashes if signature missing', () => {
    const rawSummary =
      'TEST-UNEXPECTED-CRASH | /referrer-policy/gen/top.meta/never/sharedworker-module.http.html | expected OK';
    const expected =
      'Intermittent TEST-UNEXPECTED-CRASH | /referrer-policy/gen/top.meta/never/sharedworker-module.http.html | expected OK';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toBeInTheDocument(expected);
  });

  test('should extract crash signature', async () => {
    const suggestions = [
      {
        bugs: {},
        search_terms: [],
        search:
          'PROCESS-CRASH | application crashed [@ servo_arc::HeaderSlice<H,T>::slice] | dom/tests/mochitest/pointerlock/test_pointerlock-api.html',
      },
    ];

    render(bugFilerComponentSuggestions(suggestions));
    const signatureArea = screen.getByDisplayValue(
      '[@ servo_arc::HeaderSlice<H,T>::slice]',
    );
    expect(signatureArea).toBeInTheDocument();
  });

  test('crash signature field should be empty for non-crash issues', async () => {
    const suggestions = [
      {
        bugs: {},
        search_terms: [],
        search:
          'TEST-UNEXPECTED-FAIL | dom/tests/mochitest/webvr/test_webvr.html | this passed',
      },
    ];

    render(bugFilerComponentSuggestions(suggestions));
    const signatureArea = screen.queryByDisplayValue('test_webvr.html');
    expect(signatureArea).toBeNull();
  });

  test('should set as security bug if summary contains initially a relevant search term', async () => {
    const suggestions = [
      {
        bugs: {},
        search_terms: [],
        search:
          'SUMMARY: AddressSanitizer: heap-use-after-free /builds/worker/checkouts/gecko/mock/folder/file.c:12:34 in mock::MockComponent::MockMethod(mock::squirrel::Weasel*)',
      },
    ];
    render(bugFilerComponentSuggestions(suggestions));
    const securityIssue = screen.getByText('Report this as a security issue');
    expect(securityIssue).toBeTruthy();
  });

  test('should not set as security bug if summary contains initially no relevant search term', async () => {
    const suggestions = [
      {
        bugs: {},
        search_terms: [],
        search:
          'TEST-UNEXPECTED-FAIL | mock/folder/test/subfolder/browser_test.js | Test timed out -',
      },
    ];

    render(bugFilerComponentSuggestions(suggestions));
    const securityIssue = screen.getByText('Report this as a security issue');
    expect(securityIssue.checked).toBeFalsy();
  });

  test('should parse finding the filename when the `TEST-FOO` is not omitted', () => {
    const rawSummary =
      'TEST-UNEXPECTED-CRASH | /service-workers/service-worker/xhr.https.html | expected OK';
    const expected =
      'TEST-UNEXPECTED-CRASH | /service-workers/service-worker/xhr.https.html | expected OK';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toBeInTheDocument(expected);
  });

  test('should strip omitted leads from thisFailure', async () => {
    render(bugFilerComponentSuggestions(PdfSuggestions));

    const toggleSummary = screen.getByTitle('expand');
    await fireEvent.click(toggleSummary);

    // TODO: hardcoded '2' value - how to get textarea for expanded field
    const area = screen.getAllByRole('textbox');
    expect(area[2]).toHaveValue(
      'browser/extensions/pdfjs/test/browser_pdfjs_views.js | Test timed out -\n' +
        'browser/extensions/pdfjs/test/browser_pdfjs_views.js | Found a tab after previous test timed out: about:blank -\n' +
        'TEST-UNEXPECTED-PASS | flee | floo',
    );
  });

  test('should have summary as "single tracking bug"', () => {
    const rawSummary =
      'PROCESS-CRASH | application crashed [@ libc.so.6 + 0x0000000000114cf9] | /storage/estimate-usage-details-indexeddb.https.tentative.any.html';
    const expected =
      'application crashed [@ libc.so.6 + 0x0000000000114cf9] | single tracking bug';
    const displayed = SummaryAndExpected(rawSummary);
    expect(displayed).toBeInTheDocument(expected);
  });
});
