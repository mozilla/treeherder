import { useEffect } from 'react';

import { personName, rememberPerson } from './cache';
import { LIST, PUSH, SHORT_REVISION_LENGTH } from './constants';
import {
  JobCard,
  LintCard,
  Section,
  SeenBefore,
  TestCard,
} from './FailureCards';
import {
  ago,
  authorName,
  pushTitle,
  pushUrl,
  retriggerableJobs,
} from './helpers';
import Hero from './Hero';
import Nav from './Nav';
import { chooseFullView } from './phone';
import usePushData from './usePushData';
import { sortFailures, verdict } from './verdict';

const PushDetail = ({ repo, author, theme, revision }) => {
  const { push, health, jobs, error, counts, progress, eta } = usePushData(
    repo,
    revision,
  );
  const { yours, parentToo, known, builds, lint, seenBefore } = sortFailures(
    health,
    jobs,
  );

  const said =
    health &&
    progress &&
    verdict({ yours, parentToo, builds, lint, progress, eta, seenBefore });

  const failedJobs = push ? retriggerableJobs(jobs || [], push.id) : [];
  const testsFailed =
    !!jobs &&
    jobs.some(
      (j) => j.tier <= 2 && j.result === 'testfailed' && j.platform !== 'lint',
    );

  const pushedBy = push?.author;
  const pushedByName = push ? authorName(push) : null;
  useEffect(() => rememberPerson(pushedBy, pushedByName), [pushedBy, pushedByName]);

  const commits = push
    ? push.revisions.filter((r) => !/^Fuzzy query|^try:/i.test(r.comments))
    : [];

  return (
    <>
      <Nav
        repo={repo}
        author={author}
        theme={theme}
        back={pushUrl({ repo, author })}
        backLabel={LIST.title(personName(author))}
        full={`/jobs?repo=${repo}&revision=${revision}`}
        filter={`revision: ${revision.slice(0, SHORT_REVISION_LENGTH)}`}
      />

      {error && <p className="sv-sub">{error}</p>}

      {push && (
        <header className="sv-push-head sv-rise">
          <span className="sv-eyebrow">
            {ago(push.push_timestamp)} · {authorName(push) || push.author}
          </span>
          {pushTitle(push) !== revision.slice(0, SHORT_REVISION_LENGTH) && (
            <p className="sv-push-title">{pushTitle(push)}</p>
          )}
        </header>
      )}

      <Hero
        said={said}
        counts={counts}
        health={health}
        progress={progress}
        eta={eta}
        error={error}
        push={push}
        repo={repo}
        failedJobs={failedJobs}
        testsFailed={testsFailed}
      />

      {health && (
        <div className="sv-rise">
          <Section title={PUSH.sections.brokenHere} count={yours.length}>
            {yours.map((g) => (
              <TestCard key={g.testName} group={g} jobs={health.jobs} repo={repo} revision={revision} />
            ))}
          </Section>
          <Section title={PUSH.sections.builds} count={builds.length}>
            {builds.map((job) => (
              <JobCard key={job.id} job={job} repo={repo} revision={revision} />
            ))}
          </Section>
          <Section title={PUSH.sections.lint} count={lint.length}>
            <LintCard jobs={lint} repo={repo} revision={revision} />
          </Section>
          <Section title={PUSH.sections.alsoOnParent} count={parentToo.length} quiet>
            {parentToo.map((g) => (
              <TestCard key={g.testName} group={g} jobs={health.jobs} repo={repo} revision={revision} />
            ))}
          </Section>
          <Section title={PUSH.sections.seenBefore} count={seenBefore.length} quiet>
            <SeenBefore jobs={seenBefore} repo={repo} revision={revision} />
          </Section>
          <Section title={PUSH.sections.knownIntermittents} count={known.length} quiet>
            {known.map((g) => (
              <TestCard key={g.testName} group={g} jobs={health.jobs} repo={repo} revision={revision} />
            ))}
          </Section>
        </div>
      )}

      {push && (
        <footer className="sv-footer">
          {commits.length > 0 && (
            <details className="sv-commits">
              <summary>
                {PUSH.commits(commits.length)}
              </summary>
              <ul>
                {commits.map((r) => (
                  <li key={r.revision}>{r.comments.split('\n')[0]}</li>
                ))}
              </ul>
            </details>
          )}
          <a
            className="sv-link"
            href={`/jobs?repo=${repo}&revision=${revision}`}
            onClick={chooseFullView}
          >
            {PUSH.everyJob}
          </a>
        </footer>
      )}
    </>
  );
};

export default PushDetail;
