"use strict";

var qiniu = require("qiniu");
var secrets = require("./secrets");
var path = require('path');
var fs = require('fs');
var _ = require('lodash');


var index = 0;
qiniu.conf.ACCESS_KEY = secrets.qiniu.ACCESS_KEY;
qiniu.conf.SECRET_KEY = secrets.qiniu.SECRET_KEY;
var qiniuBucket = secrets.qiniu.staticBucket;

function QiniuResourceManager(baseDir, prefix) {
    console.log("[QiniuResourceManager] re-check #" + (index++));
    var client = new qiniu.rs.Client();
    if (!baseDir)
        baseDir = "public";


    var putPolicy = new qiniu.rs.PutPolicy(qiniuBucket);
    var uptoken = putPolicy.token();

    this.upload = function(done) {
        return function() {
            walk(path.join(__dirname, baseDir), function(err, files) {
                files = files.map(function(item) {
                    return item.substr(path.join(__dirname, baseDir).length + 1);
                });

                batchInfo(files, done);
            });
        }
    };

    function allowToUploadToQiniu(filename) {
        var blackListReg = [/^\.DS_Store$/, /\.map$/];
        var find = false;
        _.forEach(blackListReg, function (reg) {
            find = find || reg.test(filename);
            return !find;
        });

        return !find;
    }

    // 计算文件的eTag，参数为buffer
    function getEtag(buffer){
        // sha1算法
        var sha1 = function(content){
            var crypto = require('crypto');
            var sha1 = crypto.createHash('sha1');
            sha1.update(content);
            return sha1.digest();
        };

        // 以4M为单位分割
        var blockSize = 4*1024*1024;
        var sha1String = [];
        var prefix = 0x16;
        var blockCount = 0;

        var bufferSize = buffer.length;
        blockCount = Math.ceil(bufferSize / blockSize);

        for(var i=0;i<blockCount;i++){
            sha1String.push(sha1(buffer.slice(i*blockSize,(i+1)*blockSize)));
        }

        if(!sha1String.length){
            return 'Fto5o-5ea0sNMlW_75VgGJCv2AcJ';
        }

        var sha1Buffer = Buffer.concat(sha1String,blockCount * 20);

        // 如果大于4M，则对各个块的sha1结果再次sha1
        if(blockCount > 1){
            prefix = 0x96;
            sha1Buffer = sha1(sha1Buffer);
        }

        sha1Buffer = Buffer.concat(
            [new Buffer([prefix]),sha1Buffer],
            sha1Buffer.length + 1
        );

        return sha1Buffer.toString('base64')
            .replace(/\//g,'_').replace(/\+/g,'-');
    }

    var walk = function(dir, done) {
        var results = [];
        fs.readdir(dir, function(err, list) {
            if (err) return done(err);
            var i = 0;
            (function next() {
                var file = list[i++];
                if (!file) return done(null, results);

                file = dir + '/' + file;
                fs.stat(file, function(err, stat) {
                    if (stat && stat.isDirectory()) {
                        walk(file, function(err, res) {
                            results = results.concat(res);
                            next();
                        });
                    } else {
                        results.push(file);
                        next();
                    }
                });
            })();
        });
    };

    function isFileHashChanged(filename, hash) {
        return getEtag(fs.readFileSync(path.join(__dirname, baseDir, filename))) != hash;
    }

    function batchInfo(files, done) {
        files = files.filter(allowToUploadToQiniu);
        if (files.length == 0) {
            if (done) done();
            return;
        }

        var pathes = files.map(function(key) {
            if (prefix)
               key = prefix + key;
            
            return new qiniu.rs.EntryPath(qiniuBucket, key);
        });

        client.batchStat(pathes, function(err, ret) {
            if (!err) {
                var needRemove = [];
                var needUpload = [];
                for (var i in ret) {
                    if (ret[i].code === 200) {
                        if (isFileHashChanged(files[i], ret[i].data.hash)) {
                            needRemove.push(files[i]);
                            needUpload.push(files[i]);
                        } else {
                            console.log("[NotChanged] >", files[i]);
                        }
                    } else {
                        needUpload.push(files[i]);
                    }
                }

                batchDelete(needRemove, done, batchUpload.bind(null, needUpload, done));
            } else {
                console.log("QINIU ERROR: ", err);
                if (done) done(err);
                // http://developer.qiniu.com/docs/v6/api/reference/codes.html
            }
        });
    }

    function batchDelete(keys, done, callback) {
        console.log("[DeleteOnQiniu] >", keys)
        if (!keys || keys.length == 0) {
            if (callback) callback();
            return;
        }

        keys = keys.map(function(key) {
            if (prefix)
               key = prefix + key;
            
            return new qiniu.rs.EntryPath(qiniuBucket, key);
        })

        client.batchDelete(keys, function(err, ret) {
            if (!err) {
                if (callback) callback();
            } else {
                console.log(err);
                if (done) done(err);
            }
        });
    }

    function batchUpload(keys, callback) {
        console.log("[UploadToQiniu] >", keys.length, "files in queue")
        if (!keys || keys.length == 0) {
            if (callback) callback();
            return;
        }

        var promises = keys.filter(allowToUploadToQiniu).map(function(file) {
            var key = file;
            if (prefix)
               key = prefix + key;
            
            return uploadFile(key, uptoken, path.join(__dirname, baseDir, file));
        });

        Promise.all(promises)
            .then(function(results) {
                if (callback) callback();
            }).catch(function(err) {
                console.log(err)
                if (callback) callback(err);
            });
    }

    function uploadFile(key, uptoken, localFilePath) {
        return new Promise(function(resolve, reject) {
            var extra = new qiniu.io.PutExtra();
            qiniu.io.putFile(uptoken, key, localFilePath, extra, function(err, ret) {
                if(!err) {
                    console.log("[UploadToQiniu]", ret.key, ret.hash);
                    resolve(ret);
                } else {
                    if (key.indexOf("website_client") == 0)
                        fs.unlinkSync(localFilePath);
                    // 上传失败， 处理返回代码
                    reject(err);
                    // http://developer.qiniu.com/docs/v6/api/reference/codes.html
                }
            });
        });
    }
}

module.exports = QiniuResourceManager;