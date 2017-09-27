import React from 'react';
import { Form, FormGroup, Input, Label, Row, Col, Table, Container } from 'reactstrap';
import Icon from 'react-fontawesome';
import { Test, BugCount } from './Test';
import StatusProgress from './StatusProgress';
import StatusNavbar from './StatusNavbar';
import { connect } from 'react-redux';
import { store, actions } from '../redux/store';

const mapStateToProps = ({ groups }) => groups;

export class Groups extends React.Component {

  componentWillMount() {
    this.filterStr = new URLSearchParams(location.search).get('filter') || '';
  }
  componentDidMount() { // eslint-disable-line class-methods-use-this

    // Get the mapping of optionCollectionHash to option names
    store.dispatch(actions.groups.fetchOptions());
    // Get the test data
    this.updateTests();

    // Update the tests every two minutes.
    this.testTimerId = setInterval(
      () => this.updateTests(),
      120000
    );
  }

  componentWillUnmount() {
    clearInterval(this.testTimerId);
  }

  updateTests() {
    const { options, location, hideClassified, bugSuggestions } = this.props;
    const searchParams = new URLSearchParams(location.search);
    const revision = searchParams.get('revision');
    const filter = searchParams.get('filter') || '';
    store.dispatch(actions.groups.updateTests(revision, filter, options, hideClassified, bugSuggestions));
  }

  filter(e) {
    const { groups, options, hideClassified } = this.props;
    const { value } = e.target;

    store.dispatch(actions.groups.filterTests(value, groups, options, hideClassified));
  }

  render() {
    return (
      <div>
        <StatusNavbar />
        <StatusProgress />
        <Container fluid style={{ marginBottom: '.5rem', marginTop: '5rem' }}>
          <Form onSubmit={e => e.preventDefault()}>
            <Row>
              <Col md={3} sm={12} xs={12} style={{ textAlign: 'right' }}>
                Known intermittent failure&nbsp;&nbsp;
                <Icon name="bug" style={{ color: '#d78236' }} /><br />
                Infrastructure issue&nbsp;&nbsp;
                <Icon name="chain-broken" style={{ color: '#db3737' }} />
              </Col>
              <Col md={6} sm={12} xs={12}>
                <FormGroup style={{ marginBottom: 0 }}>
                  <Label htmlFor="filter" hidden>Filter</Label>
                  <Input
                    style={{ borderRadius: '2rem' }}
                    type="text"
                    name="filter"
                    id="filter"
                    defaultValue={ this.filterStr }
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
              <th key="status" style={{ paddingLeft: '1rem', textAlign: 'center' }}>Bugs</th>
              <th key="test">Test</th>
            </tr>
          </thead>
            {this.props.fetchStatus === 'HasData' ? Object.entries(this.props.rowData).map(([name, rows], tkey) => (
              <tbody key={tkey}>
                <tr style={{ backgroundColor: '#f9f9f9' }}>
                  <td colSpan={4} style={{ textAlign: 'center', fontSize: '1.5rem' }}>
                    <code style={{ color: '#000', backgroundColor: 'transparent' }}>
                      {name}
                    </code>
                  </td>
                </tr>
                {Object.entries(rows).map(([testName, test], rkey) => (
                  <tr key={rkey}>
                    <BugCount testName={testName} test={test} jobGroup={name} />
                    <Test name={testName} test={test} jobGroup={name} />
                  </tr>
                ))}
              </tbody>
            )) : (
              this.props.fetchStatus ? (
                  <tbody>
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', paddingTop: '2rem' }}>
                      {this.props.fetchStatus}
                    </td>
                  </tr>
                  </tbody>

                ) : (
                  <tbody>
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', paddingTop: '2rem' }}>
                        <Icon name="spinner" size="2x" spin />
                      </td>
                    </tr>
                  </tbody>
                )
            )
          }
        </Table>
      </div>
    );
  }
}

export default connect(mapStateToProps)(Groups);
