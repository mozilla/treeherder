import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button, Modal, Tooltip, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronCircleDown,
  faChevronCircleUp,
  faSpinner,
  faExclamationTriangle,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

import {
  bugzillaBugsApi,
  bzBaseUrl,
  bzComponentEndpoint,
  getApiUrl,
} from '../helpers/url';
import { confirmFailure } from '../helpers/job';
import { create } from '../helpers/http';
import { omittedLeads, parseSummary, getCrashSignatures } from '../helpers/bug';
import { notify } from '../job-view/redux/stores/notifications';

export class BugFilerClass extends React.Component {
  constructor(props) {
    super(props);

    const {
      suggestions,
      suggestion,
      fullLog,
      parsedLog,
      reftestUrl,
      selectedJob,
    } = props;

    const allFailures = suggestions.map((sugg) =>
      sugg.search
        .split(' | ')
        .filter((part) => !omittedLeads.includes(part))
        .map((item) =>
          item === 'REFTEST TEST-UNEXPECTED-PASS'
            ? 'TEST-UNEXPECTED-PASS'
            : item,
        ),
    );
    const thisFailure = allFailures.map((f) => f.join(' | ')).join('\n');

    const parsedSummary = parseSummary(suggestion);
    let summaryString = parsedSummary[0].join(' | ');
    if (selectedJob.job_group_name.toLowerCase().includes('reftest')) {
      const re = /layout\/reftests\//gi;
      summaryString = summaryString.replace(re, '');
    }

    const crashSignatures = getCrashSignatures(suggestion);

    const keywords = [];
    let isAssertion = [
      /ASSERTION:/, // binary code
      /assertion fail/i, // JavaScript
      /assertion count \d+ is \w+ than expected \d+ assertion/, // layout
    ].some((regexp) => regexp.test(summaryString));
    if (isAssertion) {
      if (
        /java.lang.AssertionError/.test(summaryString) &&
        selectedJob.job_type_name.includes('junit')
      ) {
        isAssertion = false;
      } else {
        keywords.push('assertion');
      }
    }

    if (selectedJob.job_type_name.toLowerCase().includes('test-verify')) {
      keywords.push('test-verify-fail');
    }

    const checkedLogLinks = new Map([
      ['Parsed log', parsedLog],
      ['Full log', fullLog],
    ]);

    if (reftestUrl) {
      checkedLogLinks.set('Reftest URL', reftestUrl);
    }

    const jg = selectedJob.job_group_name.toLowerCase();
    if (
      jg.includes('xpcshell') ||
      jg.includes('mochitest') ||
      jg.includes('web platform tests') ||
      jg.includes('reftest') ||
      jg.includes('talos') ||
      selectedJob.job_type_name.includes('junit') ||
      selectedJob.job_type_name.includes('marionette')
    ) {
      // simple hack to make sure we have a testcase in the summary
      let isTestPath = [
        /.*test_.*\.js/, // xpcshell
        /.*test_.*\.html/, // mochitest
        /.*test_.*\.xhtml/, // mochitest-chrome
        /.*browser_.*\.html/, // b-c
        /.*browser_.*\.js/, // b-c
        /.*test_.*\.py/, // marionette
        /.*\.ini/, // when we have a failure on shutdown (crash/leak/timeout)
        /.*\.toml/, // when we have a failure on shutdown (crash/leak/timeout)
        /.*org.mozilla.geckoview.test.*/, // junit
      ].some((regexp) => regexp.test(summaryString));

      if (jg.includes('talos')) {
        isTestPath = [
          /.*PROCESS-CRASH \| .*/, // crashes
        ].some((regexp) => regexp.test(suggestion.search));
      } else if (jg.includes('web platform tests') || jg.includes('reftest')) {
        // account for <filename>.html?blah... | failure message
        isTestPath = [
          /.*\.js(\?.*| )\|/,
          /.*\.html(\?.*| )\|/,
          /.*\.htm(\?.*| )\|/,
          /.*\.xhtml(\?.*| )\|/,
          /.*\.xht(\?.*| )\|/,
          /.*\.mp4 \|/, // reftest specific
          /.*\.webm \|/, // reftest specific
          / \| .*\.js(\?.*)?/, // crash format
          / \| .*\.html(\?.*)?/,
          / \| .*\.htm(\?.*)?/,
          / \| .*\.xhtml(\?.*)?/,
          / \| .*\.xht(\?.*)?/,
          / \| .*.mp4/, // reftest specific
          / \| .*\.webm/, // reftest specific
        ].some((regexp) => regexp.test(summaryString));
      }

      if (crashSignatures.length > 0) {
        isTestPath = false;
        const parts = summaryString.split(' | ');
        summaryString = `${parts[0]} | single tracking bug`;
        keywords.push('intermittent-testcase');
      }

      // trimming params from end of a test case name when filing for stb
      let trimParams = false;

      // only handle straight forward reftest pixel/color errors
      if (
        isTestPath &&
        selectedJob.job_group_name.includes('reftest') &&
        !/.*image comparison, max difference.*/.test(summaryString)
      ) {
        isTestPath = false;
      } else if (
        jg.includes('web platform tests') ||
        selectedJob.job_type_name.includes('marionette')
      ) {
        trimParams = true;
      }

      const isPerfTest = [
        /.*browser\/base\/content\/test\/performance.*/,
      ].some((regexp) => regexp.test(summaryString));

      // If not leak
      if (!isAssertion && !isPerfTest && isTestPath) {
        const parts = summaryString.split(' | ');
        // split('?') is for removing `?params...` from the test name
        if (parts.length === 2 || parts.length === 1) {
          summaryString = `${
            trimParams ? parts[0].split('?')[0].split(' ')[0] : parts[0]
          } | single tracking bug`;
          keywords.push('intermittent-testcase');
        } else if (parts.length === 3) {
          summaryString = `${
            trimParams ? parts[1].split('?')[0].split(' ')[0] : parts[1]
          } | single tracking bug`;
          keywords.push('intermittent-testcase');
        }
      }
    }

    this.state = {
      tooltipOpen: {},
      summary: `Intermittent ${summaryString}`,
      productSearch: null,
      suggestedProducts: [],
      isFilerSummaryVisible: false,
      selectedProduct: null,
      isIntermittent: true,
      isSecurityIssue: false,
      launchConfirmFailure: true,
      comment: '',
      searching: false,
      // used by test
      parsedSummary, // eslint-disable-line react/no-unused-state
      checkedLogLinks,
      thisFailure,
      keywords,
      crashSignatures,
    };
  }

