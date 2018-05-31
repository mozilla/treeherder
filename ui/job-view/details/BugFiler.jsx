import React from 'react';
import PropTypes from 'prop-types';
import {
  Button, Modal, ModalHeader, ModalBody, ModalFooter, Tooltip, FormGroup, Input,
  Label,
} from 'reactstrap';

import {
  bzBaseUrl,
  dxrBaseUrl,
  getApiUrl,
  hgBaseUrl,
} from '../../helpers/url';
import { create } from '../../helpers/http';

const crashRegex = /application crashed \[@ (.+)\]$/g;
const omittedLeads = ['TEST-UNEXPECTED-FAIL', 'PROCESS-CRASH', 'TEST-UNEXPECTED-ERROR', 'REFTEST ERROR'];
/*
 *  Find the first thing in the summary line that looks like a filename.
 */
const findFilename = (summary) => {
  // Take left side of any reftest comparisons, as the right side is the reference file
  summary = summary.split('==')[0];
  // Take the leaf node of unix paths
  summary = summary.split('/').pop();
  // Take the leaf node of Windows paths
  summary = summary.split('\\').pop();
  // Remove leading/trailing whitespace
  summary = summary.trim();
  // If there's a space in what's remaining, take the first word
  summary = summary.split(' ')[0];
  return summary;
};
/*
 *  Remove extraneous junk from the start of the summary line
 *  and try to find the failing test name from what's left
 */
const parseSummary = (suggestion) => {
  let summary = suggestion.search;
  const searchTerms = suggestion.search_terms;
  // Strip out some extra stuff at the start of some failure paths
  let re = /file:\/\/\/.*?\/build\/tests\/reftest\/tests\//gi;
  summary = summary.replace(re, '');
  re = /\/home\/worker\/workspace\/build\/src\//gi;
  summary = summary.replace(re, '');
  re = /chrome:\/\/mochitests\/content\/a11y\//gi;
  summary = summary.replace(re, '');
  re = /\/home\/worker\/checkouts\/gecko\//gi;
  summary = summary.replace(re, '');
  re = /http:\/\/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):([0-9]+)\/tests\//gi;
  summary = summary.replace(re, '');
  re = /jetpack-package\//gi;
  summary = summary.replace(re, '');
  re = /xpcshell([-a-zA-Z0-9]+)?.ini:/gi;
  summary = summary.replace(re, '');
  summary = summary.replace('/_mozilla/', 'mozilla/tests/');
  // We don't want to include "REFTEST" when it's an unexpected pass
  summary = summary.replace('REFTEST TEST-UNEXPECTED-PASS', 'TEST-UNEXPECTED-PASS');
  const summaryParts = summary.split(' | ');

  // If the search_terms used for finding bug suggestions
  // contains any of the omittedLeads, that lead is needed
  // for the full string match, so don't omit it in this case.
  // If it's not needed, go ahead and omit it.
  if (searchTerms.length && summaryParts.length > 1) {
    omittedLeads.forEach((lead) => {
      if (!searchTerms[0].includes(lead) && summaryParts[0].includes(lead)) {
        summaryParts.shift();
      }
    });
  }

  // Some of the TEST-FOO bits aren't removed from the summary,
  // so we sometimes end up with them instead of the test path here.
  const summaryName = summaryParts[0].startsWith('TEST-') && summaryParts.length > 1 ? summaryParts[1] : summaryParts[0];
  const possibleFilename = findFilename(summaryName);

  return [summaryParts, possibleFilename];
};

export default class BugFiler extends React.Component {
  constructor(props) {
    super(props);

    const { suggestions, suggestion, fullLog, parsedLog, reftestUrl, jobGroupName } = props;

    const allFailures = suggestions.map(sugg => sugg.search
      .split(' | ')
      .filter(part => !omittedLeads.includes(part))
      .map(item => (item === 'REFTEST TEST-UNEXPECTED-PASS' ? 'TEST-UNEXPECTED-PASS' : item)),
    );
    const thisFailure = allFailures.map(f => f.join(' | ')).join('\n');
    const crash = suggestion.search.match(crashRegex);
    const crashSignatures = crash ? [crash[0].split('application crashed ')[1]] : [];
    const parsedSummary = parseSummary(suggestion);

    let summaryString = parsedSummary[0].join(' | ');
    if (jobGroupName.toLowerCase().includes('reftest')) {
      const re = /layout\/reftests\//gi;
      summaryString = summaryString.replace(re, '');
    }

    const checkedLogLinks = [parsedLog, fullLog];
    if (reftestUrl) {
      checkedLogLinks.push(reftestUrl);
    }

    this.state = {
      tooltipOpen: {},
      summary: `Intermittent ${summaryString}`,
      parsedLog: null,
      productSearch: null,
      suggestedProducts: [],
      isFilerSummaryVisible: false,
      possibleFilename: null,
      selectedProduct: null,
      isIntermittent: true,
      searching: false,
      parsedSummary,
      checkedLogLinks,
      thisFailure,
      crashSignatures,
    };
  }

