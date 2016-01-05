// Karma configuration
// Generated on Tue Sep 01 2015 11:00:43 GMT-0600 (CST)
'use strict';
module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha'],

    // List of files / patterns to load in the browser; Karma is smart enough,
    // with the preprocessors, to watch the source files and serve the compiled
    // files.
    files: [
      'jujugui/static/gui/build/modules.js',
      'jujugui/static/gui/src/test/assets/chai.js',

      'jujugui/static/gui/src/test/globalconfig.js',

      'jujugui/static/gui/build/app/assets/javascripts/yui/yui/yui.js',
      'jujugui/static/gui/build/app/assets/javascripts/yui/loader/loader.js',
      'jujugui/static/gui/src/test/utils.js',
      'jujugui/static/gui/build/app/assets/javascripts/d3.js',

      'jujugui/static/gui/build/app/assets/javascripts/bind-function-pollyfill.js',
      'jujugui/static/gui/build/app/assets/javascripts/react-with-addons.js',
      'jujugui/static/gui/build/app/assets/javascripts/react-dom.js',
      'jujugui/static/gui/build/app/assets/javascripts/classnames.js',
      'jujugui/static/gui/build/app/assets/javascripts/clipboard.js',
      'jujugui/static/gui/build/app/assets/javascripts/react-onclickoutside.js',
      'jujugui/static/gui/build/app/assets/javascripts/ReactDnD.min.js',
      'jujugui/static/gui/build/app/assets/javascripts/ReactDnDHTML5Backend.min.js',
      'jujugui/static/gui/build/app/assets/javascripts/diff.js',
      'jujugui/static/gui/build/app/utils/component-test-utils.js',

      'jujugui/static/gui/build/app/utils/jujulib-conversion-utils.js',

      //'jujugui/static/gui/src/test/*.js'
      //'jujugui/static/gui/src/test/test_app_hotkeys.js',
      'jujugui/static/gui/src/test/test_prettify.js'
    ],

    proxies: {
      '/dev/combo': 'http://0.0.0.0:8888/dev/combo'
    },


    // list of files to exclude
    exclude: [
      'jujugui/static/gui/build/app/components/**/*-min.js'
    ],

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['mocha'],

    // web server and port
    hostname: '0.0.0.0',
    port: 6543,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['PhantomJS'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true
  });
};
