"use strict";

const hosts = require("lib/hosts");
const express = require('express');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const device = require('express-device');
const glob = require("glob");
const _ = require("lodash");
const geoip = require('geoip-lite');
const secrets = require("secrets");

require('node-jsx').install({extension: '.jsx'});
require("../lib/extensions");

GLOBAL.server_rest_host = hosts.serverRestHost;
GLOBAL.server_secure_rest_host = hosts.serverSecureRestHost;
GLOBAL.production_static_host = "production" == process.env.NODE_ENV ? hosts.qiniu.staticHost : "";

const fs = require('fs');
const path = require('path');
require('app-module-path').addPath(path.resolve('.'));


function isChineseIp(ip) {
    let geoInfo = geoip.lookup(ip);
    return !geoInfo || !geoInfo.country || geoInfo.country.toLowerCase() == "cn";
}

function isIeOld (req) {
    let myNav = req.headers['user-agent'].toLowerCase();
    if(myNav.indexOf('msie') != -1 && parseInt(myNav.split('msie')[1]) < 10) {
        return true;
    } else {
        return false;
    }
}

const app = express();
// view engine setup
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(device.capture());
app.use(express.static(path.join(__dirname, '..', 'public')));


var Router = require('../router');
var routerMiddleware = require('../router/express_middleware');
var applicationCreator = require("../application");


var appConfigList = [
   require("config0"), require("config1"), require("config2"), require("config3"), require("config4"),
   require("config5"), require("config6"), require("config7"), require("config8"), require("config9"),
];

var configList = _.map(require("config"), (configInfo, index) => {
    return {
        configInfo: configInfo,
        config: appConfigList[index]
    };
});

let clientGeneralCss = "style.css";
if (process.env.NODE_ENV == 'production') {
    glob("public/stylesheets/style*.css", function (er, allStyleSheets) {
        allStyleSheets = allStyleSheets.sort();
        clientGeneralCss = allStyleSheets[allStyleSheets.length - 1];

        let dirIndex = clientGeneralCss.lastIndexOf("/");
        if (dirIndex >= 0)
            clientGeneralCss = clientGeneralCss.slice(dirIndex + 1);
    });
}


for (let i = 0; i < configList.length; i++) {
    let configInfo = configList[i].configInfo;
    let config = configList[i].config;
    let clientScript = "{0}.js".format(configInfo.clientJsPrefix);
    let clientCss = "{0}.css".format(configInfo.clientCssPrefix);
    if (process.env.NODE_ENV == 'production') {
        glob("public/{0}*.js".format(configInfo.clientJsPrefix), function (er, allScripts) {
            allScripts = allScripts.sort();
            clientScript = allScripts[allScripts.length - 1];
    
            let dirIndex = clientScript.lastIndexOf("/");
            if (dirIndex >= 0)
                clientScript = clientScript.slice(dirIndex + 1);
        });
    
        glob("public/stylesheets/{0}*.css".format(configInfo.clientCssPrefix), function (er, allStyleSheets) {
            allStyleSheets = allStyleSheets.sort();
            clientCss = allStyleSheets[allStyleSheets.length - 1];
    
            let dirIndex = clientCss.lastIndexOf("/");
            if (dirIndex >= 0)
                clientCss = clientCss.slice(dirIndex + 1);
        });
    }

    let ApplicationClass = applicationCreator.createAppClass(config);
    
    let router = new Router(config.routes, ApplicationClass, {
        strict: false,
        loginUrl: config.loginUrl || "/login",
        defaultTitle: config.defaultTitle,
        defaultDesc: config.defaultDesc,
        defaultLocals: function(req) {
            let locals = {};

            var chineseIp = isChineseIp(req.connection.remoteAddress);
            var ieOld = isIeOld(req);
    
            GLOBAL.google_map_host = chineseIp ? "//ditu.google.cn" : "//maps.googleapis.com";
            GLOBAL.google_api_key = secrets.google.API_KEY;
            locals.googleMapDomain = GLOBAL.google_map_host;
            locals.googleApiKey = GLOBAL.google_api_key;
            locals.language = chineseIp ? "zh-CN" : "en";
            locals.clientScript = clientScript;
            locals.clientCss = clientCss;
            locals.clientGeneralCss = clientGeneralCss;
            locals.customizedMobile = req.device.type == "phone";
            locals.allowLogTrace = ["example.com"].indexOf(req.hostname) > -1;
            locals.gaKey = config.gaKey;
            locals.staticHost = GLOBAL.production_static_host;
            locals.userId = req.cookies['X_USER_ID'];
            locals.isIeOld = ieOld;
    
            return locals;
        }
    });
    
    app.use(routerMiddleware({
        router: router
    }));
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers
app.use(function(err, req, res, next) {
    let code = err.status || err.errorCode || 500;
    res.status(code);
    res.render('error', {
        code: code,
        message: code == 404 ? '页面不存在' : '页面发生错误',
        errorStack: app.get('env') === 'development' ? err.stack : '',
        staticHost: GLOBAL.production_static_host
    });
});

module.exports = app;