  componentDidMount() {
    this.checkForSecurityIssue();
    this.findProductByPath();
  }

  getUnhelpfulSummaryReason(summary) {
    const { suggestion } = this.props;
    const searchTerms = suggestion.search_terms;

    if (searchTerms.length === 0) {
      return 'Selected failure does not contain any searchable terms.';
    }
    if (searchTerms.every((term) => !summary.includes(term))) {
      return "Summary does not include the full text of any of the selected failure's search terms:";
    }
    return '';
  }

  // Some job types are special, lets explicitly handle them.
  getSpecialProducts(fp) {
    const { selectedJob } = this.props;
    const { suggestedProducts } = this.state;
    const newProducts = [];

    if (suggestedProducts.length === 0) {
      const jg = selectedJob.job_group_name.toLowerCase();

      if (jg.includes('talos')) {
        newProducts.push('Testing :: Talos');
      }
      if (
        jg.includes('mochitest') &&
        (fp.includes('webextensions/') || fp.includes('components/extensions'))
      ) {
        newProducts.push('WebExtensions :: General');
      }
      if (jg.includes('mochitest') && fp.includes('webrtc/')) {
        newProducts.push('Core :: WebRTC');
      }
    }
    return newProducts;
  }

  /**
   *  'enter' from the product search input should initiate the search
   */
  productSearchEnter = (ev) => {
    const { keyCode, target } = ev;

    this.setState({ productSearch: target.value }, () => {
      if (keyCode === 13) {
        this.findProduct();
      }
    });
  };

