import React from 'react';
import PropTypes from 'prop-types';
import { Container } from 'reactstrap';

import { onPermalinkClick } from '../perfherder/helpers';

import InfraCompareTable from './InfraCompareTable';

export default class InfraCompareTableControls extends React.Component {
  constructor(props) {
    super(props);
    this.validated = this.props.validated;
  }

  render() {
    const {
      user,
      isBaseAggregate,
      notify,
      onPermalinkClick,
      projects,
      history,
      compareResults,
    } = this.props;

    return (
      <Container fluid className="my-3 px-0">
        {compareResults.size > 0 ? (
          Array.from(compareResults).map(([testName, data]) => (
            <InfraCompareTable
              key={testName}
              data={data}
              testName={testName}
              onPermalinkClick={onPermalinkClick}
              user={user}
              isBaseAggregate={isBaseAggregate}
              notify={notify}
              projects={projects}
              history={history}
            />
          ))
        ) : (
          <p className="lead text-center">No results to show</p>
        )}
      </Container>
    );
  }
}

InfraCompareTableControls.propTypes = {
  compareResults: PropTypes.shape({}).isRequired,
  user: PropTypes.shape({}).isRequired,
  isBaseAggregate: PropTypes.bool.isRequired,
  notify: PropTypes.func.isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  validated: PropTypes.shape({
    showOnlyImportant: PropTypes.string,
    showOnlyComparable: PropTypes.string,
    showOnlyConfident: PropTypes.string,
    showOnlyNoise: PropTypes.string,
  }),
  onPermalinkClick: PropTypes.func,
};

InfraCompareTableControls.defaultProps = {
  validated: {
    showOnlyImportant: undefined,
    showOnlyComparable: undefined,
    showOnlyConfident: undefined,
    showOnlyNoise: undefined,
  },
  onPermalinkClick,
};
