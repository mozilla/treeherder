import AlertActionPanel from '../../../../ui/perfherder/alerts/AlertActionPanel';

const buildPanel = ({
  selectedAlerts,
  alertSummary,
  alertSummaries,
  modifyAlert = jest.fn().mockResolvedValue({ failureStatus: false }),
}) => {
  const fetchAlertSummaries = jest.fn();
  const updateViewState = jest.fn();
  const panel = new AlertActionPanel({
    selectedAlerts,
    alertSummary,
    alertSummaries,
    fetchAlertSummaries,
    updateViewState,
    updateState: jest.fn(),
    modifyAlert,
  });
  return { panel, fetchAlertSummaries, updateViewState };
};

test('Reassigning an alert refreshes the summary it was moved away from', async () => {
  // summary 1 holds the alert, which is already reassigned to summary 2
  const selectedAlert = { id: 10, related_summary_id: 2 };
  const alertSummary = {
    id: 1,
    alerts: [selectedAlert, { id: 11, related_summary_id: null }],
    related_alerts: [],
  };
  const alertSummaries = [
    alertSummary,
    { id: 2, alerts: [], related_alerts: [selectedAlert] },
    { id: 3, alerts: [], related_alerts: [] },
    { id: 4, alerts: [], related_alerts: [] },
  ];
  const { panel, fetchAlertSummaries } = buildPanel({
    selectedAlerts: [selectedAlert],
    alertSummary,
    alertSummaries,
  });

  await panel.updateAndFetch('reassigned', 3);

  expect(fetchAlertSummaries).toHaveBeenCalledTimes(3);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(1);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(2);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(3);
});

test('Reassigning an alert refreshes its home summary when viewed from the summary it was moved to', async () => {
  // the alert belongs to summary 1 and is held by summary 2, which is the one viewed
  const selectedAlert = { id: 10, related_summary_id: 2 };
  const home = { id: 1, alerts: [selectedAlert], related_alerts: [] };
  const holder = {
    id: 2,
    alerts: [{ id: 20, related_summary_id: null }],
    related_alerts: [selectedAlert],
  };
  const alertSummaries = [
    home,
    holder,
    { id: 3, alerts: [], related_alerts: [] },
    { id: 4, alerts: [], related_alerts: [] },
  ];
  const { panel, fetchAlertSummaries } = buildPanel({
    selectedAlerts: [selectedAlert],
    alertSummary: holder,
    alertSummaries,
  });

  await panel.updateAndFetch('reassigned', 3);

  expect(fetchAlertSummaries).toHaveBeenCalledTimes(3);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(1);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(2);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(3);
  expect(fetchAlertSummaries).not.toHaveBeenCalledWith(4);
});

test('Reassigning an alert refreshes the summary that holds it, even when its home shows a different one', async () => {
  // summary 1 still shows the alert as reassigned to 2, but summary 3 is the one holding it
  const selectedAlert = { id: 10, related_summary_id: 2 };
  const home = {
    id: 1,
    alerts: [selectedAlert, { id: 11, related_summary_id: null }],
    related_alerts: [],
  };
  const alertSummaries = [
    home,
    { id: 2, alerts: [], related_alerts: [] },
    { id: 3, alerts: [], related_alerts: [selectedAlert] },
    { id: 4, alerts: [], related_alerts: [] },
  ];
  const { panel, fetchAlertSummaries } = buildPanel({
    selectedAlerts: [selectedAlert],
    alertSummary: home,
    alertSummaries,
  });

  await panel.updateAndFetch('reassigned', 2);

  expect(fetchAlertSummaries).toHaveBeenCalledTimes(3);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(1);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(2);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(3);
  expect(fetchAlertSummaries).not.toHaveBeenCalledWith(4);
});

test('Downstream moves refresh the summary they left and the one they went to', async () => {
  const selectedAlert = { id: 10, related_summary_id: 2 };
  const alertSummary = {
    id: 1,
    alerts: [selectedAlert, { id: 11, related_summary_id: null }],
    related_alerts: [],
  };
  const alertSummaries = [
    alertSummary,
    { id: 2, alerts: [], related_alerts: [selectedAlert] },
    { id: 3, alerts: [], related_alerts: [] },
  ];
  const { panel, fetchAlertSummaries } = buildPanel({
    selectedAlerts: [selectedAlert],
    alertSummary,
    alertSummaries,
  });

  await panel.updateAndFetch('downstream', 3);

  expect(fetchAlertSummaries).toHaveBeenCalledTimes(3);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(1);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(2);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(3);
});