  componentDidMount() {
    this.submitFiler = this.submitFiler.bind(this);
    this.findProduct = this.findProduct.bind(this);
    this.productSearchEnter = this.productSearchEnter.bind(this);
    this.toggleTooltip = this.toggleTooltip.bind(this);
  }

  getUnhelpfulSummaryReason(summary) {
    const { suggestion } = this.props;
    const searchTerms = suggestion.search_terms;

    if (searchTerms.length === 0) {
      return 'Selected failure does not contain any searchable terms.';
    }
    if (searchTerms.every(term => !summary.includes(term))) {
      return 'Summary does not include the full text of any of the selected failure\'s search terms:';
    }
    return '';
  }

  // Some job types are special, lets explicitly handle them.
  getSpecialProducts(fp) {
    const { jobGroupName } = this.props;
    const { suggestedProducts } = this.state;
    const newProducts = [];

    if (suggestedProducts.length === 0) {
      const jg = jobGroupName.toLowerCase();

      if (jg.includes('talos')) {
        newProducts.push('Testing :: Talos');
      }
      if (jg.includes('mochitest') && (fp.includes('webextensions/') || fp.includes('components/extensions'))) {
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
  productSearchEnter(ev) {
    const { keyCode, target } = ev;

    this.setState({ productSearch: target.value }, () => {
      if (keyCode === 13) {
        this.findProduct();
      }
    });
  }

  /*
   *  Attempt to find a good product/component for this failure
   */
  async findProduct() {
    const { jobGroupName } = this.props;
    const { productSearch, parsedSummary } = this.state;

    let possibleFilename = null;
    let suggestedProductsSet = new Set();

    this.setState({ searching: true });

    if (productSearch) {
      const resp = await fetch(`${bzBaseUrl}rest/prod_comp_search/${productSearch}?limit=5`);
      const data = await resp.json();
      const products = data.products.filter(item => !!item.product && !!item.component);
      suggestedProductsSet = new Set([...suggestedProductsSet, ...products.map(prod => (
        prod.product + (prod.component ? ` :: ${prod.component}` : '')
      ))]);
    } else {
      let failurePath = parsedSummary[0][0];

      // If the "TEST-UNEXPECTED-foo" isn't one of the omitted ones, use the next piece in the summary
      if (failurePath.includes('TEST-UNEXPECTED-')) {
        failurePath = parsedSummary[0][1];
        possibleFilename = findFilename(failurePath);
      }

      const lowerJobGroupName = jobGroupName.toLowerCase();
      // Try to fix up file paths for some job types.
      if (lowerJobGroupName.includes('spidermonkey')) {
        failurePath = 'js/src/tests/' + failurePath;
      }
      if (lowerJobGroupName.includes('videopuppeteer ')) {
        failurePath = failurePath.replace('FAIL ', '');
        failurePath = 'dom/media/test/external/external_media_tests/' + failurePath;
      }
      if (lowerJobGroupName.includes('web platform')) {
        failurePath = failurePath.startsWith('mozilla/tests') ?
          `testing/web-platform/${failurePath}` :
          `testing/web-platform/tests/${failurePath}`;
      }

      // Search mercurial's moz.build metadata to find products/components
      fetch(`${hgBaseUrl}mozilla-central/json-mozbuildinfo?p=${failurePath}`)
        .then(resp => resp.json().then((firstRequest) => {

          if (firstRequest.data.aggregate && firstRequest.data.aggregate.recommended_bug_component) {
            const suggested = firstRequest.data.aggregate.recommended_bug_component;
            suggestedProductsSet.add(`${suggested[0]} :: ${suggested[1]}`);
          }

          // Make an attempt to find the file path via a dxr file search
          if (suggestedProductsSet.size === 0 && possibleFilename.length > 4) {
            const dxrlink = `${dxrBaseUrl}mozilla-central/search?q=file:${possibleFilename}&redirect=false&limit=5`;
            // Bug 1358328 - We need to override headers here until DXR returns JSON with the default Accept header
            fetch(dxrlink, { headers: { Accept: 'application/json' } })
              .then((secondRequest) => {
                const results = secondRequest.data.results;
                let resultsCount = results.length;
                // If the search returns too many results, this probably isn't a good search term, so bail
                if (resultsCount === 0) {
                  suggestedProductsSet = new Set([...suggestedProductsSet, this.getSpecialProducts(failurePath)]);
                }
                results.forEach((result) => {
                  fetch(`${hgBaseUrl}mozilla-central/json-mozbuildinfo?p=${result.path}`)
                    .then((thirdRequest) => {
                      if (thirdRequest.data.aggregate && thirdRequest.data.aggregate.recommended_bug_component) {
                        const suggested = thirdRequest.data.aggregate.recommended_bug_component;
                        suggestedProductsSet.add(`${suggested[0]} :: ${suggested[1]}`);
                      }
                      // Only get rid of the throbber when all of these searches have completed
                      resultsCount -= 1;
                      if (resultsCount === 0) {
                        suggestedProductsSet = new Set([...suggestedProductsSet, this.getSpecialProducts(failurePath)]);
                      }
                    });
                });
              });
          } else {
            suggestedProductsSet = new Set([...suggestedProductsSet, this.getSpecialProducts(failurePath)]);
          }

        }));
    }
    const newSuggestedProducts = [...suggestedProductsSet];

    this.setState({
      suggestedProducts: newSuggestedProducts,
      selectedProduct: newSuggestedProducts[0],
      searching: false,
    });
  }

  toggleCheckedLogLink(link) {
    const { checkedLogLinks } = this.state;
    const newCheckedLogLinks = checkedLogLinks.includes(link) ?
      checkedLogLinks.filter(item => item !== link) :
      [...checkedLogLinks, link];

    this.setState({ checkedLogLinks: newCheckedLogLinks });
  }

  /*
   *  Actually send the gathered information to bugzilla.
   */
  async submitFiler() {
    const {
      summary, selectedProduct, comment, isIntermittent, checkedLogLinks,
      blocks, dependsOn, seeAlso, crashSignatures,
    } = this.state;
    const { toggle, successCallback, notify } = this.props;
    const [product, component] = selectedProduct.split(' :: ');

    if (!selectedProduct) {
      notify.send('Please select (or search and select) a product/component pair to continue', 'danger');
      return;
    }

    if (summary.length > 255) {
      notify.send('Please ensure the summary is no more than 255 characters', 'danger');
      return;
    }

    const descriptionStrings = [...checkedLogLinks, comment].join('\n\n');
    const keywords = isIntermittent ? ['intermittent-failure'] : [];

    let severity = 'normal';
    const priority = 'P5';
    const crashSignature = crashSignatures.join('\n');
    if (crashSignature.length > 0) {
      keywords.push('crash');
      severity = 'critical';
    }

    // Fetch product information from bugzilla to get version numbers, then
    // submit the new bug.  Only request the versions because some products
    // take quite a long time to fetch the full object
    try {
      const productResp = await fetch(`${bzBaseUrl}rest/product/${product}?include_fields=versions`);
      const productData = await productResp.json();
      if (productResp.ok) {
        const productObject = productData.products[0];
        // Find the newest version for the product that is_active
        const version = productObject.versions.filter(prodVer => prodVer.is_active).slice(-1)[0];
        const payload = {
          product,
          component,
          summary,
          keywords,
          version: version.name,
          blocks,
          depends_on: dependsOn,
          see_also: seeAlso,
          crash_signature: crashSignature,
          severity,
          priority,
          comment: descriptionStrings,
          comment_tags: 'treeherder',
        };

        const bugResp = await create(getApiUrl('/bugzilla/create_bug/'), payload);
        // const bugResp = await create('http://httpstat.us/404', payload);
        const data = await bugResp.json();
        if (bugResp.ok) {
          successCallback(data);
          toggle();
        } else {
          this.submitFailure('Treeherder Bug Filer API', bugResp.status, bugResp.statusText, data);
        }
      } else {
        this.submitFailure('Bugzilla', productResp.status, productResp.statusText, productData);
      }
    } catch (e) {
      notify.send(`Error filing bug: ${e.toString()}`, 'danger', { sticky: true });
    }
  }

  submitFailure(source, status, statusText, data) {
    const { notify } = this.props;

    let failureString = `${source} returned status ${status}(${statusText})`;
    if (data && data.failure) {
      failureString += '\n\n' + data.failure;
    }
    if (status === 403) {
      failureString += '\n\nAuthentication failed. Has your Treeherder session expired?';
    }
    notify.send(failureString, 'danger', { sticky: true });
  }

  toggleTooltip(key) {
    const { tooltipOpen } = this.state;
    this.setState({ tooltipOpen: { ...tooltipOpen, [key]: !tooltipOpen[key] } });
  }

  render() {
    const {
      isOpen, toggle, suggestion, parsedLog, fullLog, reftestUrl,
    } = this.props;
    const {
      productSearch, suggestedProducts, thisFailure, isFilerSummaryVisible,
      isIntermittent, summary, searching, checkedLogLinks, tooltipOpen,
      selectedProduct,
    } = this.state;
    const searchTerms = suggestion.search_terms;
    const crash = summary.match(crashRegex);
    const crashSignatures = crash ? [crash[0].split('application crashed ')[1]] : [];
    const unhelpfulSummaryReason = this.getUnhelpfulSummaryReason(summary);

    return (
      <div>
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
          <ModalHeader toggle={toggle}>Intermittent Bug Filer</ModalHeader>
          <ModalBody>
            <form>
              <div className="d-inline-flex">
                <Input
                  name="modalProductFinderSearch"
                  id="modalProductFinderSearch"
                  onKeyDown={this.productSearchEnter}
                  onChange={evt => this.setState({ productSearch: evt.target.value })}
                  type="text"
                  placeholder="Firefox"
                  className="flex-fill flex-grow-1"
                />
                <Tooltip
                  target="modalProductFinderSearch"
                  isOpen={tooltipOpen.modalProductFinderSearch}
                  toggle={() => this.toggleTooltip('modalProductFinderSearch')}
                >Manually search for a product</Tooltip>
                <Button
                  color="secondary"
                  className="ml-1 btn-sm"
                  type="button"
                  onClick={this.findProduct}
                >Find Product</Button>
              </div>
              <div>
                {!!productSearch && searching && <div>
                  <span className="fa fa-spinner fa-pulse th-spinner-lg" />Searching {productSearch}
                </div>}
                <FormGroup tag="fieldset" className="mt-1">
                  {suggestedProducts.map(product => (
                    <div className="ml-4" key={`modalProductSuggestion${product}`}>
                      <Label check>
                        <Input
                          type="radio"
                          value={product}
                          checked={product === selectedProduct}
                          onChange={evt => this.setState({ selectedProduct: evt.target.value })}
                          name="productGroup"
                        />{product}
                      </Label>
                    </div>
                  ))}
                </FormGroup>
              </div>
              <label>Summary:</label>
              <div className="d-flex">
                {!!unhelpfulSummaryReason && <div>
                  <div className="text-danger">
                    <span
                      className="fa fa-warning"
                      id="unhelpful-summary-reason"
                    />Warning: {unhelpfulSummaryReason}
                    <Tooltip
                      target="unhelpful-summary-reason"
                      isOpen={tooltipOpen.unhelpfulSummaryReason}
                      toggle={() => this.toggleTooltip('unhelpfulSummaryReason')}
                    >This can cause poor bug suggestions to be generated</Tooltip>
                  </div>
                  {searchTerms.map(term => <div className="text-monospace pl-3" key={term}>{term}</div>)}
                </div>}
                <Input
                  id="summary"
                  className="flex-grow-1"
                  type="text"
                  placeholder="Intermittent..."
                  pattern=".{0,255}"
                  onChange={evt => this.setState({ summary: evt.target.value })}
                  value={summary}
                />
                <Tooltip
                  target="toggle-failure-lines"
                  isOpen={tooltipOpen.toggleFailureLines}
                  toggle={() => this.toggleTooltip('toggleFailureLines')}
                >
                  {isFilerSummaryVisible ? 'Hide all failure lines for this job' : 'Show all failure lines for this job'}
                </Tooltip>
                <i
                  onClick={() => this.setState({ isFilerSummaryVisible: !isFilerSummaryVisible })}
                  className={`fa fa-lg pointable align-bottom pt-2 ml-1 ${isFilerSummaryVisible ? 'fa-chevron-circle-up' : 'fa-chevron-circle-down'}`}
                  id="toggle-failure-lines"
                />
                <span
                  id="summaryLength"
                  className={`ml-1 font-weight-bold lg ${summary.length > 255 ? 'text-danger' : 'text-success'}`}
                >{summary.length}</span>
              </div>
              {isFilerSummaryVisible && <span>
                <Input
                  className="w-100"
                  type="textarea"
                  value={thisFailure}
                  readOnly
                  onChange={evt => this.setState({ thisFailure: evt.target.value })}
                />
              </span>}
              <div className="ml-5 mt-2">
                <div>
                  <label>
                    <Input
                      type="checkbox"
                      checked={checkedLogLinks.includes(parsedLog)}
                      onChange={() => this.toggleCheckedLogLink(parsedLog)}
                    />
                    <a target="_blank" rel="noopener noreferrer" href={parsedLog}>Include Parsed Log Link</a>
                  </label>
                </div>
                <div>
                  <label>
                    <Input
                      type="checkbox"
                      checked={checkedLogLinks.includes(fullLog)}
                      onChange={() => this.toggleCheckedLogLink(fullLog)}
                    />
                    <a target="_blank" rel="noopener noreferrer" href={fullLog}>Include Full Log Link</a>
                  </label>
                </div>
                {!!reftestUrl && <div><label>
                  <Input
                    type="checkbox"
                    checked={checkedLogLinks.includes(reftestUrl)}
                    onChange={() => this.toggleCheckedLogLink(reftestUrl)}
                  />
                  <a target="_blank" rel="noopener noreferrer" href={reftestUrl}>Include Reftest Viewer Link</a>
                </label></div>}
              </div>
              <div>
                <label>Comment:</label>
                <Input
                  onChange={evt => this.setState({ comment: evt.target.value })}
                  type="textarea"
                  className="h-100"
                />
              </div>
              <div className="d-inline-flex mt-2 ml-5">
                <div className="mt-2">
                  <label>
                    <Input
                      onChange={() => this.setState({ isIntermittent: !isIntermittent })}
                      type="checkbox"
                      checked={isIntermittent}
                    />This is an intermittent failure
                  </label>
                </div>
                <div className="d-inline-flex ml-2">
                  <Input
                    id="blocksInput"
                    type="text"
                    onChange={evt => this.setState({ blocks: evt.target.value })}
                    placeholder="Blocks"
                  />
                  <Tooltip
                    target="blocksInput"
                    placement="bottom"
                    isOpen={tooltipOpen.blocksInput}
                    toggle={() => this.toggleTooltip('blocksInput')}
                  >Comma-separated list of bugs</Tooltip>
                  <Input
                    id="dependsOn"
                    type="text"
                    className="ml-1"
                    onChange={evt => this.setState({ dependsOn: evt.target.value })}
                    placeholder="Depends on"
                  />
                  <Tooltip
                    target="dependsOn"
                    placement="bottom"
                    isOpen={tooltipOpen.dependsOn}
                    toggle={() => this.toggleTooltip('dependsOn')}
                  >Comma-separated list of bugs</Tooltip>
                  <Input
                    id="seeAlso"
                    className="ml-1"
                    type="text"
                    onChange={evt => this.setState({ seeAlso: evt.target.value })}
                    placeholder="See also"
                  />
                  <Tooltip
                    target="seeAlso"
                    placement="bottom"
                    isOpen={tooltipOpen.seeAlso}
                    toggle={() => this.toggleTooltip('seeAlso')}
                  >Comma-separated list of bugs</Tooltip>
                </div>

              </div>
              {!!crashSignatures.length && <div id="modalCrashSignatureDiv">
                <label>Signature:</label>
                <Input
                  type="textarea"
                  onChange={evt => this.setState({ crashSignatures: evt.target.value })}
                  maxLength="2048"
                  readOnly
                  value={crashSignatures.join('\n')}
                />
              </div>}
            </form>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={this.submitFiler}>Submit Bug</Button>{' '}
            <Button color="secondary" onClick={toggle}>Cancel</Button>
          </ModalFooter>
        </Modal>
      </div>
    );
  }
}

BugFiler.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  suggestion: PropTypes.object.isRequired,
  suggestions: PropTypes.array.isRequired, // eslint-disable-line
  fullLog: PropTypes.string.isRequired,
  parsedLog: PropTypes.string.isRequired,
  reftestUrl: PropTypes.string.isRequired,
  successCallback: PropTypes.func.isRequired,
  jobGroupName: PropTypes.string.isRequired,
  notify: PropTypes.object.isRequired,
};
