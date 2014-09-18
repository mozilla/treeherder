'use strict';

module.exports = function(grunt) {

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        clean: ['dist/'],

        useminPrepare:{
            index: {
                src:'webapp/app/index.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
            help: {
                src:'webapp/app/help.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
            logviewer: {
                src:'webapp/app/logviewer.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            }
        },

        usemin:{ html:['dist/index.html', 'dist/help.html', 'dist/logviewer.html'] },

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
            helpcss: {
                replace: ['dist/**/*.html'],
                replacement: 'help.min.css',
                file: 'dist/css/help.min.css',
                cleanup: true
            }
        },

        copy:{

            main: {
                files: [
                    { src:'webapp/app/index.html', dest:'dist/index.html', nonull: true },
                    { src:'webapp/app/help.html', dest:'dist/help.html', nonull: true },
                    { src:'webapp/app/logviewer.html', dest:'dist/logviewer.html', nonull: true }
                ]
            },
            // Copy img dir
            img:{
                expand: true,
                src: 'webapp/app/img/*',
                dest: 'dist/img/',
                nonull: true,
                flatten: true
                },
            // Copy html in partials
            partials:{
                expand: true,
                src: 'webapp/app/partials/*',
                dest: 'dist/partials/',
                nonull: true,
                flatten: true
                },
            // Copy fonts
            fonts:{
                expand: true,
                src: 'webapp/app/fonts/*',
                dest: 'dist/fonts/',
                nonull: true,
                flatten: true
                },
            // Copy html in plugins, make sure not to flatten
            // to retain the directory structure for the html
            // and make paths relative with cwd definition.
            plugins:{
                expand: true,
                cwd: 'webapp/app/plugins/',
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
            app: {
                cwd: 'app',
                src: 'partials/**.html',
                dest: 'templates.js'
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-usemin');
    grunt.loadNpmTasks('grunt-cache-busting');
    grunt.loadNpmTasks('grunt-angular-templates');

    // Default tasks
    grunt.registerTask('build', [
        'clean',
        'copy:main',
        'copy:img',
        'copy:partials',
        'copy:fonts',
        'copy:plugins',
        'useminPrepare',
        'concat',
        'cssmin',
        'uglify',
        'usemin',
        'cache-busting',
        'ngtemplates'
        ]);


};
