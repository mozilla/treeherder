'use strict';

const MoreRevisionsLink = (props) =>
    <li>
        <a href={props.href}
           data-ignore-job-clear-on-click={true}
           target='_blank'>
            {`\u2026and more`}
            <i className='fa fa-external-link-square' />
        </a>
    </li>;
MoreRevisionsLink.propTypes = {
    href: React.PropTypes.string.isRequired
};

const RevisionItem = (props) => {
    let email, name, userTokens, escapedComment, escapedCommentHTML, initialsHTML, tags;

    userTokens = props.revision.author.split(/[<>]+/);
    name = userTokens[0].trim();
    if (userTokens.length > 1) email = userTokens[1];
    initialsHTML = { __html: props.initialsFilter(name) };

    escapedComment = _.escape(props.revision.comments.split('\n')[0]);
    escapedCommentHTML = { __html: props.linkifyBugsFilter(escapedComment) };

    tags = "";
    if (escapedComment.search("Backed out") >= 0 ||
        escapedComment.search("Back out") >= 0) {
        tags += "backout ";
    }
    tags = tags.trim();

    return <li className="clearfix">
        <span className="revision" data-tags={tags}>
            <span className="revision-holder">
                <a title={`Open revision ${props.revision.revision} on ${props.repo.url}`}
                   href={props.repo.getRevisionHref(props.revision.revision)}
                   data-ignore-job-clear-on-click>
                    {props.revision.revision.substring(0, 12)}
                </a>
                <span title={`${name}: ${email}`}
                      dangerouslySetInnerHTML={initialsHTML} />
                <span title={escapedComment}>
                    <span className='revision-comment'>
                        <em dangerouslySetInnerHTML={escapedCommentHTML} />
                    </span>
                </span>
            </span>
        </span>
    </li>;
};
RevisionItem.propTypes = {
    revision: React.PropTypes.object.isRequired,
    repo: React.PropTypes.object.isRequired,
    linkifyBugsFilter: React.PropTypes.func.isRequired,
    initialsFilter: React.PropTypes.func.isRequired
};

const RevisionList = (props) => {
    const initialsFilter = props.$injector.get('$filter')('initials');
    const linkifyBugsFilter = props.$injector.get('$filter')('linkifyBugs');
    const hasMore = props.resultset.revision_count > props.resultset.revisions.length;
    return (
        <span className='revision-list col-xs-5'>
            <ul className='list-unstyled'>
                {props.resultset.revisions.map((revision, i) =>
                    <RevisionItem
                        initialsFilter={initialsFilter}
                        linkifyBugsFilter={linkifyBugsFilter}
                        revision={revision}
                        repo={props.repo}
                        key={i} />
                )}
                {hasMore &&
                    <MoreRevisionsLink
                        key='more'
                        href={props.repo.getPushLogHref(props.resultset.revision)} />
                }
            </ul>
        </span>
    );
};
RevisionList.propTypes = {
    resultset: React.PropTypes.object.isRequired,
    repo: React.PropTypes.object.isRequired,
    $injector: React.PropTypes.object.isRequired
};

module.exports = {
    RevisionList,
    RevisionItem,
    MoreRevisionsLink
};
