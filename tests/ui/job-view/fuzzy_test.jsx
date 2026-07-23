
import { render, fireEvent, waitFor } from '@testing-library/react';

import fuzzyJobList from '../mock/job_list/fuzzy_jobs/fuzzyJobList.json';
import initialJobList from '../mock/job_list/fuzzy_jobs/initial_job_list.json';
import searchLinuxResults from '../mock/job_list/fuzzy_jobs/search_linux_results.json';
import searchDebugResults from '../mock/job_list/fuzzy_jobs/search_debug_results.json';
import FuzzyJobFinder from '../../../ui/job-view/pushes/FuzzyJobFinder';

describe('FuzzyJobFinder', () => {
  const isOpen = true;
  const decisionTaskId = 'YHKMjYZeSSmEZTrAPdRIag';
  const id = 705037;
  const currentRepo = {
    id: 77,
    repository_group: {
      name: 'development',
      description:
        'Collection of repositories where code initially lands in the development process',
    },
    name: 'autoland',
    dvcs_type: 'hg',
    url: 'https://hg.mozilla.org/integration/autoland',
    branch: null,
    codebase: 'gecko',
    description: 'The destination for automatically landed Firefox commits.',
    active_status: 'active',
    performance_alerts_enabled: true,
    expire_performance_data: false,
    is_try_repo: false,
    tc_root_url: 'https://firefox-ci-tc.services.mozilla.com',
    pushLogUrl: 'https://hg.mozilla.org/integration/autoland/pushloghtml',
    revisionHrefPrefix: 'https://hg.mozilla.org/integration/autoland/rev/',
  };
  const testFuzzyJobFinder = (
    <FuzzyJobFinder
      isOpen={isOpen}
      toggle={() => {}}
      jobList={fuzzyJobList}
      filteredJobList={fuzzyJobList}
      className="fuzzy-modal"
      pushId={id}
      decisionTaskId={decisionTaskId}
      currentRepo={currentRepo}
      notify={() => {}}
    />
  );

  test('Fuzzy search gives expected results', async () => {
    const { getByTitle, queryAllByTestId } = await render(testFuzzyJobFinder);
    const inputElement = getByTitle('Filter the list of runnable jobs');

    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(60);
      const fuzzySearchArray = queryAllByTestId('fuzzyList').map(
        (job) => job.innerHTML,
      );
      expect(fuzzySearchArray).toStrictEqual(
        expect.arrayContaining(initialJobList),
      );
    });

    await fireEvent.change(inputElement, { target: { value: 'linux' } });
    expect(inputElement.value).toBe('linux');
    await fireEvent.keyDown(inputElement, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(26);
      const fuzzySearchArray = queryAllByTestId('fuzzyList').map(
        (job) => job.innerHTML,
      );
      expect(fuzzySearchArray).toStrictEqual(
        expect.arrayContaining(searchLinuxResults),
      );
    });
  });

  test('Fuzzy search gives expected results for extended operators', async () => {
    const { getByTitle, queryAllByTestId } = await render(testFuzzyJobFinder);
    const inputElement = getByTitle('Filter the list of runnable jobs');

    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(60);
      const fuzzySearchArray = queryAllByTestId('fuzzyList').map(
        (job) => job.innerHTML,
      );
      expect(fuzzySearchArray).toStrictEqual(
        expect.arrayContaining(initialJobList),
      );
    });

    await fireEvent.change(inputElement, { target: { value: 'debug$' } });
    expect(inputElement.value).toBe('debug$');
    await fireEvent.keyDown(inputElement, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(16);
      const fuzzySearchArray = queryAllByTestId('fuzzyList').map(
        (job) => job.innerHTML,
      );
      expect(fuzzySearchArray).toStrictEqual(
        expect.arrayContaining(searchDebugResults),
      );
    });
  });

  test('Toggling "Use full job list" switches the source list and keeps the search applied', async () => {
    // Distinct trimmed vs. full lists so the toggle produces an observable
    // difference (the shared mock uses the same array for both).
    const filteredList = [
      { name: 'test-linux64/opt', symbol: 'l', groupsymbol: '' },
      { name: 'test-macosx64/opt', symbol: 'm', groupsymbol: '' },
    ];
    const fullList = [
      ...filteredList,
      { name: 'test-linux64/debug', symbol: 'l', groupsymbol: '' },
      { name: 'test-linux1804-64/opt', symbol: 'l', groupsymbol: '' },
    ];

    const { getByTitle, getByRole, queryAllByTestId } = await render(
      <FuzzyJobFinder
        isOpen={isOpen}
        toggle={() => {}}
        jobList={fullList}
        filteredJobList={filteredList}
        className="fuzzy-modal"
        pushId={id}
        decisionTaskId={decisionTaskId}
        currentRepo={currentRepo}
      />,
    );

    // The trimmed (filtered) list is shown by default.
    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(filteredList.length);
    });

    // Apply a search term; only the linux job in the filtered list matches.
    const inputElement = getByTitle('Filter the list of runnable jobs');
    await fireEvent.change(inputElement, { target: { value: 'linux' } });
    await fireEvent.keyDown(inputElement, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      const names = queryAllByTestId('fuzzyList').map((job) => job.innerHTML);
      expect(names).toEqual(['test-linux64/opt']);
    });

    // Toggle to the full list: the source switches AND the search term stays
    // applied, so we should now see every linux job from the full list.
    const checkbox = getByRole('checkbox');
    await fireEvent.click(checkbox);

    await waitFor(() => {
      const names = queryAllByTestId('fuzzyList')
        .map((job) => job.innerHTML)
        .sort();
      expect(names).toEqual(
        [
          'test-linux1804-64/opt',
          'test-linux64/debug',
          'test-linux64/opt',
        ].sort(),
      );
    });
  });

  test('Selecting a job marks it and moves it to the Selected Jobs list', async () => {
    const { getByText, queryAllByTestId } = await render(testFuzzyJobFinder);

    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList').length).toBeGreaterThan(0);
    });

    const targetName = 'addon-tps-xpi';
    const addSelect = document.querySelector('#addJobsGroup select');
    const targetOption = queryAllByTestId('fuzzyList').find(
      (option) => option.textContent === targetName,
    );
    targetOption.selected = true;
    await fireEvent.change(addSelect);

    await fireEvent.click(getByText('Add selected'));

    await waitFor(() => {
      // The job is marked as selected in the runnable list...
      const marked = queryAllByTestId('fuzzyList').find(
        (option) => option.textContent === targetName,
      );
      expect(marked.className).toContain('selected');

      // ...and shows up in the Selected Jobs box.
      const removeSelect = document.querySelector('#removeJobsGroup select');
      const selectedNames = Array.from(removeSelect.options).map(
        (option) => option.textContent,
      );
      expect(selectedNames).toContain(targetName);
    });
  });

  test('Caps the number of rendered jobs and shows how many are hidden', async () => {
    // More jobs than the render cap (MAX_RENDERED_JOBS = 500) so we can assert
    // only a slice is mounted while the true total is still reported.
    const bigList = Array.from({ length: 600 }, (_unused, i) => ({
      name: `test-job-${String(i).padStart(4, '0')}`,
      symbol: `j${i}`,
      groupsymbol: '',
    }));

    const { getByText, queryAllByTestId } = await render(
      <FuzzyJobFinder
        isOpen={isOpen}
        toggle={() => {}}
        jobList={bigList}
        filteredJobList={bigList}
        className="fuzzy-modal"
        pushId={id}
        decisionTaskId={decisionTaskId}
        currentRepo={currentRepo}
      />,
    );

    await waitFor(() => {
      // Only the first 500 are turned into <option> nodes...
      expect(queryAllByTestId('fuzzyList')).toHaveLength(500);
      // ...but the notice reflects the full match count.
      expect(
        getByText(/Showing the first 500 of 600 jobs/),
      ).toBeInTheDocument();
    });
  });
});
