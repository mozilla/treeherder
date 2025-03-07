import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Label,
} from 'reactstrap';

import { parseSummary, getCrashSignatures } from '../helpers/bug';
import { notify } from '../job-view/redux/stores/notifications';

export class InternalIssueFilerClass extends React.Component {
  constructor(props) {
    super(props);

    const { suggestion, jobGroupName } = props;

    const parsedSummary = parseSummary(suggestion);
    let summaryString = parsedSummary[0].join(' | ');
    if (jobGroupName.toLowerCase().includes('reftest')) {
      const re = /layout\/reftests\//gi;
      summaryString = summaryString.replace(re, '');
    }

    const crashSignatures = getCrashSignatures(suggestion);

    if (crashSignatures.length > 0) {
      isTestPath = false;
      const parts = summaryString.split(' | ');
      summaryString = `${parts[0]} | single tracking bug`;
      keywords.push('intermittent-testcase');
    }

    let isAssertion = [
      /ASSERTION:/, // binary code
      /assertion fail/i, // JavaScript
      /assertion count \d+ is \w+ than expected \d+ assertion/, // layout
    ].some((regexp) => regexp.test(summaryString));

    const jg = jobGroupName.toLowerCase();
    if (
      jg.includes('xpcshell') ||
      jg.includes('mochitest') ||
      jg.includes('web platform tests') ||
      jg.includes('reftest') ||
      jg.includes('talos') ||
      jobTypeName.includes('junit') ||
      jobTypeName.includes('marionette')
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
        jobGroupName.includes('reftest') &&
        !/.*image comparison, max difference.*/.test(summaryString)
      ) {
        isTestPath = false;
      } else if (
        jg.includes('web platform tests') ||
        jobTypeName.includes('marionette')
      ) {
        trimParams = true;
      }

      // If not leak
      if (!isAssertion && isTestPath) {
        const parts = summaryString.split(' | ');
        // split('?') is for removing `?params...` from the test name
        if (parts.length === 2 || parts.length === 1) {
          summaryString = `${
            trimParams ? parts[0].split('?')[0].split(' ')[0] : parts[0]
          } | single tracking bug`;
        } else if (parts.length === 3) {
          summaryString = `${
            trimParams ? parts[1].split('?')[0].split(' ')[0] : parts[1]
          } | single tracking bug`;
        }
      }
    }

    this.state = {
      summary: `Intermittent ${summaryString}`,
    };
  }

  submitInternalIssue = async () => {
    const { summary } = this.state;
    const { notify } = this.props;

    notify(summary, 'danger');
  };

  render() {
    const { isOpen, toggle } = this.props;
    const { summary } = this.state;

    return (
      <div>
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
          <ModalHeader toggle={toggle}>
            Intermittent Internal Issue Filer
          </ModalHeader>
          <ModalBody>
            <form className="d-flex flex-column">
              <Label for="summary">Summary:</Label>
              <div className="d-flex">
                <Input
                  id="summary"
                  className="flex-grow-1"
                  type="text"
                  placeholder="Intermittent..."
                  pattern=".{0,255}"
                  defaultValue={summary}
                />
              </div>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={this.submitFiler}>
              Submit Internal Issue
            </Button>{' '}
            <Button color="secondary" onClick={toggle}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    );
  }
}

InternalIssueFilerClass.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  suggestion: PropTypes.shape({}).isRequired,
  jobGroupName: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
};

export default connect(null, { notify })(InternalIssueFilerClass);
