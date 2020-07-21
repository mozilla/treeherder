import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons';

import Clipboard from '../shared/Clipboard';
import PushHealthStatus from '../shared/PushHealthStatus';
import { RevisionList } from '../shared/RevisionList';
import { Revision } from '../shared/Revision';
import { getJobsUrl } from '../helpers/url';
import RepositoryModel from '../models/repository';
import { toDateStr } from '../helpers/display';

class CommitHistory extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      clipboardVisible: false,
      isExpanded: false,
    };
  }

  showClipboard = (show) => {
    this.setState({ clipboardVisible: show });
  };

  toggleDetails = () => {
    this.setState((prevState) => ({
      isExpanded: !prevState.isExpanded,
    }));
  };

  render() {
    const {
      history: {
        parentRepository,
        jobCounts,
        exactMatch,
        parentSha,
        id,
        parentPushRevision,
        revisions,
        revisionCount,
        currentPush,
      },
      revision,
      currentRepo,
    } = this.props;
    const { clipboardVisible, isExpanded } = this.state;
    const parentRepoModel = new RepositoryModel(parentRepository);
    const parentLinkUrl = exactMatch
      ? `${getJobsUrl({
          revision: parentPushRevision,
          repo: parentRepository.name,
        })}`
      : parentRepoModel.getRevisionHref(parentSha);
    const revisionPushFilterUrl = getJobsUrl({
      revision,
      repo: currentRepo.name,
    });
    const { author, push_timestamp: pushTimestamp } = currentPush;
    const headerText = revisions[0].comments.split('\n')[0];
    const authorMatch = author.match(/<(.*?)>+/);
    const authorEmail = authorMatch ? authorMatch[1] : author;
    const expandIcon = isExpanded ? faCaretDown : faCaretRight;
    const expandTitle = isExpanded ? 'Click to collapse' : 'Click to expand';
    const expandText = isExpanded ? 'Hide all commits' : 'Show more commits';

    return (
      <React.Fragment>
        <div className="push-header" data-testid="push-header">
          <div className="push-bar">
            <div className="h3 text-capitalize" data-testid="headerText">
              {headerText}
            </div>
            <div className="text-secondary" data-testid="authorTime">
              {toDateStr(pushTimestamp)}
              <span className="mx-1">-</span>
              <span>{authorEmail}</span>
            </div>
          </div>
          <div className="text-secondary">
            Push
            <span className="font-weight-bold mr-1 ml-1">
              <a
                href={revisionPushFilterUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {revision.substring(0, 17)}...
              </a>
            </span>
            on
            <span className="d-inline-block text-capitalize font-weight-bold ml-1">
              {currentRepo.name}
            </span>
          </div>
        </div>
        <div className="commit-area mt-2 pl-3 text-secondary">
          {revisions.length > 1 && (
            <div>
              <Revision
                revision={revisions[1]}
                repo={currentRepo}
                key={revision.revision}
              />
            </div>
          )}
          {revisions.length > 2 && (
            <React.Fragment>
              <span className="font-weight-bold">
                <Button
                  onClick={this.toggleDetails}
                  outline
                  color="darker-secondary"
                  className="border-0 pl-0 ml-2 shadow-none"
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <FontAwesomeIcon
                    icon={expandIcon}
                    title={expandTitle}
                    aria-label={expandTitle}
                    alt=""
                  />
                  <span className="ml-1">{expandText}</span>
                </Button>
              </span>
              {isExpanded && (
                <RevisionList
                  revision={revision}
                  revisions={revisions.slice(2, 20)}
                  revisionCount={revisionCount - 2}
                  repo={currentRepo}
                />
              )}
            </React.Fragment>
          )}
          <div className="ml-1">
            Base commit:
            <span>
              {!exactMatch && (
                <div>
                  <Alert color="warning" className="m-3 font-italics">
                    Warning: Could not find an exact match parent Push in
                    Treeherder.
                  </Alert>
                  {id && <div>Closest match: </div>}
                </div>
              )}
              <span
                className="mb-2"
                onMouseEnter={() => this.showClipboard(true)}
                onMouseLeave={() => this.showClipboard(false)}
              >
                <a
                  href={parentLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open this push"
                  data-testid="parent-commit-sha"
                  className="mr-1 ml-1 text-monospace commit-sha font-weight-bold text-secondary"
                >
                  {parentPushRevision || parentSha}
                </a>
                {exactMatch && (
                  <PushHealthStatus
                    revision={parentPushRevision}
                    repoName={parentRepository.name}
                    jobCounts={jobCounts}
                  />
                )}
                <Clipboard
                  description="full hash"
                  text={parentSha}
                  visible={clipboardVisible}
                />
              </span>
            </span>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

CommitHistory.propTypes = {
  history: PropTypes.shape({
    parentRepository: PropTypes.object.isRequired,
    revisionCount: PropTypes.number.isRequired,
    parentPushRevision: PropTypes.string,
    job_counts: PropTypes.shape({
      completed: PropTypes.number.isRequired,
      pending: PropTypes.number.isRequired,
      running: PropTypes.number.isRequired,
    }),
    id: PropTypes.number,
  }).isRequired,
  revision: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
};

export default CommitHistory;
