"use strict";


const gulp = require('gulp');
const watch = require('gulp-watch');
const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const DeepMerge = require('deep-merge');
const nodemon = require('nodemon');
const sass = require('gulp-sass');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const cleanCss = require('gulp-clean-css');
const dateFormat = require('dateformat');
const runSequence = require('run-sequence');
const hosts = require('./lib/hosts');
const _ = require('lodash');
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCssAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const ExtraneousFileCleanupPlugin = require('webpack-extraneous-file-cleanup-plugin');
const QiniuResourceManager = require("./gulpUploadQiniu");

const devMode = process.env.NODE_ENV !== 'production';

require('./gulpStatic');


var deepmerge = DeepMerge(function(target, source, key) {
    if(target instanceof Array) {
        return [].concat(target, source);
    }
    return source;
});

// generic

var babel_plugins = ["transform-decorators-legacy"];
if(!devMode){
  babel_plugins = ["transform-decorators-legacy","transform-remove-debugger","transform-remove-console"];
}

var defaultConfig = {
    mode: devMode ? "development" : "production",
    resolve: {
        modules: [
            path.resolve('.'),
            "node_modules"
        ],
        mainFields: ['browserify', 'browser', 'module', 'main'],
        extensions: ['.js', '.jsx'],
        alias: {
          controls: path.join(__dirname,'components/controls/'),
          pages: path.join(__dirname,'components/pages/'),
          modals: path.join(__dirname,'components/modals/'),
          widgets: path.join(__dirname,'components/widgets/'),
        }
    }
};

var now = new Date();
var timeStamp = devMode ? "" : dateFormat(now, '_yyyymmddHHMMss');

function config(overrides) {
    let resultConfig = deepmerge(defaultConfig, overrides || {});

    if(devMode) {
        resultConfig.devtool = 'source-map';

        if (!resultConfig.plugins)
           resultConfig.plugins = [];
        
        resultConfig.plugins.push(
           new webpack.LoaderOptionsPlugin({
               debug: true
           })
        );
    }

    return resultConfig;
}

// frontend

function makeFrontendConfig(appConfig) {
    let configList = require("./" + appConfig);

    return _.map(configList, configInfo => {
        let frontendConfig = {
            entry: [
                './client'
            ],
            target: 'web',
            output: {
                path: path.join(__dirname, 'public'),
                filename: configInfo.clientJsPrefix + timeStamp + '.js'
            },
            module: {
                rules: [
                    {
                        test: /\.jsx?$/,
                        exclude: /node_modules/,
                        use: {
                            loader: 'babel-loader',
                            query: {
                                presets: ['react', 'es2015', 'stage-0'],
                                plugins: babel_plugins,
                            }
                        }
                    },
                    {
                        test: /\.(sa|sc|c)ss$/,
                        use: [
                            MiniCssExtractPlugin.loader,
                            {
                                loader: 'css-loader',
                                options: {
                                    modules: true,
                                    sourceMap: devMode,
                                    localIdentName: '[name]__[local]___[hash:base64:5]'
                                }
                            },
                            'postcss-loader',
                            'sass-loader',
                        ],
                    }
                ]
            },
            plugins: [
                new MiniCssExtractPlugin({
                    filename: "stylesheets/" + configInfo.clientCssPrefix + timeStamp + ".css"
                })
            ],
            resolve: {
                alias: {
                    config: appConfig + "/"+ configInfo.appName
                }
            }
        };

        if(!devMode) {
            frontendConfig.plugins = frontendConfig.plugins.concat([
                new webpack.DefinePlugin({'process.env.NODE_ENV': JSON.stringify('production')}),
                new UglifyJsPlugin({
                    cache: true,
                    parallel: true
                }),
                new OptimizeCssAssetsPlugin()
            ]);
        }

        return config(frontendConfig);
    });
}

var frontendConfigList = makeFrontendConfig("config");


// backend

var nodeModules = {};
fs.readdirSync('node_modules').filter(function(x) {
    return ['.bin'].indexOf(x) === -1;
}).forEach(function(mod) {
    nodeModules[mod] = 'commonjs ' + mod;
});

function makeBackendConfig(outFileName, appConfig) {
    let configList = require("./" + appConfig);
    let alias = {
        config: appConfig
    };
    
    for (let i = 0; i < 10; i++)  {
        let configInfo = i < configList.length ? configList[i] : configList[0];
        alias["config" + i] = appConfig + "/"+ configInfo.appName
    }

    return {
        entry: [
            './bin/www'
        ],
        target: 'node',
        output: {
            path: path.join(__dirname, 'build'),
            filename: outFileName + '.js'
        },
        node: {
            __dirname: true,
            __filename: true
        },
        externals: nodeModules,
        module: {
            rules: [
                {
                    test: /\.jsx?$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        query: {
                            presets: ['react', 'es2015', 'stage-0'],
                            plugins: babel_plugins,
                        }
                    }
                },
                {
                    test: /\.(sa|sc|c)ss$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                            options: {
                                url: false,
                                modules: true,
                                sourceMap: devMode,
                                localIdentName: '[name]__[local]___[hash:base64:5]'
                            }
                        },
                        'postcss-loader',
                        'sass-loader',
                    ],
                }
            ]
        },
        plugins: [
            new webpack.IgnorePlugin(/\.(css|less)$/),
            new webpack.BannerPlugin({
                banner: 'require("source-map-support").install();',
                raw: true,
                entryOnly: false
            }),
            new MiniCssExtractPlugin(),
            new ExtraneousFileCleanupPlugin({extensions: ['.css']})
        ],
        resolve: {
            alias: alias
        }
    };
}