  /*
   *  Attempt to find a good product/component for this failure
   */
  findProduct = async () => {
    const { productSearch } = this.state;

    if (!productSearch) {
      return;
    }

    let suggestedProductsSet = new Set();

    this.setState({ searching: true });

    const resp = await fetch(
      `${bzBaseUrl}rest/prod_comp_search/find/${productSearch}?limit=5`,
    );
    const data = await resp.json();
    const products = data.products.filter(
      (item) => !!item.product && !!item.component,
    );
    suggestedProductsSet = new Set([
      ...suggestedProductsSet,
      ...products.map(
        (prod) =>
          prod.product + (prod.component ? ` :: ${prod.component}` : ''),
      ),
    ]);

    const newSuggestedProducts = [...suggestedProductsSet];

    this.setState({
      suggestedProducts: newSuggestedProducts,
      selectedProduct: newSuggestedProducts[0],
      searching: false,
    });
  };

  /*
   *  Attempt to find the product/component for this failure based on the
   *  file path or its end.
   */
  findProductByPath = async () => {
    const { suggestion, platform } = this.props;
    const { crashSignatures } = this.state;
    const pathEnd = suggestion.path_end;

    if (
      !crashSignatures.length &&
      (platform.startsWith('AC-') || platform.startsWith('fenix-'))
    ) {
      this.setState({
        suggestedProducts: ['Firefox for Android :: General'],
        selectedProduct: 'Firefox for Android :: General',
        searching: false,
      });
      return;
    }

    if (!crashSignatures.length && platform.startsWith('focus-')) {
      this.setState({
        suggestedProducts: ['Focus :: General'],
        selectedProduct: 'Focus :: General',
        searching: false,
      });
      return;
    }

    if (!pathEnd) {
      return;
    }

    /* Don't suggest a Bugzilla product and component because it should be based
       on the crashing file which is not mentioned in the failure line. */
    if (crashSignatures.length) {
      return;
    }

    let suggestedProductsSet = new Set();

    this.setState({ searching: true });

    const resp = await fetch(
      `/api${bzComponentEndpoint}?path=${encodeURIComponent(pathEnd)}`,
    );
    const data = await resp.json();
    const products = data.filter((item) => !!item.product && !!item.component);
    suggestedProductsSet = new Set([
      ...suggestedProductsSet,
      ...products.map(
        (prod) =>
          prod.product + (prod.component ? ` :: ${prod.component}` : ''),
      ),
    ]);
    const newSuggestedProducts = [...suggestedProductsSet];

    this.setState({
      suggestedProducts: newSuggestedProducts,
      selectedProduct: newSuggestedProducts[0],
      searching: false,
    });
  };

  toggleCheckedLogLink = (name, link) => {
    const { checkedLogLinks } = this.state;
    const newCheckedLogLinks = new Map(checkedLogLinks);
    if (newCheckedLogLinks.has(name)) {
      newCheckedLogLinks.delete(name);
    } else {
      newCheckedLogLinks.set(name, link);
    }

    this.setState({ checkedLogLinks: newCheckedLogLinks });
  };

