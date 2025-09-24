import React from 'react';
import { Table, Alert } from 'reactstrap';
import PropTypes from 'prop-types';

const NoiseTable = ({ testsWithNoise, hasSubtests }) => {
  const valueToString = (value) => {
    if (Number.isNaN(value)) {
      return value.toString();
    }
    return value;
  };

  return (
    <Alert color="info">
      <p className="font-weight-bold">
        Tests with too much noise to be considered in the noise metric
      </p>
      <Table sz="small" className="text-left" borderless>
        <thead>
          <tr>
            {!hasSubtests && <th className="text-left">Platform</th>}
            <th className="text-left">Testname</th>
            <th className="text-left">Base Stddev</th>
            <th className="text-left">New Stddev</th>
          </tr>
        </thead>
        <tbody>
          {testsWithNoise.map((test) => (
            <tr key={`${test.testname} ${test.platform || ''}`}>
              {test.platform && <td>{test.platform}</td>}
              <td>{test.testname}</td>
              <td>{valueToString(test.baseStddev)}</td>
              <td>{valueToString(test.newStddev)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Alert>
  );
};
NoiseTable.propTypes = {
  testsWithNoise: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  hasSubtests: PropTypes.bool,
};

NoiseTable.defaultProps = {
  hasSubtests: false,
};

export default NoiseTable;
