

const UserGuideHeader = function UserGuideHeader() {
  return (
    <div className="card-header">
      <h1>Treeherder User Guide</h1>
      <h5>
        Want to contribute?
        <a href="https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree+Management&amp;component=Treeherder">
          {' '}
          File a bug
        </a>{' '}
        /<a href="https://github.com/mozilla/treeherder"> Source </a> /
        <a href="https://wiki.mozilla.org/EngineeringProductivity/Projects/Treeherder#Contributing">
          {' '}
          Contributing
        </a>
      </h5>
      For anything else visit our
      <a href="https://wiki.mozilla.org/EngineeringProductivity/Projects/Treeherder">
        {' '}
        Project Wiki{' '}
      </a>
      or ask us on Element in{' '}
      <a href="https://chat.mozilla.org/#/room/#treeherder:mozilla.org">
        #treeherder
      </a>
    </div>
  );
};

export default UserGuideHeader;