  /*
   *  Actually send the gathered information to bugzilla.
   */
  submitFiler = async () => {
    const {
      summary,
      selectedProduct,
      comment,
      isIntermittent,
      isSecurityIssue,
      checkedLogLinks,
      regressedBy,
      seeAlso,
      keywords,
      crashSignatures,
      launchConfirmFailure,
    } = this.state;
    const { toggle, successCallback, notify, suggestions } = this.props;

    if (!selectedProduct) {
      notify(
        'Please select (or search and select) a product/component pair to continue',
        'danger',
      );
      return;
    }
    const [product, component] = selectedProduct.split(' :: ');

    if (summary.length > 255) {
      notify(
        'Please ensure the summary is no more than 255 characters',
        'danger',
      );
      return;
    }

    // Format links in bugzilla markdown:
    //   **Parsed log:** http://...
    //   **Full log:** http://....
    const logLinks = [...checkedLogLinks]
      .map((e) => {
        const [name, url] = e;
        return `**${name}:** ${url}`;
      })
      .join('\n');

    // Join that with the comment separated with a hard rule.
    const descriptionStrings = `${logLinks}\n\n---\n\`\`\`\n${comment}\n\`\`\``;

    if (isIntermittent) {
      keywords.push('intermittent-failure');
    }
    let priority = 'P5';
    let severity = 'S4';

    const crashSignature = crashSignatures.join('\n');
    if (crashSignature.length > 0) {
      keywords.push('crash');
      // Set no priority and severity to get them included in triage meetings.
      priority = '--';
      severity = '--';
    }

    if (isSecurityIssue) {
      // Set no priority and severity to get them included in triage meetings.
      priority = '--';
      severity = '--';
    }

    // Use of 'Regressed By' field shall add 'regression' to keywords.
    if (regressedBy) {
      keywords.push('regression');
    }

    /* Intermittent bugs in the Core :: DOM: Security component need to have the
       whiteboard '[domsecurity-intermittent]' to support filtering by the
       triagers. Contact person is Christoph Kerschbaumer. */
    let whiteboard =
      isIntermittent && product === 'Core' && component === 'DOM: Security'
        ? '[domsecurity-intermittent]'
        : '';

    // Bug in these components shall never get a priority automatically set
    // to let the bugs show up during triage. See bug 1580287.
    const noPriorityProdComp = [
      { product: 'Firefox', component: 'Messaging System' },
    ];
    if (
      noPriorityProdComp.some(
        (object) =>
          object.product === product && object.component === component,
      )
    ) {
      priority = '--';
    }

    if (launchConfirmFailure && keywords.includes('intermittent-testcase')) {
      // Launch confirm failure task
      this.handleConfirmFailure();
      whiteboard += '[collect_confirm_failure]';
    }
    // Fetch product information from bugzilla to get version numbers, then
    // submit the new bug.  Only request the versions because some products
    // take quite a long time to fetch the full object
    try {
      const productResp = await fetch(
        bugzillaBugsApi(`product/${product}`, { include_fields: 'versions' }),
      );
      const productData = await productResp.json();
      if (productResp.ok) {
        const productObject = productData.products[0];
        // Find the newest version for the product that is_active
        const version = productObject.versions
          .filter((prodVer) => prodVer.is_active)
          .slice(-1)[0];
        const payload = {
          product,
          component,
          summary,
          keywords,
          whiteboard,
          version: version.name,
          regressed_by: regressedBy,
          see_also: seeAlso,
          crash_signature: crashSignature,
          severity,
          priority,
          is_security_issue: isSecurityIssue,
          comment: descriptionStrings,
          comment_tags: 'treeherder',
        };

        const { data, failureStatus } = await create(
          getApiUrl('/bugzilla/create_bug/'),
          payload,
        );
        if (data.internal_id) {
          // Directly update internal issue from suggestions
          const internalBugs = suggestions
            .map((s) => s.bugs.open_recent)
            .flat()
            .filter((bug) => bug.id === null);
          const existingBug = internalBugs.filter(
            (bug) => bug.internal_id === data.internal_id,
          )[0];
          if (existingBug) {
            existingBug.id = data.id;
          }
        }

        if (!failureStatus) {
          toggle();
          successCallback(data);
        } else {
          this.submitFailure('Treeherder Bug Filer API', failureStatus, data);
        }
      } else {
        this.submitFailure(
          'Bugzilla',
          productResp.status,
          productResp.statusText,
          productData,
        );
      }
    } catch (e) {
      notify(`Error filing bug: ${e.toString()}`, 'danger', { sticky: true });
    }
  };

  submitFailure = (source, status, statusText, data) => {
    const { notify } = this.props;

    let failureString = `${source} returned status ${status} (${statusText})`;
    if (data && data.failure) {
      failureString += `\n\n${data.failure}`;
    }
    if (status === 403) {
      failureString +=
        '\n\nAuthentication failed. Has your Treeherder session expired?';
    }
    notify(failureString, 'danger', { sticky: true });
  };

  toggleTooltip = (key) => {
    const { tooltipOpen } = this.state;
    this.setState({
      tooltipOpen: { ...tooltipOpen, [key]: !tooltipOpen[key] },
    });
  };

  checkForSecurityIssue() {
    const { comment, isSecurityIssue, summary } = this.state;

    if (isSecurityIssue) {
      return;
    }

    const inputToCheck = `${summary}\n${comment}`;

    const potentialSecurityIssues = [
      '65656565',
      'access-violation',
      'data race',
      'double-free',
      'e5e5',
      'f2f2f2f2',
      'global-buffer-overflow',
      'heap-buffer-overflow',
      'heap-use-after-free',
      'negative-size-param',
      'stack-buffer-overflow',
      'stack-use-after-scope',
      'use-after-poison',
    ];
    for (const searchTerm of potentialSecurityIssues) {
      if (inputToCheck.includes(searchTerm)) {
        this.setState({ isSecurityIssue: true });
        break;
      }
    }
  }

