import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'reactstrap';

import PushHealthStatus from '../shared/PushHealthStatus';
import { getJobsUrl } from '../helpers/url';
import RepositoryModel from '../models/repository';

const ParentPush = props => {
  const {
    parent: { repository, revision, jobCounts, exactMatch, parentSha, id },
  } = props;
  const repoModel = new RepositoryModel(repository);

  return (
    <React.Fragment>
      {!exactMatch && (
        <React.Fragment>
          <div className="mb-2">
            <a
              href={repoModel.getRevisionHref(parentSha)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {parentSha}
            </a>
          </div>
          <Alert color="warning" className="m-3 font-italics">
            Warning: Could not find an exact match parent Push.
          </Alert>
          {id && <div>Closest match: </div>}
        </React.Fragment>
      )}
      {id && (
        <React.Fragment>
          <a
            href={`${getJobsUrl({ revision, repo: repository.name })}`}
            className="mx-1"
            target="_blank"
            rel="noopener noreferrer"
            title="Open this push in Treeherder"
          >
            {revision}
          </a>
          <PushHealthStatus
            revision={revision}
            repoName={repository.name}
            jobCounts={jobCounts}
          />
        </React.Fragment>
      )}
    </React.Fragment>
  );
};

ParentPush.propTypes = {
  parent: PropTypes.shape({
    repository: PropTypes.object.isRequired,
    revision: PropTypes.string.isRequired,
    job_counts: PropTypes.shape({
      completed: PropTypes.number.isRequired,
      pending: PropTypes.number.isRequired,
      running: PropTypes.number.isRequired,
    }),
    id: PropTypes.number,
  }).isRequired,
};

export default ParentPush;
