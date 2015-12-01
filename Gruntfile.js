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
            perf: {
                src:'ui/perf.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
        },

        usemin:{ html:['dist/index.html', 'dist/userguide.html', 'dist/logviewer.html',
                       'dist/perf.html'] },

        'cache-busting': {
            indexjs: {
                replace: ['dist/**/*.html'],
                replacement: 'index.min.js',
                file: 'dist/js/index.min.js',
                cleanup: true //Remove previously generated hashed files.
            },
            logviewerjs: {
                replace: ['dist/**/*.html'],
                replacement: 'logviewer.min.js',
                file: 'dist/js/logviewer.min.js',
                cleanup: true
            },
            perfjs: {
                replace: ['dist/**/*.html'],
                replacement: 'perf.min.js',
                file: 'dist/js/perf.min.js',
                cleanup: true
            },
            userguidejs: {
                replace: ['dist/**/*.html'],
                replacement: 'userguide.min.js',
                file: 'dist/js/userguide.min.js',
                cleanup: true
            },
            indexcss: {
                replace: ['dist/**/*.html'],
                replacement: 'index.min.css',
                file: 'dist/css/index.min.css',
                cleanup: true
            },
            logviewercss: {
                replace: ['dist/**/*.html'],
                replacement: 'logviewer.min.css',
                file: 'dist/css/logviewer.min.css',
                cleanup: true
            },
            perfcss: {
                replace: ['dist/**/*.html'],
                replacement: 'perf.min.css',
                file: 'dist/css/perf.min.css',
                cleanup: true
            },
            userguidecss: {
                replace: ['dist/**/*.html'],
                replacement: 'userguide.min.css',
                file: 'dist/css/userguide.min.css',
                cleanup: true
            }
        },

        copy:{

            main: {
                files: [
                    { src:'ui/robots.txt', dest:'dist/robots.txt', nonull: true },
                    { src:'ui/index.html', dest:'dist/index.html', nonull: true },
                    { src:'ui/userguide.html', dest:'dist/userguide.html', nonull: true },
                    { src:'ui/logviewer.html', dest:'dist/logviewer.html', nonull: true },
                    { src:'ui/perf.html', dest:'dist/perf.html', nonull: true }
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
        uglify:{
            options:{
                report: 'min',
                // Cannot use mangle, it will break angularjs's dependency
                // injection
                mangle: false
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
            perf: {
                cwd: 'ui',
                src: ['partials/main/persona_buttons.html',
                      'partials/main/thLogoutMenu.html',
                      'partials/perf/*.html'],
                dest: 'dist/js/perf.min.js',
                options: {
                    usemin: 'dist/js/perf.min.js',
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
        'useminPrepare',
        'concat',
        'cssmin',
        'uglify',
        'usemin',
        'ngtemplates',
        'cache-busting',
        'clean:tmp'
        ]);

    grunt.registerTask('checkjs', [
        'eslint'
        ]);
};
