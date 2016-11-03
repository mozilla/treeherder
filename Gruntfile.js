'use strict';

module.exports = function(grunt) {

    var packageTypes = ['dependencies'];
    if (!grunt.option('production')) {
        // Also load tasks from packages listed under `devDependencies`, so
        // long as a `--production` option hasn't been passed to Grunt.
        packageTypes.push('devDependencies');
    }
    require('load-grunt-tasks')(grunt, {scope: packageTypes});

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        clean: {
            dist: ['dist/'],
            tmp: ['.tmp/']
        },

        htmlangular: {
            options: {
                reportpath: null
            },
            files: {
                src: ['ui/*.html'],
                nonull: true
            },
        },

        useminPrepare:{
            index: {
                src:'ui/index.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
            userguide: {
                src:'ui/userguide.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
            logviewer: {
                src:'ui/logviewer.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
            failureviewer: {
                src:'ui/failureviewer.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
            perf: {
                src:'ui/perf.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
            admin: {
                src:'ui/admin.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
        },

        usemin:{ html:['dist/*.html'] },

        'cacheBust': {
            options: {
                assets: ['js/*', 'css/*'],
                baseDir: 'dist/'
            },
            src: ['dist/**/*.html']
        },

        copy:{

            main: {
                files: [
                    { src:'contribute.json', dest:'dist/contribute.json', nonull: true },
                    { cwd: 'ui/', src: '*', dest:'dist/', expand: true, filter: 'isFile', nonull: true },
                ]
            },
            // Copy img dir
            img:{
                expand: true,
                src: 'ui/img/*',
                dest: 'dist/img/',
                nonull: true,
                flatten: true
                },
            // Copy html in partials
            partials:{
                expand: true,
                src: 'ui/partials/*',
                dest: 'dist/partials/',
                nonull: true,
                flatten: true
                },
            // Copy fonts
            fonts:{
                expand: true,
                src: 'ui/vendor/fonts/*',
                dest: 'dist/fonts/',
                nonull: true,
                flatten: true
                },
            // Copy vendor files that don't work with grouped minification
            vendor:{
                files: [
                    { src: 'ui/vendor/ngReact/ngReact.min.js',
                      dest: 'dist/vendor/ngReact/ngReact.min.js',
                      nonull: true
                    },
                    { cwd: 'ui/vendor/react',
                      src: '*',
                      dest: 'dist/vendor/react',
                      nonull: true,
                      expand: true
                    },
                ]
            },
            // Copy html in plugins, make sure not to flatten
            // to retain the directory structure for the html
            // and make paths relative with cwd definition.
            plugins:{
                expand: true,
                cwd: 'ui/plugins/',
                src: '**/*.html',
                dest: 'dist/plugins/',
                nonull: true,
                flatten: false
                }
        },
        babel: {
            options: {
                compact: true,
                sourceMap: false,
                presets: ['babel-preset-es2015']
            },
            dist: {
                files: {
                    '.tmp/concat/js/index.min.js': '.tmp/concat/js/index.min.js',
                    '.tmp/concat/js/logviewer.min.js': '.tmp/concat/js/logviewer.min.js',
                    '.tmp/concat/js/perf.min.js': '.tmp/concat/js/perf.min.js',
                    '.tmp/concat/js/admin.min.js': '.tmp/concat/js/admin.min.js'
                }
            }
        },
        uglify:{
            options:{
                report: 'min',
                // Cannot use mangle, it will break angularjs's dependency
                // injection
                mangle: false,
                beautify: true
            }
        },
        ngtemplates: {
            treeherder: {
                cwd: 'ui',
                src: ['partials/main/*.html', 'plugins/**/*.html'],
                dest: 'dist/js/index.min.js',
                options: {
                    usemin: 'dist/js/index.min.js',
                    append: true,
                    htmlmin: {
                        collapseBooleanAttributes:      true,
                        collapseWhitespace:             true,
                        conservativeCollapse:           true,
                        removeAttributeQuotes:          true,
                        removeComments:                 true,
                        removeEmptyAttributes:          true,
                        removeRedundantAttributes:      true,
                        removeScriptTypeAttributes:     true,
                        removeStyleLinkTypeAttributes:  true,
                        keepClosingSlash: true
                    }
                }
            },
            logviewer: {
                cwd: 'ui',
                src: ['partials/main/thNotificationsBox.html', 'partials/logviewer/*.html'],
                dest: 'dist/js/logviewer.min.js',
                options: {
                    usemin: 'dist/js/logviewer.min.js',
                    append: true,
                    htmlmin: {
                        collapseBooleanAttributes:      true,
                        collapseWhitespace:             true,
                        conservativeCollapse:           true,
                        removeAttributeQuotes:          true,
                        removeComments:                 true,
                        removeEmptyAttributes:          true,
                        removeRedundantAttributes:      true,
                        removeScriptTypeAttributes:     true,
                        removeStyleLinkTypeAttributes:  true,
                        keepClosingSlash: true
                    }
                }
            },
            failureviewer: {
                cwd: 'ui',
                src: ['partials/main/thNotificationsBox.html'],
                dest: 'dist/js/failureviewer.min.js',
                options: {
                    usemin: 'dist/js/failureviewer.min.js',
                    append: true,
                    htmlmin: {
                        collapseBooleanAttributes:      true,
                        collapseWhitespace:             true,
                        conservativeCollapse:           true,
                        removeAttributeQuotes:          true,
                        removeComments:                 true,
                        removeEmptyAttributes:          true,
                        removeRedundantAttributes:      true,
                        removeScriptTypeAttributes:     true,
                        removeStyleLinkTypeAttributes:  true,
                        keepClosingSlash: true
                    }
                }
            },
            perf: {
                cwd: 'ui',
                src: ['partials/main/thLogoutMenu.html',
                      'partials/perf/*.html',
                      'partials/perf/*.tmpl'],
                dest: 'dist/js/perf.min.js',
                options: {
                    usemin: 'dist/js/perf.min.js',
                    append: true,
                    htmlmin: {
                        // intentionally NOT collapsing whitespace here,
                        // so perf regression templates are handled correctly
                        collapseBooleanAttributes:      true,
                        removeAttributeQuotes:          true,
                        removeComments:                 true,
                        removeEmptyAttributes:          true,
                        removeRedundantAttributes:      true,
                        removeScriptTypeAttributes:     true,
                        removeStyleLinkTypeAttributes:  true,
                        keepClosingSlash: true
                    }
                }
            },
            admin: {
                cwd: 'ui',
                src: ['partials/main/thLogoutMenu.html',
                      'partials/main/thHelpMenu.html',
                      'partials/main/thNotificationsBox.html',
                      'partials/main/thMultiSelect.html',
                      'partials/admin/*.html'],
                dest: 'dist/js/admin.min.js',
                options: {
                    usemin: 'dist/js/admin.min.js',
                    append: true,
                    htmlmin: {
                        collapseBooleanAttributes:      true,
                        collapseWhitespace:             true,
                        conservativeCollapse:           true,
                        removeAttributeQuotes:          true,
                        removeComments:                 true,
                        removeEmptyAttributes:          true,
                        removeRedundantAttributes:      true,
                        removeScriptTypeAttributes:     true,
                        removeStyleLinkTypeAttributes:  true,
                        keepClosingSlash:               true
                    }
                }
            },
            userguide: {
                cwd: 'ui',
                src: 'partials/main/thShortcutTable.html',
                dest: 'dist/js/userguide.min.js',
                options: {
                    usemin: 'dist/js/userguide.min.js',
                    append: true,
                    htmlmin: {
                        collapseBooleanAttributes:      true,
                        collapseWhitespace:             true,
                        conservativeCollapse:           true,
                        removeAttributeQuotes:          true,
                        removeComments:                 true,
                        removeEmptyAttributes:          true,
                        removeRedundantAttributes:      true,
                        removeScriptTypeAttributes:     true,
                        removeStyleLinkTypeAttributes:  true,
                        keepClosingSlash: true
                    }
                }
            }
        },
        eslint: {
            options: {
                config: '.eslintrc'
            },
            target: ['ui/']
        }
    });

    // Default tasks
    grunt.registerTask('build', [
        'clean:dist',
        'copy:main',
        'copy:img',
        'copy:fonts',
        'copy:vendor',
        'useminPrepare',
        'concat',
        'cssmin',
        'babel',
        'uglify',
        'usemin',
        'ngtemplates',
        'cacheBust',
        'clean:tmp'
    ]);

    grunt.registerTask('checkjs', [
        'eslint'
        ]);
};