test('Reassigning every alert of a summary refreshes the whole page', async () => {
  // the only alert in summary 1 is moved, so nothing is left there to triage
  const selectedAlert = { id: 10, related_summary_id: null };
  const alertSummary = { id: 1, alerts: [selectedAlert], related_alerts: [] };
  const alertSummaries = [alertSummary, { id: 2, alerts: [], related_alerts: [] }];
  const { panel, fetchAlertSummaries } = buildPanel({
    selectedAlerts: [selectedAlert],
    alertSummary,
    alertSummaries,
  });

  await panel.updateAndFetch('reassigned', 2);

  expect(fetchAlertSummaries).toHaveBeenCalledTimes(1);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(undefined, false);
});

test('Resetting alerts refreshes the whole page', async () => {
  const selectedAlert = { id: 10, related_summary_id: 2 };
  const alertSummary = {
    id: 1,
    alerts: [selectedAlert, { id: 11, related_summary_id: null }],
    related_alerts: [],
  };
  const alertSummaries = [
    alertSummary,
    { id: 2, alerts: [], related_alerts: [selectedAlert] },
  ];
  const { panel, fetchAlertSummaries } = buildPanel({
    selectedAlerts: [selectedAlert],
    alertSummary,
    alertSummaries,
  });

  await panel.updateAndFetch('untriaged');

  expect(fetchAlertSummaries).toHaveBeenCalledTimes(1);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(undefined, false);
});

test('Only the summaries on the page are refreshed', async () => {
  // summary 7 (the old destination) and summary 99 (the new one) are not on the page
  const selectedAlert = { id: 10, related_summary_id: 7 };
  const alertSummary = {
    id: 1,
    alerts: [selectedAlert, { id: 11, related_summary_id: null }],
    related_alerts: [],
  };
  const alertSummaries = [alertSummary, { id: 2, alerts: [], related_alerts: [] }];
  const { panel, fetchAlertSummaries } = buildPanel({
    selectedAlerts: [selectedAlert],
    alertSummary,
    alertSummaries,
  });

  await panel.updateAndFetch('reassigned', 99);

  expect(fetchAlertSummaries).toHaveBeenCalledTimes(1);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(1);
});

test('Moving alerts that came from different summaries refreshes each of them once', async () => {
  const fromTwo = { id: 10, related_summary_id: 2 };
  const fromThree = { id: 12, related_summary_id: 3 };
  const alertSummary = {
    id: 1,
    alerts: [fromTwo, fromThree, { id: 11, related_summary_id: null }],
    related_alerts: [],
  };
  const alertSummaries = [
    alertSummary,
    { id: 2, alerts: [], related_alerts: [fromTwo] },
    { id: 3, alerts: [], related_alerts: [fromThree] },
    { id: 4, alerts: [], related_alerts: [] },
  ];
  const { panel, fetchAlertSummaries } = buildPanel({
    selectedAlerts: [fromTwo, fromThree],
    alertSummary,
    alertSummaries,
  });

  await panel.updateAndFetch('reassigned', 4);

  expect(fetchAlertSummaries).toHaveBeenCalledTimes(4);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(1);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(2);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(3);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(4);
});

test('Moving alerts to the summary they are already reassigned to refreshes it once', async () => {
  const selectedAlert = { id: 10, related_summary_id: 2 };
  const alertSummary = {
    id: 1,
    alerts: [selectedAlert, { id: 11, related_summary_id: null }],
    related_alerts: [],
  };
  const alertSummaries = [
    alertSummary,
    { id: 2, alerts: [], related_alerts: [selectedAlert] },
  ];
  const { panel, fetchAlertSummaries } = buildPanel({
    selectedAlerts: [selectedAlert],
    alertSummary,
    alertSummaries,
  });

  await panel.updateAndFetch('reassigned', 2);

  expect(fetchAlertSummaries).toHaveBeenCalledTimes(2);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(1);
  expect(fetchAlertSummaries).toHaveBeenCalledWith(2);
});

test('Failed updates do not refresh any summary', async () => {
  const selectedAlert = { id: 10, related_summary_id: null };
  const alertSummary = { id: 1, alerts: [selectedAlert], related_alerts: [] };
  const alertSummaries = [alertSummary, { id: 2, alerts: [], related_alerts: [] }];
  const modifyAlert = jest
    .fn()
    .mockResolvedValue({ failureStatus: 500, data: 'Server error' });
  const { panel, fetchAlertSummaries, updateViewState } = buildPanel({
    selectedAlerts: [selectedAlert],
    alertSummary,
    alertSummaries,
    modifyAlert,
  });

  await panel.updateAndFetch('reassigned', 2);

  expect(updateViewState).toHaveBeenCalledWith({ errorMessages: ['Server error'] });
  expect(fetchAlertSummaries).not.toHaveBeenCalled();
});
