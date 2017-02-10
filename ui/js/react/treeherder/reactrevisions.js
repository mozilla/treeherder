'use strict';

var moreRevisionsLinkComponent = React.createClass({
    displayName: 'pushlogRevisionComponent',
    propTypes: {
        href: React.PropTypes.string.isRequired
    },
    render() {
        return React.DOM.li(
            null,
            React.DOM.a({
                href: this.props.href,
                'data-ignore-job-clear-on-click': true,
                target: '_blank'
            },
            '\u2026and more',
            React.DOM.i({ className: 'fa fa-external-link-square' })
            )
        );
    }
});
var moreRevisionsLinkComponentFactory = React.createFactory(moreRevisionsLinkComponent);

var revisionItemComponent = React.createClass({
    displayName: 'revisionItemComponent',
    propTypes: {
        revision: React.PropTypes.object.isRequired,
        repo: React.PropTypes.object.isRequired,
        linkifyBugsFilter: React.PropTypes.func.isRequired,
        initialsFilter: React.PropTypes.func.isRequired
    },
    render() {
        var email, name, userTokens, escapedComment, escapedCommentHTML, initialsHTML, tags;

        userTokens = this.props.revision.author.split(/[<>]+/);
        name = userTokens[0];
        if (userTokens.length > 1) email = userTokens[1];
        initialsHTML = { __html: this.props.initialsFilter(name) };

        escapedComment = _.escape(this.props.revision.comments.split('\n')[0]);
        escapedCommentHTML = { __html: this.props.linkifyBugsFilter(escapedComment) };

        tags = "";
        if (escapedComment.search("Backed out") >= 0 ||
            escapedComment.search("Back out") >= 0) {
            tags += "backout ";
        }
        tags = tags.trim();

        return React.DOM.li(
            { className: 'clearfix' },
            React.DOM.span({
                className: 'revision',
                'data-tags': tags
            },
            React.DOM.span(
                { className: 'revision-holder' },
                React.DOM.a({
                    title: `Open revision ${this.props.revision.revision} on ${this.props.repo.url}`,
                    href: this.props.repo.getRevisionHref(this.props.revision.revision),
                    'data-ignore-job-clear-on-click': true
                },
                    this.props.revision.revision.substring(0, 12)
                )),
                React.DOM.span({
                    title: `${name}: ${email}`,
                    dangerouslySetInnerHTML: initialsHTML
                }),
                React.DOM.span(
                    { title: escapedComment },
                    React.DOM.span(
                        { className: 'revision-comment' },
                        React.DOM.em({ dangerouslySetInnerHTML: escapedCommentHTML })
                    )
                )
            )
        );
    }
});
var revisionItemComponentFactory = React.createFactory(revisionItemComponent);

var revisionListComponent = React.createClass({
    displayName: 'revisionListComponent',
    propTypes: {
        resultset: React.PropTypes.object.isRequired,
        repo: React.PropTypes.object.isRequired,
        $injector: React.PropTypes.object.isRequired
    },
    render() {
        var repo = this.props.repo;
        // Possible "...and more" link
        var moreLink = null;

        if (this.props.resultset.revision_count > this.props.resultset.revisions.length) {
            moreLink = moreRevisionsLinkComponentFactory({
                href: this.props.repo.getPushLogHref(this.props.resultset.revision)
            });
        }
        var $injector = this.props.$injector;

        return React.DOM.span(
            { className: 'revision-list col-xs-5' },
            React.DOM.ul(
                { className: 'list-unstyled' },
                this.props.resultset.revisions.map(function(item, i) {
                    return revisionItemComponentFactory({
                        initialsFilter: $injector.get('$filter')('initials'),
                        linkifyBugsFilter: $injector.get('$filter')('linkifyBugs'),
                        revision: item,
                        repo: repo,
                        key: i
                    });
                }),
                moreLink
            )
        );
    }
});

treeherder.directive('revisions', ['reactDirective', '$injector', function (reactDirective, $injector) {
    return reactDirective(revisionListComponent, undefined, {}, {$injector});
}]);