  handleConfirmFailure = async () => {
    const { selectedJob, notify, decisionTaskMap, currentRepo } = this.props;
    confirmFailure(selectedJob, notify, decisionTaskMap, currentRepo);
  };

  render() {
    const {
      isOpen,
      toggle,
      suggestion,
      parsedLog,
      fullLog,
      reftestUrl,
      currentRepo,
    } = this.props;
    const {
      productSearch,
      suggestedProducts,
      thisFailure,
      isFilerSummaryVisible,
      isIntermittent,
      isSecurityIssue,
      launchConfirmFailure,
      summary,
      searching,
      checkedLogLinks,
      tooltipOpen,
      selectedProduct,
    } = this.state;
    const searchTerms = suggestion.search_terms;
    const crashSignatures = getCrashSignatures(suggestion);
    const unhelpfulSummaryReason = this.getUnhelpfulSummaryReason(summary);

    return (
      <div>
        <Modal show={isOpen} onHide={toggle} size="lg">
          <Modal.Header>
            <Modal.Title>Intermittent Bug Filer</Modal.Title>
            <button
              type="button"
              className="close"
              aria-label="Close"
              onClick={toggle}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </Modal.Header>
          <Modal.Body>
            <form className="d-flex flex-column">
              <div className="d-inline-flex">
                <Form.Control
                  name="modalProductFinderSearch"
                  id="modalProductFinderSearch"
                  onKeyDown={this.productSearchEnter}
                  onChange={(evt) =>
                    this.setState({ productSearch: evt.target.value })
                  }
                  type="text"
                  placeholder="e.g. Firefox, Toolkit, Testing"
                  className="flex-fill flex-grow-1"
                />
                <Tooltip
                  target="modalProductFinderSearch"
                  isOpen={tooltipOpen.modalProductFinderSearch}
                  toggle={() => this.toggleTooltip('modalProductFinderSearch')}
                >
                  Manually search for a product
                </Tooltip>
                <Button
                  variant="secondary"
                  className="ms-1 btn-sm"
                  type="button"
                  onClick={this.findProduct}
                >
                  Find Product
                </Button>
              </div>
              <div>
                {!!productSearch && searching && (
                  <div>
                    <FontAwesomeIcon
                      icon={faSpinner}
                      pulse
                      className="th-spinner-lg"
                      title="Searching..."
                    />
                    Searching {productSearch}
                  </div>
                )}
                <Form.Group tag="fieldset" className="mt-1 mb-3">
                  {suggestedProducts.map((product) => (
                    <Form.Check
                      // className="ms-4"
                      key={`modalProductSuggestion${product}`}
                      type="radio"
                      id={`product-${product}`}
                      label={product}
                      value={product}
                      checked={product === selectedProduct}
                      onChange={(evt) =>
                        this.setState({ selectedProduct: evt.target.value })
                      }
                      name="productGroup"
                    />
                  ))}
                </Form.Group>
              </div>
              <Form.Label htmlFor="summary">Summary:</Form.Label>
              <div className="d-flex">
                {!!unhelpfulSummaryReason && (
                  <div>
                    <div className="text-danger">
                      <FontAwesomeIcon
                        icon={faExclamationTriangle}
                        id="unhelpful-summary-reason"
                      />
                      Warning: {unhelpfulSummaryReason}
                      <Tooltip
                        target="unhelpful-summary-reason"
                        isOpen={tooltipOpen.unhelpfulSummaryReason}
                        toggle={() =>
                          this.toggleTooltip('unhelpfulSummaryReason')
                        }
                      >
                        This can cause poor bug suggestions to be generated
                      </Tooltip>
                    </div>
                    {searchTerms.map((term) => (
                      <div className="text-monospace ps-3" key={term}>
                        {term}
                      </div>
                    ))}
                  </div>
                )}
                <Form.Control
                  id="summary"
                  className="flex-grow-1"
                  type="text"
                  placeholder="Intermittent..."
                  pattern=".{0,255}"
                  onChange={(evt) =>
                    this.setState({ summary: evt.target.value }, () =>
                      this.checkForSecurityIssue(),
                    )
                  }
                  value={summary}
                />
                <Tooltip
                  target="toggle-failure-lines"
                  show={tooltipOpen.toggleFailureLines}
                  onToggle={() => this.toggleTooltip('toggleFailureLines')}
                >
                  {isFilerSummaryVisible
                    ? 'Hide all failure lines for this job'
                    : 'Show all failure lines for this job'}
                </Tooltip>
                <FontAwesomeIcon
                  onClick={() =>
                    this.setState({
                      isFilerSummaryVisible: !isFilerSummaryVisible,
                    })
                  }
                  icon={
                    isFilerSummaryVisible
                      ? faChevronCircleUp
                      : faChevronCircleDown
                  }
                  size="lg"
                  className="pointable align-bottom pt-2 ms-1"
                  id="toggle-failure-lines"
                  title={isFilerSummaryVisible ? 'collapse' : 'expand'}
                />
                <span
                  id="summaryLength"
                  className={`ms-1 font-weight-bold lg align-self-center ${
                    summary.length > 255 ? 'text-danger' : 'text-success'
                  }`}
                >
                  {summary.length}
                </span>
              </div>
              {isFilerSummaryVisible && (
                <span>
                  <Form.Control
                    className="w-100"
                    as="textarea"
                    value={thisFailure}
                    readOnly
                    onChange={(evt) =>
                      this.setState({ thisFailure: evt.target.value })
                    }
                  />
                </span>
              )}
              <div className="ms-4 mt-2">
                <Form.Check
                  className="mb-2"
                  type="checkbox"
                  id="parsed-log-checkbox"
                  checked={checkedLogLinks.has('Parsed log')}
                  onChange={() =>
                    this.toggleCheckedLogLink('Parsed log', parsedLog)
                  }
                  label={
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={parsedLog}
                    >
                      Include Parsed Log Link
                    </a>
                  }
                />
                <Form.Check
                  className="mb-1"
                  type="checkbox"
                  id="full-log-checkbox"
                  checked={checkedLogLinks.has('Full log')}
                  onChange={() =>
                    this.toggleCheckedLogLink('Full log', fullLog)
                  }
                  label={
                    <a target="_blank" rel="noopener noreferrer" href={fullLog}>
                      Include Full Log Link
                    </a>
                  }
                />
                {!!reftestUrl && (
                  <Form.Check
                    className="mb-1"
                    type="checkbox"
                    id="reftest-url-checkbox"
                    checked={checkedLogLinks.has('Reftest URL')}
                    onChange={() =>
                      this.toggleCheckedLogLink('Reftest URL', reftestUrl)
                    }
                    label={
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={reftestUrl}
                      >
                        Include Reftest Viewer Link
                      </a>
                    }
                  />
                )}
              </div>
              <div className="d-flex flex-column">
                <Form.Label htmlFor="summary-input">Comment:</Form.Label>
                <Form.Control
                  onChange={(evt) =>
                    this.setState({ comment: evt.target.value }, () =>
                      this.checkForSecurityIssue(),
                    )
                  }
                  as="textarea"
                  id="summary-input"
                  className="flex-grow-1"
                  rows={5}
                />
              </div>
              <div className="ms-4">
                <div className="d-inline-flex mb-1">
                  <Form.Check
                    className="mt-2"
                    type="checkbox"
                    id="intermittent-checkbox"
                    checked={isIntermittent}
                    onChange={() =>
                      this.setState({ isIntermittent: !isIntermittent })
                    }
                    label="This is an intermittent failure"
                  />
                  <div className="d-inline-flex ms-2">
                    <Form.Control
                      id="regressedBy"
                      type="text"
                      className="ms-1"
                      onChange={(evt) =>
                        this.setState({ regressedBy: evt.target.value })
                      }
                      placeholder="Regressed by"
                    />
                    <Tooltip
                      target="regressedBy"
                      placement="bottom"
                      isOpen={tooltipOpen.regressedBy}
                      toggle={() => this.toggleTooltip('regressedBy')}
                    >
                      Comma-separated list of bugs
                    </Tooltip>
                    <Form.Control
                      id="seeAlso"
                      className="ms-1"
                      type="text"
                      onChange={(evt) =>
                        this.setState({ seeAlso: evt.target.value })
                      }
                      placeholder="See also"
                    />
                    <Tooltip
                      target="seeAlso"
                      placement="bottom"
                      isOpen={tooltipOpen.seeAlso}
                      toggle={() => this.toggleTooltip('seeAlso')}
                    >
                      Comma-separated list of bugs
                    </Tooltip>
                  </div>
                </div>
                <Form.Check
                  className="mb-2"
                  type="checkbox"
                  id="security-issue-checkbox"
                  checked={isSecurityIssue}
                  onChange={() =>
                    this.setState({ isSecurityIssue: !isSecurityIssue })
                  }
                  label="Report this as a security issue"
                />
                {['autoland', 'mozilla-central', 'try'].includes(
                  currentRepo.name,
                ) && (
                  <div className="mb-2">
                    <Form.Check
                      type="checkbox"
                      id="confirm-failure-checkbox"
                      checked={launchConfirmFailure}
                      onChange={() =>
                        this.setState({
                          launchConfirmFailure: !launchConfirmFailure,
                        })
                      }
                      label="Launch the Confirm Failures task at bug submission"
                    />
                  </div>
                )}
                {!!crashSignatures.length && (
                  <div>
                    <Form.Label htmlFor="signature-input">
                      Signature:
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      id="signature-input"
                      onChange={(evt) =>
                        this.setState({ crashSignatures: evt.target.value })
                      }
                      maxLength="2048"
                      readOnly
                      value={crashSignatures.join('\n')}
                    />
                  </div>
                )}
              </div>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.submitFiler}>
              Submit Bug
            </Button>{' '}
            <Button variant="secondary" onClick={toggle}>
              Cancel
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

BugFilerClass.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  suggestion: PropTypes.shape({}).isRequired,
  suggestions: PropTypes.arrayOf(
    PropTypes.shape({
      bugs: PropTypes.shape({
        open_recent: PropTypes.arrayOf(
          PropTypes.shape({
            crash_signature: PropTypes.string.isRequired,
            dupe_of: PropTypes.oneOfType([
              PropTypes.oneOf([null]),
              PropTypes.number,
            ]).isRequired,
            id: PropTypes.number.isRequired,
            keywords: PropTypes.string.isRequired,
            status: PropTypes.string.isRequired,
            resolution: PropTypes.string.isRequired,
            summary: PropTypes.string.isRequired,
            whiteboard: PropTypes.string.isRequired,
          }),
        ),
        all_others: PropTypes.arrayOf(
          PropTypes.shape({
            crash_signature: PropTypes.string.isRequired,
            dupe_of: PropTypes.oneOfType([
              PropTypes.oneOf([null]),
              PropTypes.number,
            ]).isRequired,
            id: PropTypes.number.isRequired,
            keywords: PropTypes.string.isRequired,
            status: PropTypes.string.isRequired,
            resolution: PropTypes.string.isRequired,
            summary: PropTypes.string.isRequired,
            whiteboard: PropTypes.string.isRequired,
          }),
        ),
      }),
      counter: PropTypes.number.isRequired,
      failure_in_new_rev: PropTypes.bool.isRequired,
      line_number: PropTypes.number.isRequired,
      path_end: PropTypes.string,
      search: PropTypes.string.isRequired,
      search_terms: PropTypes.arrayOf(PropTypes.string),
    }),
  ).isRequired,
  fullLog: PropTypes.string.isRequired,
  parsedLog: PropTypes.string.isRequired,
  reftestUrl: PropTypes.string.isRequired,
  successCallback: PropTypes.func.isRequired,
  platform: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  selectedJob: PropTypes.shape({}).isRequired,
  currentRepo: PropTypes.shape({ name: PropTypes.string }).isRequired,
};

const mapStateToProps = ({ pushes: { decisionTaskMap } }) => ({
  decisionTaskMap,
});

export default connect(mapStateToProps, { notify })(BugFilerClass);
