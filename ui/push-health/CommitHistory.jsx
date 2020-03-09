import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Col } from 'reactstrap';

import PushHealthStatus from '../shared/PushHealthStatus';
import { RevisionList } from '../shared/RevisionList';
import { getJobsUrl } from '../helpers/url';
import RepositoryModel from '../models/repository';
import Clipboard from '../shared/Clipboard';

class CommitHistory extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      clipboardVisible: false,
    };
  }

  showClipboard = show => {
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
      },
      revision,
      currentRepo,
    } = this.props;
    const { clipboardVisible } = this.state;
    const parentRepoModel = new RepositoryModel(parentRepository);
    const parentLinkUrl = exactMatch
      ? `${getJobsUrl({
          revision: parentPushRevision,
          repo: parentRepository.name,
        })}`
      : parentRepoModel.getRevisionHref(parentSha);

    return (
      <React.Fragment>
        <h5>Parent Push</h5>
        <div className="ml-4">
          {!exactMatch && (
            <div>
              <Alert color="warning" className="m-3 font-italics">
                Warning: Could not find an exact match parent Push in
                Treeherder.
              </Alert>
              {id && <div>Closest match: </div>}
            </div>
          )}
          <Col
            className="mb-2 ml-2"
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
          </Col>
        </div>
        <h5 className="mt-4">Commit revisions</h5>
        <RevisionList
          revision={revision}
          revisions={revisions.slice(0, 20)}
          revisionCount={revisionCount}
          repo={currentRepo}
        />
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
  currentRepo: PropTypes.object.isRequired,
};

export default CommitHistory;
