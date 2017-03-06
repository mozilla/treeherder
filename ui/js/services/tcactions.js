'use strict';

treeherder.factory('actionsRender', function() {
    // Render string given context
    let renderString = (value, context) => {
        return value.replace(/\${([^}]+)}/g, (expr, key) => {
            if (context[key] === undefined) {
                throw new Error('Undefined variable referenced in: ' + expr);
            }
            if (!_.includes(['number', 'string'], typeof(context[key]))) {
                throw new Error('Cannot interpolate variable in: ' + expr);
            }
            return context[key];
        });
    };

    // Regular expression matching a timespan on the form:
    // X days Y hours Z minutes
    const timespanExpression = new RegExp([
        '^(\\s*(-|\\+))?',
        '(\\s*(\\d+)\\s*d(ays?)?)?',
        '(\\s*(\\d+)\\s*h((ours?)|r)?)?',
        '(\\s*(\\d+)\\s*min(utes?)?)?',
        '\\s*$',
    ].join(''), 'i');

    // Render timespan fromNow as JSON timestamp
    let fromNow = (timespan = '', reference = Date.now()) => {
        let m = timespanExpression.exec(timespan);
        if (!m) {
            throw new Error('Invalid timespan expression: ' + timespan);
        }
        let neg = (m[2] === '-' ? - 1 : 1);
        let days = parseInt(m[4] || 0);
        let hours = parseInt(m[7] || 0);
        let minutes = parseInt(m[11] || 0);
        return new Date(
            reference + neg * ((days * 24 + hours) * 60 + minutes) * 60 * 1000,
        ).toJSON();
    };

    // Render JSON template (can later be replaced with jsone)
    let render = (template, context) => _.cloneDeepWith(template, value => {
        if (typeof(value) === 'string') {
            return renderString(value, context);
        }
        if (typeof(value) !== 'object' || value instanceof Array) {
            return undefined; // Return undefined to apply recursively
        }

        // Replace {$eval: 'variable'} with variable
        if (value['$eval']) {
            if (typeof(value['$eval']) !== 'string') {
                throw new Error('$eval cannot carry non-string expression');
            }
            if (context[value['$eval']] === undefined) {
                throw new Error('Undefined variable in $eval: ' + value['$eval']);
            }
            return context[value['$eval']];
        }

        // Replace {$dumps: value} with JSON.stringify(value)
        if (value['$dumps']) {
            return JSON.stringify(render(value['$dumps'], context));
        }

        // Replace {$fromNow: 'timespan'} with a JSON timestamp
        if (value['$fromNow'] !== undefined) {
            let timespan = render(value['$fromNow'], context);
            if (typeof(timespan) !== 'string') {
                throw new Error('$fromNow must be given a timespan as string');
            }
            return fromNow(timespan);
        }

        // Apply string interpolation to keys, and recursively render all values
        return _.reduce(value, (result, value, key) => {
            result[renderString(key, context)] = render(value, context);
            return result;
        }, {});
    });

    return render;
});
