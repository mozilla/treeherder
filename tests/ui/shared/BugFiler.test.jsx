import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';

import { BugFilerClass } from '../../../ui/shared/BugFiler';
import * as httpHelpers from '../../../ui/helpers/http';
import * as jobHelpers from '../../../ui/helpers/job';
import * as bugHelpers from '../../../ui/helpers/bug';

// Mock the helpers
jest.mock('../../../ui/helpers/http', () => ({
  create: jest.fn(),
}));

jest.mock('../../../ui/helpers/job', () => ({
  confirmFailure: jest.fn(),
}));

jest.mock('../../../ui/helpers/bug', () => ({
  omittedLeads: ['TEST-UNEXPECTED-FAIL', 'TEST-UNEXPECTED-ERROR'],
  parseSummary: jest.fn().mockReturnValue([['Test failure | test_file.js']]),
  getCrashSignatures: jest.fn(),
}));

jest.mock('../../../ui/helpers/url', () => ({
  bugzillaBugsApi: jest
    .fn()
    .mockReturnValue('https://bugzilla-api.mozilla.org/rest/bug'),
  bzBaseUrl: 'https://bugzilla.mozilla.org/',
  bzComponentEndpoint: '/component_search',
  getApiUrl: jest.fn().mockReturnValue('/api/bugzilla/create_bug/'),
}));

