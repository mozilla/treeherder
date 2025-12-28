
import { render, waitFor } from '@testing-library/react';
import { createBrowserHistory } from 'history';
import { Provider, ReactReduxContext } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';

import AlertHeaderTitle from '../../../../ui/perfherder/alerts/AlertHeaderTitle';
import testAlertSummaries from '../../mock/alert_summaries_with_critical_tests.json';
import { configureStore } from '../../../../ui/job-view/redux/configureStore';

const history = createBrowserHistory();

const frameworks = [
  {
    id: 15,
    name: 'mozperftest',
  },
  {
    id: 13,
    name: 'browsertime',
  },
];

afterEach(() => history.push('/alerts'));

const alertHeaderTitleTest = (alertSummary) => {
  const store = configureStore(history);

  return render(
    <Provider store={store} context={ReactReduxContext}>
      <ConnectedRouter history={history} context={ReactReduxContext}>
        <AlertHeaderTitle alertSummary={alertSummary} frameworks={frameworks} />
      </ConnectedRouter>
    </Provider>,
  );
};

test("Critical badge is displayed near alert summary for 'newssite-applink a55' test", async () => {
  const { findByText } = alertHeaderTitleTest(testAlertSummaries[0]);

  const criticalTag = await waitFor(() => findByText('critical'));

  expect(criticalTag.textContent).toBe('critical');
});

test("Critical badge is displayed near alert summary for 'speedometer3 score windows11 shippable' test", async () => {
  const { findByText } = alertHeaderTitleTest(testAlertSummaries[1]);

  const criticalTag = await waitFor(() => findByText('critical'));

  expect(criticalTag.textContent).toBe('critical');
});
