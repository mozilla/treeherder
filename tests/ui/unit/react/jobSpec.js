'use strict';
var compile = require('ngreact-test-utils').compile;

describe('Plaftorm td react component', () => {
    beforeEach(angular.mock.module('treeherder'));
    beforeEach(angular.mock.module('react'));

    it('renders the platform name, with a matching title', inject((thPlatformName) => {
        var scope = {
            id: 'mozilla-inbound154816linux32opt',
            name: thPlatformName('linux32'),
            option: 'opt'
        };
        var name = `${scope.name} ${scope.option}`;
        var component = compile('<jobplatformtd id="id" name="name" option="option" />', scope);
        var span = component.el[0].querySelector('td.platform span');
        expect(span).toBeDefined();
        expect(span.title).toEqual(name);
        expect(span.textContent).toEqual(name);
    }));
});