describe('BugFiler', () => {
  const defaultProps = {
    isOpen: true,
    toggle: jest.fn(),
    suggestion: {
      search: 'TEST-UNEXPECTED-FAIL | test_file.js | Test failure',
      search_terms: ['test_file.js', 'Test failure'],
      path_end: 'dom/tests/test_file.js',
      bugs: {
        open_recent: [],
        all_others: [],
      },
    },
    suggestions: [
      {
        search: 'TEST-UNEXPECTED-FAIL | test_file.js | Test failure',
        search_terms: ['test_file.js', 'Test failure'],
        path_end: 'dom/tests/test_file.js',
        bugs: {
          open_recent: [],
          all_others: [],
        },
      },
    ],
    fullLog: 'https://example.com/full-log',
    parsedLog: 'https://example.com/parsed-log',
    reftestUrl: 'https://example.com/reftest',
    successCallback: jest.fn(),
    platform: 'linux',
    notify: jest.fn(),
    selectedJob: {
      job_group_name: 'test-group',
      job_type_name: 'test-job',
    },
    currentRepo: { name: 'mozilla-central' },
    decisionTaskMap: {},
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set default return value for getCrashSignatures
    bugHelpers.getCrashSignatures.mockReturnValue([]);

    // Mock fetch for API calls
    fetchMock.reset();
    fetchMock.get('https://bugzilla-api.mozilla.org/rest/bug', {
      products: [
        {
          versions: [
            { name: '1.0', is_active: true },
            { name: '2.0', is_active: true },
          ],
        },
      ],
    });
    fetchMock.get(
      'https://bugzilla.mozilla.org/rest/prod_comp_search/find/Firefox?limit=5',
      {
        products: [
          { product: 'Firefox', component: 'General' },
          { product: 'Firefox', component: 'Menus' },
        ],
      },
    );
    fetchMock.get('/api/component_search?path=dom%2Ftests%2Ftest_file.js', [
      { product: 'Core', component: 'DOM' },
      { product: 'Core', component: 'DOM: Core & HTML' },
    ]);

    // Mock http.create
    httpHelpers.create.mockResolvedValue({
      data: { id: 123456, internal_id: 'internal-123' },
      failureStatus: false,
    });
  });

  afterEach(() => {
    fetchMock.restore();
  });

  it('renders correctly when open', () => {
    render(<BugFilerClass {...defaultProps} />);

    // Check that the modal is rendered
    expect(screen.getByText('Intermittent Bug Filer')).toBeInTheDocument();

    // Check that the form elements are rendered
    expect(
      screen.getByPlaceholderText('e.g. Firefox, Toolkit, Testing'),
    ).toBeInTheDocument();
    expect(screen.getByText('Summary:')).toBeInTheDocument();
    expect(screen.getByText('Comment:')).toBeInTheDocument();
    expect(
      screen.getByText('This is an intermittent failure'),
    ).toBeInTheDocument();
    expect(screen.getByText('Submit Bug')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('initializes state correctly', () => {
    render(<BugFilerClass {...defaultProps} />);

    // Check that the summary field is initialized correctly
    const summaryInput = screen.getByPlaceholderText('Intermittent...');
    expect(summaryInput).toHaveValue(
      'Intermittent Test failure | test_file.js',
    );

    // Check that the log links are checked by default
    const parsedLogCheckbox = screen.getByRole('checkbox', {
      name: /include parsed log link/i,
    });
    const fullLogCheckbox = screen.getByRole('checkbox', {
      name: /include full log link/i,
    });
    const reftestCheckbox = screen.getByRole('checkbox', {
      name: /include reftest viewer link/i,
    });

    expect(parsedLogCheckbox).toBeChecked();
    expect(fullLogCheckbox).toBeChecked();
    expect(reftestCheckbox).toBeChecked();

    // Check that "This is an intermittent failure" is checked by default
    const intermittentCheckbox = screen.getByRole('checkbox', {
      name: /this is an intermittent failure/i,
    });
    expect(intermittentCheckbox).toBeChecked();
  });

  it('calls toggle when Cancel is clicked', () => {
    render(<BugFilerClass {...defaultProps} />);

    // Click the Cancel button
    fireEvent.click(screen.getByText('Cancel'));

    // Check that toggle was called
    expect(defaultProps.toggle).toHaveBeenCalled();
  });

  it('toggles log link checkboxes when clicked', () => {
    render(<BugFilerClass {...defaultProps} />);

    // Get the checkboxes
    const parsedLogCheckbox = screen.getByRole('checkbox', {
      name: /include parsed log link/i,
    });
    const fullLogCheckbox = screen.getByRole('checkbox', {
      name: /include full log link/i,
    });

    // Initially, they should be checked
    expect(parsedLogCheckbox).toBeChecked();
    expect(fullLogCheckbox).toBeChecked();

    // Click the parsed log checkbox
    fireEvent.click(parsedLogCheckbox);

    // Now it should be unchecked
    expect(parsedLogCheckbox).not.toBeChecked();

    // The full log checkbox should still be checked
    expect(fullLogCheckbox).toBeChecked();
  });

  it('toggles "This is an intermittent failure" checkbox when clicked', () => {
    render(<BugFilerClass {...defaultProps} />);

    // Get the checkbox
    const intermittentCheckbox = screen.getByRole('checkbox', {
      name: /this is an intermittent failure/i,
    });

    // Initially, it should be checked
    expect(intermittentCheckbox).toBeChecked();

    // Click the checkbox
    fireEvent.click(intermittentCheckbox);

    // Now it should be unchecked
    expect(intermittentCheckbox).not.toBeChecked();
  });

  it('updates summary when input changes', () => {
    render(<BugFilerClass {...defaultProps} />);

    // Get the summary input
    const summaryInput = screen.getByPlaceholderText('Intermittent...');

    // Initially, it should have the default value
    expect(summaryInput).toHaveValue(
      'Intermittent Test failure | test_file.js',
    );

    // Change the input value
    fireEvent.change(summaryInput, { target: { value: 'New summary' } });

    // Now it should have the new value
    expect(summaryInput).toHaveValue('New summary');
  });

  it('updates comment when input changes', () => {
    render(<BugFilerClass {...defaultProps} />);

    // Get the comment textarea
    const commentTextarea = screen.getByLabelText('Comment:');

    // Initially, it should be empty
    expect(commentTextarea).toHaveValue('');

    // Change the input value
    fireEvent.change(commentTextarea, { target: { value: 'New comment' } });

    // Now it should have the new value
    expect(commentTextarea).toHaveValue('New comment');
  });

  it('searches for products when Find Product button is clicked', async () => {
    render(<BugFilerClass {...defaultProps} />);

    // Get the product search input and button
    const productSearchInput = screen.getByPlaceholderText(
      'e.g. Firefox, Toolkit, Testing',
    );
    const findProductButton = screen.getByText('Find Product');

    // Enter a search term
    fireEvent.change(productSearchInput, { target: { value: 'Firefox' } });

    // Click the Find Product button
    fireEvent.click(findProductButton);

    // Wait for the search to complete
    await waitFor(() => {
      // Check that the fetch was called with the correct URL
      expect(
        fetchMock.called(
          'https://bugzilla.mozilla.org/rest/prod_comp_search/find/Firefox?limit=5',
        ),
      ).toBe(true);

      // Check that the suggested products are rendered
      expect(screen.getByText('Firefox :: General')).toBeInTheDocument();
      expect(screen.getByText('Firefox :: Menus')).toBeInTheDocument();
    });
  });

  it('finds product by path on component mount', async () => {
    render(<BugFilerClass {...defaultProps} />);

    // Wait for the search to complete
    await waitFor(() => {
      // Check that the fetch was called with the correct URL
      expect(
        fetchMock.called(
          '/api/component_search?path=dom%2Ftests%2Ftest_file.js',
        ),
      ).toBe(true);

      // Check that the suggested products are rendered
      expect(screen.getByText('Core :: DOM')).toBeInTheDocument();
      expect(screen.getByText('Core :: DOM: Core & HTML')).toBeInTheDocument();
    });
  });

  it('submits the bug when Submit Bug button is clicked', async () => {
    render(<BugFilerClass {...defaultProps} />);

    // Wait for the product search to complete
    await waitFor(() => {
      expect(screen.getByText('Core :: DOM')).toBeInTheDocument();
    });

    // Select a product
    const productRadio = screen.getByLabelText('Core :: DOM');
    fireEvent.click(productRadio);

    // Click the Submit Bug button
    fireEvent.click(screen.getByText('Submit Bug'));

    // Wait for the submission to complete
    await waitFor(() => {
      // Check that create was called with the correct parameters
      expect(httpHelpers.create).toHaveBeenCalledWith(
        '/api/bugzilla/create_bug/',
        expect.objectContaining({
          product: 'Core',
          component: 'DOM',
          summary: 'Intermittent Test failure | test_file.js',
          keywords: ['intermittent-failure'],
        }),
      );

      // Check that toggle and successCallback were called
      expect(defaultProps.toggle).toHaveBeenCalled();
      expect(defaultProps.successCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 123456,
          internal_id: 'internal-123',
        }),
      );
    });
  });

  it('shows an error notification if product is not selected', async () => {
    // Render with no suggested products
    bugHelpers.getCrashSignatures.mockReturnValue(['SIGNATURE']);
    render(<BugFilerClass {...defaultProps} />);

    // Click the Submit Bug button
    fireEvent.click(screen.getByText('Submit Bug'));

    // Check that notify was called with an error message
    expect(defaultProps.notify).toHaveBeenCalledWith(
      'Please select (or search and select) a product/component pair to continue',
      'danger',
    );
  });

  it('shows an error notification if summary is too long', async () => {
    render(<BugFilerClass {...defaultProps} />);

    // Wait for the product search to complete
    await waitFor(() => {
      expect(screen.getByText('Core :: DOM')).toBeInTheDocument();
    });

    // Select a product
    const productRadio = screen.getByLabelText('Core :: DOM');
    fireEvent.click(productRadio);

    // Set a very long summary
    const summaryInput = screen.getByPlaceholderText('Intermittent...');
    fireEvent.change(summaryInput, {
      target: {
        value: 'A'.repeat(256),
      },
    });

    // Click the Submit Bug button
    fireEvent.click(screen.getByText('Submit Bug'));

    // Check that notify was called with an error message
    expect(defaultProps.notify).toHaveBeenCalledWith(
      'Please ensure the summary is no more than 255 characters',
      'danger',
    );
  });

  it('handles crash signatures correctly', async () => {
    // Mock getCrashSignatures to return a signature
    bugHelpers.getCrashSignatures.mockReturnValue(['SIGNATURE']);

    render(<BugFilerClass {...defaultProps} />);

    // Check that the signature field is rendered
    expect(screen.getByText('Signature:')).toBeInTheDocument();

    // Check that the signature is displayed
    const signatureTextarea = screen.getByLabelText('Signature:');
    expect(signatureTextarea).toHaveValue('SIGNATURE');

    // For crash signatures, we need to manually search for a product since automatic search is skipped
    const productSearchInput = screen.getByPlaceholderText(
      'e.g. Firefox, Toolkit, Testing',
    );
    fireEvent.change(productSearchInput, { target: { value: 'Firefox' } });

    const findProductButton = screen.getByText('Find Product');
    fireEvent.click(findProductButton);

    // Wait for the manual search to complete
    await waitFor(() => {
      expect(screen.getByText('Firefox :: General')).toBeInTheDocument();
    });

    // Select a product
    const productRadio = screen.getByLabelText('Firefox :: General');
    fireEvent.click(productRadio);

    // Click the Submit Bug button
    fireEvent.click(screen.getByText('Submit Bug'));

    // Wait for the submission to complete
    await waitFor(() => {
      // Check that create was called with the correct parameters
      expect(httpHelpers.create).toHaveBeenCalledWith(
        '/api/bugzilla/create_bug/',
        expect.objectContaining({
          product: 'Firefox',
          component: 'General',
          crash_signature: 'SIGNATURE',
          keywords: expect.arrayContaining(['intermittent-failure', 'crash']),
          priority: '--',
          severity: '--',
        }),
      );
    });
  });

  it('handles security issues correctly', async () => {
    render(<BugFilerClass {...defaultProps} />);

    // Wait for the product search to complete
    await waitFor(() => {
      expect(screen.getByText('Core :: DOM')).toBeInTheDocument();
    });

    // Select a product
    const productRadio = screen.getByLabelText('Core :: DOM');
    fireEvent.click(productRadio);

    // Check the security issue checkbox
    const securityCheckbox = screen.getByRole('checkbox', {
      name: /report this as a security issue/i,
    });
    fireEvent.click(securityCheckbox);

    // Click the Submit Bug button
    fireEvent.click(screen.getByText('Submit Bug'));

    // Wait for the submission to complete
    await waitFor(() => {
      // Check that create was called with the correct parameters
      expect(httpHelpers.create).toHaveBeenCalledWith(
        '/api/bugzilla/create_bug/',
        expect.objectContaining({
          is_security_issue: true,
          priority: '--',
          severity: '--',
        }),
      );
    });
  });

  it('does not launch confirm failure task for regular intermittent failures', async () => {
    render(<BugFilerClass {...defaultProps} />);

    // Wait for the product search to complete
    await waitFor(() => {
      expect(screen.getByText('Core :: DOM')).toBeInTheDocument();
    });

    // Select a product
    const productRadio = screen.getByLabelText('Core :: DOM');
    fireEvent.click(productRadio);

    // Check that the confirm failure checkbox is rendered and checked by default
    const confirmFailureCheckbox = screen.getByRole('checkbox', {
      name: /launch the confirm failures task at bug submission/i,
    });
    expect(confirmFailureCheckbox).toBeChecked();

    // Click the Submit Bug button
    fireEvent.click(screen.getByText('Submit Bug'));

    // Wait for the submission to complete
    await waitFor(() => {
      // Check that confirmFailure was NOT called for regular intermittent failures
      // (only single tracking bugs with 'intermittent-testcase' keyword should trigger confirm failure)
      expect(jobHelpers.confirmFailure).not.toHaveBeenCalled();
    });
  });

  it('does not launch confirm failure task when checkbox is unchecked', async () => {
    render(<BugFilerClass {...defaultProps} />);

    // Wait for the product search to complete
    await waitFor(() => {
      expect(screen.getByText('Core :: DOM')).toBeInTheDocument();
    });

    // Select a product
    const productRadio = screen.getByLabelText('Core :: DOM');
    fireEvent.click(productRadio);

    // Uncheck the confirm failure checkbox
    const confirmFailureCheckbox = screen.getByRole('checkbox', {
      name: /launch the confirm failures task at bug submission/i,
    });
    fireEvent.click(confirmFailureCheckbox);

    // Click the Submit Bug button
    fireEvent.click(screen.getByText('Submit Bug'));

    // Wait for the submission to complete
    await waitFor(() => {
      // Check that confirmFailure was not called
      expect(jobHelpers.confirmFailure).not.toHaveBeenCalled();
    });
  });

  it('handles API errors correctly', async () => {
    // Mock create to return an error
    httpHelpers.create.mockResolvedValueOnce({
      data: { failure: 'API error' },
      failureStatus: 403,
    });

    render(<BugFilerClass {...defaultProps} />);

    // Wait for the product search to complete
    await waitFor(() => {
      expect(screen.getByText('Core :: DOM')).toBeInTheDocument();
    });

    // Select a product
    const productRadio = screen.getByLabelText('Core :: DOM');
    fireEvent.click(productRadio);

    // Click the Submit Bug button
    fireEvent.click(screen.getByText('Submit Bug'));

    // Wait for the submission to complete
    await waitFor(() => {
      // Check that notify was called with an error message
      expect(defaultProps.notify).toHaveBeenCalledWith(
        expect.stringContaining('Treeherder Bug Filer API returned status 403'),
        'danger',
        { sticky: true },
      );
    });
  });
});
