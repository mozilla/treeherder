import React from 'react';

export default function InfraMenu() {
  return (
    <span className="dropdown">
      <button
        id="infraLabel"
        title="Infrastructure status"
        data-toggle="dropdown"
        className="btn btn-view-nav nav-menu-btn dropdown-toggle"
      >Infra</button>
      <ul
        id="infra-dropdown"
        className="dropdown-menu nav-dropdown-menu-right container"
        role="menu"
        aria-labelledby="infraLabel"
      >
        <li role="presentation" className="dropdown-header">Buildbot</li>
        <li>
          <a
            className="dropdown-item"
            href="https://secure.pub.build.mozilla.org/buildapi/pending"
            target="_blank"
            rel="noopener noreferrer"
          >BuildAPI: Pending</a>
        </li>
        <li>
          <a
            className="dropdown-item"
            href="https://secure.pub.build.mozilla.org/buildapi/running"
            target="_blank"
            rel="noopener noreferrer"
          >BuildAPI: Running</a>
        </li>
        <li>
          <a
            className="dropdown-item"
            href="https://www.hostedgraphite.com/da5c920d/86a8384e-d9cf-4208-989b-9538a1a53e4b/grafana2/#/dashboard/db/ec2-dashboard"
            target="_blank"
            rel="noopener noreferrer"
          >EC2 Dashboard</a>
        </li>
        <li>
          <a
            className="dropdown-item"
            href="https://secure.pub.build.mozilla.org/builddata/reports/slave_health/"
            target="_blank"
            rel="noopener noreferrer"
          >Slave Health</a>
        </li>
        <li role="presentation" className="dropdown-divider" />
        <li role="presentation" className="dropdown-header">Other</li>
        <li>
          <a
            className="dropdown-item"
            href="https://mozilla-releng.net/treestatus"
            target="_blank"
            rel="noopener noreferrer"
          >TreeStatus</a>
        </li>
        <li>
          <a
            className="dropdown-item"
            href="https://tools.taskcluster.net/diagnostics"
            target="_blank"
            rel="noopener noreferrer"
          >Taskcluster</a>
        </li>
      </ul>
    </span>
  );
}
