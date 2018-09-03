"use strict";

var fs = require('fs');
var path = require('path');
var merge = require('merge-stream');
var dateFormat = require('dateformat');
var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var cleanCss = require('gulp-clean-css');
var rename = require("gulp-rename");
var walk = require('walk');
var argv = require('yargs').argv;
var replace = require('gulp-replace');
var runSequence = require('run-sequence');
var htmlreplace = require('gulp-html-replace');
var secrets = require('./secrets');
var QiniuResourceManager = require("./gulpUploadQiniu");


var now = new Date();
var timeStamp = dateFormat(now, '_yyyymmddHHMMss');

gulp.task('static-compile', function() {
    var projectName = argv.project;

    var projectDir = "./static/" + projectName;
    var publishDir = "./static/release/" + projectName + "/public";

    var jsTask = gulp.src(path.join(projectDir, '/js/**/*.js'))
            .pipe(rename({suffix: timeStamp}))
            .pipe(uglify())
            .pipe(gulp.dest(publishDir));
    
    var cdnImageRoot = secrets.qiniu.staticHost + "/" + projectName + "/images/";
    var cssTask = gulp.src(path.join(projectDir, '/css/**/*.css'))
            .pipe(concat('styles' + timeStamp + '.min.css'))
            .pipe(replace(/url\("(\.\.\/)*images\//g, 'url("' + cdnImageRoot))
            .pipe(replace(/url\('(\.\.\/)*images\//g, "url('" + cdnImageRoot))
            .pipe(cleanCss())
            .pipe(gulp.dest(publishDir));
    
    var fontTask = gulp.src(path.join(projectDir, '/css/fonts/*.*')).pipe(gulp.dest(publishDir + "/fonts"));

    var imageTask = gulp.src(projectDir + "/images/**/*").pipe(gulp.dest(publishDir + "/images"));

    return merge(jsTask, cssTask, fontTask, imageTask)
});


gulp.task('static-resources', function(done) {
    new QiniuResourceManager("static/release/" + argv.project + "/public", argv.project + "/").upload(done)();
});


gulp.task('static-html', function() {
    var projectName = argv.project;

    var projectDir = "./static/" + projectName;
    var publishDir = "./static/release/" + projectName;
    var cdnImageRoot = secrets.qiniu.staticHost + "/" + projectName + "/images/";

    var jsPaths = [];
    walk.walkSync(projectDir + "/js", {
        followLinks: false,
        listeners: {
            file: function (root, fileStats, next) {
                // Add this file to the list of files
                root = root.substr((projectDir + "/js").length);
                var fileName = fileStats.name.substring(0, fileStats.name.lastIndexOf(".")) + timeStamp + fileStats.name.substring(fileStats.name.lastIndexOf("."));
                jsPaths.push(secrets.qiniu.staticHost + "/" + projectName + root + '/' + fileName);
                next();
            }
        }
    });

    return gulp.src(path.join(projectDir, "/*.html"))
        .pipe(htmlreplace({
            css: secrets.qiniu.staticHost + "/" + projectName + "/styles" + timeStamp + ".min.css",
            js: jsPaths
        }))
        .pipe(replace(/url\("(\.\.\/)*images\//g, 'url("' + cdnImageRoot))
        .pipe(replace(/url\('(\.\.\/)*images\//g, "url('" + cdnImageRoot))
        .pipe(replace("src='images/", "src='" + cdnImageRoot))
        .pipe(replace('src="images/', 'src="' + cdnImageRoot))
        .pipe(gulp.dest(publishDir));
});


gulp.task('static-publish', function(done) {
    var projectName = argv.project;
    
    if (!projectName)
       return;
    
    runSequence(
       'static-compile',
       'static-resources',
       'static-html',
       done
    )
});