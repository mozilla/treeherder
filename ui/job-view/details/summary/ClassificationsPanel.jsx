import React from 'react';
import PropTypes from 'prop-types';

import { linkifyRevisions, getBugUrl } from '../../../helpers/url';

export default function ClassificationsPanel(props) {
  const {
    $injector, repoName, classification, job, bugs,
  } = props;

  const ThRepositoryModel = $injector.get('ThRepositoryModel');
  const dateFilter = $injector.get('dateFilter');
  const classificationTypes = $injector.get('thClassificationTypes');

  const repo = ThRepositoryModel.getRepo(repoName);
  const repoURLHTML = { __html: linkifyRevisions(classification.text, repo) };
  const failureId = classification.failure_classification_id;
  const iconClass = `${(failureId === 7 ? 'fa-star-o' : 'fa fa-star')} star-${job.result}`;
  const classificationName = classificationTypes.classifications[failureId];

  return (
    <React.Fragment>
      <li>
        <span title={classificationName.name}>
          <i className={`fa ${iconClass}`} />
          <span className="ml-1">{classificationName.name}</span>
        </span>
        {!!bugs.length &&
          <a
            target="_blank"
            rel="noopener"
            href={getBugUrl(bugs[0].bug_id)}
            title={`View bug ${bugs[0].bug_id}`}
          ><em> {bugs[0].bug_id}</em></a>}
      </li>
      {classification.text.length > 0 &&
        <li><em dangerouslySetInnerHTML={repoURLHTML} /></li>
      }
      <li className="revision-comment">
        {dateFilter(classification.created, 'EEE MMM d, H:mm:ss')}
      </li>
      <li className="revision-comment">
        {classification.who}
      </li>
    </React.Fragment>
  );
}

ClassificationsPanel.propTypes = {
  $injector: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  classification: PropTypes.object.isRequired,
  job: PropTypes.object.isRequired,
  bugs: PropTypes.array.isRequired,
};
