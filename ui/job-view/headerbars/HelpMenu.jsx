import React from 'react';

export default function HelpMenu() {
  return (
    <span id="help-menu" className="dropdown">
      <button
        id="helpLabel"
        title="Treeherder help"
        data-toggle="dropdown"
        className="btn btn-view-nav nav-help-btn dropdown-toggle"
      >
        <span className="fa fa-question-circle lightgray nav-help-icon" />
      </button>
      <ul
        className="dropdown-menu nav-dropdown-menu-right icon-menu"
        role="menu"
        aria-labelledby="helpLabel"
      >
        <li>
          <a
            href="/userguide.html"
            target="_blank"
            rel="noopener noreferrer"
            className="dropdown-item"
          >
            <span className="fa fa-question-circle midgray" />
            User Guide</a>
        </li>
        <li>
          <a
            href="https://treeherder.readthedocs.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="dropdown-item"
          >
            <span className="fa fa-file-code-o midgray" />
            Development Documentation</a>
        </li>
        <li>
          <a
            href="/docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="dropdown-item"
          >
            <span className="fa fa-code midgray" />
            API Reference</a>
        </li>
        <li>
          <a
            href="https://wiki.mozilla.org/EngineeringProductivity/Projects/Treeherder"
            target="_blank"
            rel="noopener noreferrer"
            className="dropdown-item"
          >
            <span className="fa fa-file-word-o midgray" />
            Project Wiki</a>
        </li>
        <li>
          <a
            href="https://groups.google.com/forum/#!forum/mozilla.tools.treeherder"
            target="_blank"
            rel="noopener noreferrer"
            className="dropdown-item"
          >
            <span className="fa fa-envelope-o midgray" />
            Mailing List</a>
        </li>
        <li>
          <a
            href="https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree+Management&component=Treeherder"
            target="_blank"
            rel="noopener noreferrer"
            className="dropdown-item"
          >
            <span className="fa fa-bug midgray" />
            Report a Bug</a>
        </li>
        <li>
          <a
            href="https://github.com/mozilla/treeherder"
            target="_blank"
            rel="noopener noreferrer"
            className="dropdown-item"
          >
            <span className="fa fa-github midgray" />
            Source</a>
        </li>
        <li>
          <a
            href="https://whatsdeployed.io/?owner=mozilla&amp;repo=treeherder&amp;name[]=Stage&amp;url[]=https://treeherder.allizom.org/revision.txt&amp;name[]=Prod&amp;url[]=https://treeherder.mozilla.org/revision.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="dropdown-item"
          >
            <span className="fa fa-question midgray" />
            What&apos;s Deployed?</a>
        </li>
      </ul>
    </span>
  );
}
