/* eslint-disable max-classes-per-file */

import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { Badge, Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBug,
  faMinus,
  faUnlink,
  faStar,
} from '@fortawesome/free-solid-svg-icons';

import { store, actions } from '../redux/store';
import { thPlatformMap } from '../../helpers/constants';
import { getBugUrl } from '../../helpers/url';

import LogViewer from './LogViewer';

const mapStateToProps = ({ groups }) => ({
  expanded: groups.expanded,
  revision: groups.push.revision,
  options: groups.options,
  repo: groups.push.repository.name,
  bugSuggestions: groups.bugSuggestions,
});

class BugCountComponent extends React.Component {
  onClick = () => {
    store.dispatch(
      actions.groups.fetchBugsSingleTest(
        this.props.test,
        this.props.bugSuggestions,
      ),
    );
    store.dispatch(
      actions.groups.toggleExpanded(
        Boolean(!this.props.expanded[this.props.testName]),
        this.props.testName,
        this.props.expanded || {},
      ),
    );
  };

  render() {
    return (
      <td className="bug-count">
        <div role="button" tabIndex={0} onClick={this.onClick}>
          {// TODO: Clean this up
          // eslint-disable-next-line no-nested-ternary
          this.props.test.bugs === undefined ? (
            <FontAwesomeIcon
              icon={faMinus}
              title="Click to expand and fetch bugs"
            />
          ) : Object.keys(this.props.test.bugs).length > 0 ? (
            Object.keys(this.props.test.bugs).length
          ) : (
            <Badge
              size="sm"
              color="danger"
              style={{ fontWeight: 400, fontSize: '.8rem', margin: '0 .5rem' }}
            >
              0
            </Badge>
          )}
        </div>
      </td>
    );
  }
}

BugCountComponent.propTypes = {
  testName: PropTypes.string.isRequired,
  expanded: PropTypes.object.isRequired,
  test: PropTypes.object.isRequired,
  bugSuggestions: PropTypes.object.isRequired,
};

// TODO: Move `Platform` into its own file.
class Platform extends React.Component {
  getIcon(failureClassification) {
    switch (failureClassification) {
      case 'not classified':
        return;
      case 'intermittent':
        return (
          <FontAwesomeIcon
            icon={faBug}
            size="sm"
            className="classified classified-intermittent"
            title="Bug"
          />
        );
      case 'infra':
        return (
          <FontAwesomeIcon
            icon={faUnlink}
            size="sm"
            className="classified classified-infra"
            title="Infra"
          />
        );
      default:
        return (
          <FontAwesomeIcon
            icon={faStar}
            size="sm"
            className="classified"
            title="Classified"
          />
        );
    }
  }

  render() {
    return (
      <span
        className="platform badge"
        title={`${this.props.job.jobType.symbol} ${this.props.job.failureClassification.name}`}
      >
        <Link
          to={`/#/jobs?repo=${this.props.repo}&revision=${this.props.revision}&selectedJob=${this.props.job.jobId}`}
          target="_blank"
          rel="noopener"
        >
          {this.getIcon(this.props.job.failureClassification.name)}
          {this.props.platform} {this.props.option}
        </Link>
      </span>
    );
  }
}

Platform.propTypes = {
  option: PropTypes.string.isRequired,
  job: PropTypes.object.isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  platform: PropTypes.string.isRequired,
};

// TODO: Move `TestComponent` into its own file.
class TestComponent extends React.Component {
  onClick = () => {
    store.dispatch(
      actions.groups.fetchBugsSingleTest(
        this.props.test,
        this.props.bugSuggestions,
      ),
    );
    store.dispatch(
      actions.groups.toggleExpanded(
        Boolean(!this.props.expanded[this.props.name]),
        this.props.name,
        this.props.expanded || {},
      ),
    );
  };

  renderExpanded() {
    return (
      <div className="test-detail-list">
        <div className="bottom-separator">
          <strong>Test Group: {this.props.test.group}</strong>
        </div>
        {this.props.test.jobs.map(job => (
          <div key={job.id}>
            <Platform
              job={job}
              platform={thPlatformMap[job.buildPlatform.platform]}
              option={this.props.options[job.optionCollectionHash]}
              repo={this.props.repo}
              revision={this.props.revision}
            />
            <LogViewer job={job} repo={this.props.repo} />
            {job.tier > 1 && (
              <span className="tier badge">Tier-{job.tier}</span>
            )}
            <div>
              {job.failureLines.map(failureLine => (
                <span key={failureLine.id}>
                  {failureLine && (
                    <div>
                      <span>
                        {failureLine.action.toUpperCase() === 'TEST_RESULT' && (
                          <div className="failure-line">
                            {failureLine.subtest && (
                              <span>{failureLine.subtest}</span>
                            )}
                            {failureLine.message &&
                              failureLine.message.includes('Stack trace:') && (
                                <div>
                                  <pre>{failureLine.message}</pre>
                                </div>
                              )}
                            {failureLine.message &&
                              !failureLine.message.includes('Stack trace:') && (
                                <span> - {failureLine.message}</span>
                              )}
                          </div>
                        )}
                        {failureLine.action.toUpperCase() === 'LOG' && (
                          <div className="failure-line">
                            LOG {failureLine.level} | {failureLine.message}
                          </div>
                        )}
                        {failureLine.action.toUpperCase() === 'CRASH' && (
                          <div className="failure-line">
                            <strong>CRASH</strong> | application crashed [
                            {failureLine.signature}]
                          </div>
                        )}
                      </span>
                    </div>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
        {this.props.test.bugs && (
          <div>
            <div className="bottom-separator">
              <strong>Bugs:</strong>
            </div>
            {Object.values(this.props.test.bugs).map(bug => (
              <div key={bug.id}>
                <a
                  href={getBugUrl(bug.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {bug.id} - {bug.summary}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  render() {
    return (
      <td className="test-table">
        <Button className="test" onClick={this.onClick}>
          {this.props.name}
        </Button>
        <span className="platform-list">
          {this.props.test.jobs.map(job => (
            <Platform
              job={job}
              key={job.id}
              platform={thPlatformMap[job.buildPlatform.platform]}
              option={this.props.options[job.optionCollectionHash]}
              repo={this.props.repo}
              revision={this.props.revision}
            />
          ))}
        </span>
        {this.props.expanded[this.props.name] && this.renderExpanded()}
      </td>
    );
  }
}

TestComponent.propTypes = {
  name: PropTypes.string.isRequired,
  test: PropTypes.object.isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  options: PropTypes.object.isRequired,
  bugSuggestions: PropTypes.object.isRequired,
  expanded: PropTypes.object.isRequired,
};

export const Test = connect(mapStateToProps)(TestComponent);
export const BugCount = connect(mapStateToProps)(BugCountComponent);
