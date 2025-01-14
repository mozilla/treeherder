import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretUp, faCaretRight } from '@fortawesome/free-solid-svg-icons';

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
      showParent,
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
    const expandIcon = isExpanded ? faCaretUp : faCaretRight;
    const expandTitle = isExpanded ? 'Click to collapse' : 'Click to expand';
    const expandText = isExpanded ? 'Hide commits' : 'Show more commits';

    return (
      <React.Fragment>
        <div className="push-header" data-testid="push-header">
          <div>
            <div className="commit-header" data-testid="headerText">
              {headerText}
            </div>
            <div className="text-secondary my-2" data-testid="authorTime">
              {toDateStr(pushTimestamp)}
              <span className="mx-1">-</span>
              <span>{authorEmail}</span>
            </div>
          </div>
          <div className="text-secondary mt-1">
            Push
            <span className="font-weight-bold mr-1 ml-1">
              <a
                href={currentRepo.getRevisionHref(revision)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {revision}
              </a>
            </span>
            on
            <span
              data-testid="header-repo"
              className="d-inline-block text-capitalize font-weight-bold ml-1"
            >
              {currentRepo.name}
            </span>
          </div>
          <div className="mt-2">
            <a
              href={revisionPushFilterUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View in Treeherder
            </a>
          </div>
        </div>
        <div className="commit-area mt-2 text-secondary">
          {revisions.length > 1 && (
            <div className="ml-3">
              <Revision
                revision={revisions[1]}
                repo={currentRepo}
                key={revision.revision}
                commitShaClass="font-weight-bold text-secondary h6"
                commentFont="h6"
              />
            </div>
          )}
          {revisions.length > 2 && isExpanded && (
            <RevisionList
              revision={revision}
              revisions={revisions.slice(2, 20)}
              revisionCount={revisionCount - 2}
              repo={currentRepo}
              commitShaClass="font-weight-bold text-secondary h6"
              commentFont="h6"
            />
          )}
          {showParent && (
            <div className="ml-3">
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
                    title="View this push"
                    data-testid="parent-commit-sha"
                    className="mr-1 ml-1 font-weight-bold text-secondary"
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
          )}
        </div>
        {revisions.length > 2 && (
          <span className="font-weight-bold">
            <Button
              onClick={this.toggleDetails}
              outline
              color="darker-secondary"
              className="border-0 pl-0 shadow-none"
              role="button"
              aria-expanded={isExpanded}
            >
              <FontAwesomeIcon
                icon={expandIcon}
                title={expandTitle}
                aria-label={expandTitle}
                alt=""
              />
              <span className="ml-1 font-weight-bold">{expandText}</span>
            </Button>
          </span>
        )}
      </React.Fragment>
    );
  }
}

CommitHistory.propTypes = {
  history: PropTypes.shape({
    parentRepository: PropTypes.shape({}).isRequired,
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
  showParent: PropTypes.bool,
};

CommitHistory.defaultProps = {
  showParent: true,
};

export default CommitHistory;
