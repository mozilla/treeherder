import { Component } from 'react';
import { Alert, Table, Card, Badge } from 'react-bootstrap';
import { Link } from 'react-router';

import { getData } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import { toShortDateStr } from '../helpers/display';

class Usage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      usage: [],
      failureMessage: null,
    };
  }

  async componentDidMount() {
    const { data, failureStatus } = await getData(
      getProjectUrl('/push/health_usage/', 'try'),
    );
    if (!failureStatus) {
      const { usage } = data;

      this.setState({ usage });
    } else {
      this.setState({ failureMessage: data });
    }
  }

  render() {
    const { usage, failureMessage } = this.state;

    return (
      <div>
        <Card className="mb-3">
          <Card.Body>
            <Card.Title>Push Health Try Usage</Card.Title>
            <Card.Text>
              This shows the difference in count of need intermittents by push
              over time.
            </Card.Text>
          </Card.Body>
        </Card>
        <Table>
          <thead>
            <tr>
              <th>Push</th>
              <th>Author</th>
              <th>Push Time</th>
              <th>Peak</th>
              <th>Peak Time</th>
              <th>Latest</th>
              <th>Latest Time</th>
              <th>Delta</th>
              <th>Retriggers</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((rev) => {
              const {
                push: { revision, push_timestamp: pushTimestamp, author },
                peak: { needInvestigation: peakNI, time: peakTime },
                latest: { needInvestigation: latestNI, time: latestTime },
                retriggers,
              } = rev;

              return (
                <tr key={revision} data-testid={`facet-${revision}`}>
                  <td data-testid="facet-link">
                    <Link
                      to={`./push?repo=try&revision=${revision}`}
                      title="See Push Health"
                    >
                      {revision}
                    </Link>
                  </td>
                  <td>{author}</td>
                  <td>{toShortDateStr(pushTimestamp)}</td>
                  <td>{peakNI}</td>
                  <td>{toShortDateStr(peakTime)}</td>
                  <td>{latestNI}</td>
                  <td>{toShortDateStr(latestTime)}</td>
                  <td>
                    <Badge bg="success" text="light">
                      {peakNI - latestNI > 0 && peakNI - latestNI}
                    </Badge>
                  </td>
                  <td>{retriggers}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {failureMessage && <Alert variant="danger">{failureMessage}</Alert>}
      </div>
    );
  }
}

export default Usage;
