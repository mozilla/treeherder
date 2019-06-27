import React from 'react';
import PropTypes from 'prop-types';
import {
  Form,
  FormGroup,
  Input,
  Label,
  Row,
  Col,
  Table,
  Container,
} from 'reactstrap';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBug, faSpinner, faUnlink } from '@fortawesome/free-solid-svg-icons';

import { store, actions } from '../redux/store';

import { Test, BugCount } from './Test';
import StatusProgress from './StatusProgress';
import StatusNavbar from './StatusNavbar';

const mapStateToProps = ({ groups }) => groups;

class Groups extends React.Component {
  constructor(props) {
    super(props);
    this.filterStr =
      new URLSearchParams(window.location.search).get('filter') || '';
  }

  componentDidMount() {
    // Get the mapping of optionCollectionHash to option names
    store.dispatch(actions.groups.fetchOptions());
    // Get the test data
    this.updateTests();

    // Update the tests every two minutes.
    this.testTimerId = setInterval(() => this.updateTests(), 120000);
  }

  componentWillUnmount() {
    clearInterval(this.testTimerId);
  }

  updateTests() {
    const { options, location, hideClassified, bugSuggestions } = this.props;
    const searchParams = new URLSearchParams(location.search);
    const revision = searchParams.get('revision');
    const filter = searchParams.get('filter') || '';

    store.dispatch(
      actions.groups.updateTests(
        revision,
        filter,
        options,
        hideClassified,
        bugSuggestions,
      ),
    );
  }

  filter(e) {
    const { groups, options, hideClassified } = this.props;
    const { value } = e.target;

    store.dispatch(
      actions.groups.filterTests(value, groups, options, hideClassified),
    );
  }

  render() {
    const { fetchStatus, rowData } = this.props;
    return (
      <div>
        <StatusNavbar />
        <StatusProgress />
        <Container fluid style={{ marginBottom: '.5rem', marginTop: '5rem' }}>
          <Form onSubmit={e => e.preventDefault()}>
            <Row>
              <Col md={3} sm={12} xs={12} style={{ textAlign: 'right' }}>
                Known intermittent failure&nbsp;&nbsp;
                <FontAwesomeIcon
                  icon={faBug}
                  size="sm"
                  className="classified-intermittent"
                  title="classified-intermittent"
                />
                <br />
                Infrastructure issue&nbsp;&nbsp;
                <FontAwesomeIcon
                  icon={faUnlink}
                  size="sm"
                  className="classified-infra"
                  title="classified-infra"
                />
              </Col>
              <Col md={6} sm={12} xs={12}>
                <FormGroup style={{ marginBottom: 0 }}>
                  <Label htmlFor="filter" hidden>
                    Filter
                  </Label>
                  <Input
                    style={{ borderRadius: '2rem' }}
                    type="text"
                    name="filter"
                    id="filter"
                    defaultValue={this.filterStr}
                    placeholder="Filter with one or more space-separated words or regexes..."
                    onChange={e => this.filter(e)}
                  />
                </FormGroup>
              </Col>
            </Row>
          </Form>
        </Container>

        <Table size="sm" responsive>
          <thead>
            <tr>
              <th
                key="status"
                style={{ paddingLeft: '1rem', textAlign: 'center' }}
              >
                Bugs
              </th>
              <th key="test">Test</th>
            </tr>
          </thead>
          {// eslint-disable-next-line no-nested-ternary
          fetchStatus === 'HasData' ? (
            Object.entries(rowData).map(([name, rows]) => (
              <tbody key={name}>
                <tr style={{ backgroundColor: '#f9f9f9' }}>
                  <td
                    colSpan={4}
                    style={{ textAlign: 'center', fontSize: '1.5rem' }}
                  >
                    <code
                      style={{ color: '#000', backgroundColor: 'transparent' }}
                    >
                      {name}
                    </code>
                  </td>
                </tr>
                {Object.entries(rows).map(([testName, test]) => (
                  <tr key={testName}>
                    <BugCount testName={testName} test={test} jobGroup={name} />
                    <Test name={testName} test={test} jobGroup={name} />
                  </tr>
                ))}
              </tbody>
            ))
          ) : fetchStatus ? (
            <tbody>
              <tr>
                <td
                  colSpan={4}
                  style={{ textAlign: 'center', paddingTop: '2rem' }}
                >
                  {fetchStatus}
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              <tr>
                <td
                  colSpan={4}
                  style={{ textAlign: 'center', paddingTop: '2rem' }}
                >
                  <FontAwesomeIcon
                    icon={faSpinner}
                    size="2x"
                    spin
                    title="Loading..."
                  />
                </td>
              </tr>
            </tbody>
          )}
        </Table>
      </div>
    );
  }
}

Groups.propTypes = {
  options: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
  hideClassified: PropTypes.object.isRequired,
  bugSuggestions: PropTypes.object.isRequired,
  groups: PropTypes.object.isRequired,
  rowData: PropTypes.object.isRequired,
  fetchStatus: PropTypes.string,
};

Groups.defaultProps = {
  fetchStatus: null,
};

export default connect(mapStateToProps)(Groups);
