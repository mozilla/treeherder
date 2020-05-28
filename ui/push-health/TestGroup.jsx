import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Badge, Button, Collapse } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons';

import Clipboard from '../shared/Clipboard';

import TestFailure from './TestFailure';

class TestGroup extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      clipboardVisible: null,
      detailsShowing: true,
    };
  }

  setClipboardVisible = (key) => {
    this.setState({ clipboardVisible: key });
  };

  toggleDetails = () => {
    this.setState((prevState) => ({
      detailsShowing: !prevState.detailsShowing,
    }));
  };

  render() {
    const {
      group,
      repo,
      revision,
      notify,
      currentRepo,
      groupedBy,
    } = this.props;
    const { clipboardVisible, detailsShowing } = this.state;

    return (
      <div>
        <div key={group.id} data-testid="test-grouping">
          <span
            className="d-flex border-top w-100 bg-light p-2 border-top-1 border-secondary rounded"
            onMouseEnter={() => this.setClipboardVisible(group.key)}
            onMouseLeave={() => this.setClipboardVisible(null)}
          >
            <Button
              id={`group-${group.id}`}
              className="text-break text-wrap text-monospace border-0"
              title="Click to expand for test detail"
              outline
              onClick={this.toggleDetails}
            >
              <FontAwesomeIcon
                icon={detailsShowing ? faCaretDown : faCaretRight}
                style={{ minWidth: '1em' }}
                className="mr-1"
              />
              {group.key === 'none' ? 'All' : group.key}
              {!!group.failedInParent && (
                <Badge color="info" className="mx-1">
                  {group.failedInParent} from parent
                </Badge>
              )}
            </Button>
            <Clipboard
              text={group.key}
              description="group text"
              visible={clipboardVisible === group.key}
            />
          </span>

          <Collapse isOpen={detailsShowing}>
            {group.tests.map((failure) => (
              <TestFailure
                key={failure.key}
                failure={failure}
                repo={repo}
                currentRepo={currentRepo}
                revision={revision}
                notify={notify}
                groupedBy={groupedBy}
                className="ml-3"
              />
            ))}
          </Collapse>
        </div>
      </div>
    );
  }
}

TestGroup.propTypes = {
  group: PropTypes.shape({
    failedInParent: PropTypes.number.isRequired,
    id: PropTypes.string.isRequired,
    key: PropTypes.string.isRequired,
    tests: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  groupedBy: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
};

export default TestGroup;
