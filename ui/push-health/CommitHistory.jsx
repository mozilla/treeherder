import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

import Clipboard from '../shared/Clipboard';
import PushHealthStatus from '../shared/PushHealthStatus';
import PushAuthor from '../shared/PushAuthor';
import { RevisionList } from '../shared/RevisionList';
import { getJobsUrl } from '../helpers/url';
import RepositoryModel from '../models/repository';
import { toDateStr } from '../helpers/display';

class CommitHistory extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      clipboardVisible: false,
      showAllRevisions: false,
    };
  }

  showClipboard = (show) => {
    this.setState({ clipboardVisible: show });
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
    const { clipboardVisible, showAllRevisions } = this.state;
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
    const authorPushFilterUrl = getJobsUrl({ author, repo: currentRepo.name });

    return (
      <React.Fragment>
        <div className="push-header border-bottom" data-testid="push-header">
          <div className="push-bar">
            <a
              href={revisionPushFilterUrl}
              title="View this push in Treeherder"
            >
              {toDateStr(pushTimestamp)}
              <FontAwesomeIcon
                icon={faExternalLinkAlt}
                className="ml-1 icon-superscript"
              />
            </a>
            <span className="mx-1">-</span>
            <PushAuthor author={author} url={authorPushFilterUrl} />
          </div>
        </div>
        {revisions.length <= 5 || showAllRevisions ? (
          <RevisionList
            revision={revision}
            revisions={revisions.slice(0, 20)}
            revisionCount={revisionCount}
            repo={currentRepo}
          />
        ) : (
          <span>
            <RevisionList
              revision={revision}
              revisions={revisions.slice(0, 5)}
              revisionCount={revisionCount}
              repo={currentRepo}
            />
            <Button
              outline
              color="darker-secondary"
              onClick={() =>
                this.setState({ showAllRevisions: !showAllRevisions })
              }
            >
              Show more...
            </Button>
          </span>
        )}
        <div className="mt-4">
          Parent Push:
          <span className="ml-2">
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
              <Clipboard
                description="full hash"
                text={parentSha}
                visible={clipboardVisible}
              />
              <a
                href={parentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open this push"
                data-testid="parent-commit-sha"
                className="mr-1 text-monospace commit-sha"
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
            </span>
          </span>
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