var backendConfig = makeBackendConfig("website_server", "config");

if(!devMode) {
    backendConfig.plugins.push(new UglifyJsPlugin({
        cache: true,
        parallel: true
    }));
}

backendConfig = config(backendConfig);

// tasks

function onBuild(done) {
    return function(err, stats) {
        if(err) {
            console.log('Error', err);
        }
        else {
            console.log(stats.toString("errors-only"));
        }

        if(done) {
            done();
        }
    }
}

gulp.task('frontend-build', gulp.series(function(done) {
    webpack(frontendConfigList).run(onBuild(done));
}));

gulp.task('frontend-watch', gulp.series(function() {
    webpack(frontendConfigList).watch(300, onBuild());
}));

gulp.task('backend-build', gulp.series(function(done) {
    webpack(backendConfig).run(onBuild(done));
}));

function backendWatchMethod(config) {
    return function(done) {
        var firedDone = false;
        webpack(config).watch(300, function(err, stats) {
            if(!firedDone) {
                firedDone = true;
                onBuild(done)(err, stats);
            }
            else
                onBuild()(err, stats);

            nodemon.restart();
        });
    }
}


gulp.task('backend-watch', gulp.series(backendWatchMethod(backendConfig)));

// Compile Our Scss
gulp.task('scss', gulp.series(function() {
    var gulpJob = gulp.src(['./styles/*.scss', './styles/controls/*.scss']);
    if(devMode)
        gulpJob = gulpJob.pipe(sourcemaps.init());

    gulpJob = gulpJob.pipe(sass())
        .on('error', function (error) {
            console.error(error);
            this.emit('end');
        })
        .pipe(concat('style' + timeStamp + '.css'))
        .pipe(cleanCss());

    if(devMode)
        gulpJob = gulpJob.pipe(sourcemaps.write('.'));

    gulpJob = gulpJob.pipe(gulp.dest('public/stylesheets'))
        .on('error', function (error) {
            console.error(error);
            this.emit('end');
        });

    return gulpJob;
}));

gulp.task('images', gulp.series(function() {
    return gulp.src("./styles/images/**/*").pipe(gulp.dest("public/images"));
}));

gulp.task('images-watch', gulp.series(function() {
    gulp.watch('styles/images/*.*', gulp.series('images'));
}));

gulp.task('libs', gulp.series(function() {
    //Add this line if you need to remotely import components
    // var libsJob = gulp.src([
    //     './lib/babel.min.js'
    // ], {allowEmpty: true});

    // return libsJob.pipe(gulp.dest("public/js")).pipe(uglify());
}));

gulp.task('robots', gulp.series(function() {
    var libsJob = gulp.src([
        './lib/robots.txt'
    ]);

    return libsJob.pipe(gulp.dest("public"));
}));

gulp.task('styles-watch', gulp.series(function() {
    gulp.watch('./styles/*.scss', gulp.series('scss'));
}));



function runServerMethod(scriptFile, port, debugPort) {
    if (!port)
       port = '3000';

    if (!debugPort)
       debugPort = '41398';

    return function() {
        var restarted = 0;
        nodemon({
            script: path.join(__dirname, scriptFile),
            verbose: true,
            ignore: ['*'],
            watch: ['foo/'],
            ext: 'noop',
            env: { 'PORT': port },
            nodeArgs: ['--inspect=' + debugPort]
        }).on('restart', function() {
            restarted++;
            console.log('#' + restarted + ' restarted!');
            console.log(new Date(Date.now()));
        });
    };
}

var buildDepends = ['frontend-build', 'backend-build', 'images', 'scss', 'libs', 'robots'];
var watchDepends = ['frontend-watch', 'backend-watch', 'styles-watch', 'images-watch'];
var runDepends = ['frontend-watch', 'backend-watch', 'scss', 'styles-watch', 'images', 'images-watch', 'libs', 'robots'];
if(!devMode) {
    gulp.task('resources', gulp.series(function(done) {
        new QiniuResourceManager().upload(done)();
    }));

    gulp.task('build', gulp.series(function(done) {
        runSequence(
           _.without(buildDepends, 'backend-build'),
           'resources',
           'backend-build',
           done
        )
    }));

    gulp.task('resources-watch', gulp.series('resources', function() {
        var timer = 0;
        /*
         * gulp.watch will not react to the added and deleted events,
         * I have to add gulp-watch to replace it
         */
        watch(['public/*.*', 'public/**/*'], function(event) {
            // console.log('1 >> File ' + event.path + ' changed(added, deleted, changed), running tasks...');
            clearTimeout(timer);
            timer = setTimeout(function() {
                new QiniuResourceManager().upload()();
            }, 500);
        });
    }));

    gulp.task('watch', gulp.series(function(done) {
        runSequence(
           _.without(watchDepends, 'backend-watch'),
           'resources-watch',
           'backend-watch',
           done
        )
    }));

    gulp.task('run', gulp.series(function(done) {
        runSequence(
           _.without(runDepends, 'backend-watch'),
           'resources-watch',
           'backend-watch',
           runServerMethod('build/website_server', hosts.port, '41498')
        )
    }));
} else {
    gulp.task('build', gulp.parallel(buildDepends));

    gulp.task('watch', gulp.parallel(watchDepends));

    gulp.task('run', gulp.parallel(runDepends, runServerMethod('build/website_server', hosts.port, '41498')));
}
