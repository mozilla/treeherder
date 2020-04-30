import React, { Component } from 'react';
import { Alert, Table, Jumbotron, Badge } from 'reactstrap';

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
        <Jumbotron>
          <h4>Push Health Try Usage</h4>
          <p>
            This shows the difference in count of Need intermittents by push
            over time.
          </p>
        </Jumbotron>
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
            </tr>
          </thead>
          <tbody>
            {usage.map((rev) => {
              const {
                push: { revision, push_timestamp: pushTimestamp, author },
                peak: { needInvestigation: peakNI, time: peakTime },
                latest: { needInvestigation: latestNI, time: latestTime },
              } = rev;

              return (
                <tr key={revision} data-testid={`facet-${revision}`}>
                  <td data-testid="facet-link">
                    <a
                      href={`/pushhealth.html?repo=try&revision=${revision}`}
                      title="See Push Health"
                    >
                      {revision}
                    </a>
                  </td>
                  <td>{author}</td>
                  <td>{toShortDateStr(pushTimestamp)}</td>
                  <td>{peakNI}</td>
                  <td>{toShortDateStr(peakTime)}</td>
                  <td>{latestNI}</td>
                  <td>{toShortDateStr(latestTime)}</td>
                  <td>
                    <Badge color="success">
                      {peakNI - latestNI > 0 && peakNI - latestNI}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {failureMessage && <Alert color="danger">{failureMessage}</Alert>}
      </div>
    );
  }
}

export default Usage;
