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

if (app.get('env') === 'production') {
app.use(logger('combined', {
        skip: function (req, res) {
            return res.statusCode < 400
        },
        stream: process.stderr
    }));
} else {
    app.use(logger('dev'));
}


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(device.capture());
app.use(express.static(path.join(__dirname, '..', 'public')));


const Router = require('../router');
const routerMiddleware = require('../router/express_middleware');
const applicationCreator = require("../application");


const appConfigList = [
   require("config0"), require("config1"), require("config2"), require("config3"), require("config4"),
   require("config5"), require("config6"), require("config7"), require("config8"), require("config9"),
];

const configList = _.map(require("config"), (configInfo, index) => {
    return {
        configInfo: configInfo,
        config: appConfigList[index]
    };
});

let clientGenericCss = "style.css";
if (process.env.NODE_ENV == 'production') {
    glob("public/stylesheets/style*.css", function (er, allStyleSheets) {
        allStyleSheets = allStyleSheets.sort();
        clientGenericCss = allStyleSheets[allStyleSheets.length - 1];

        let dirIndex = clientGenericCss.lastIndexOf("/");
        if (dirIndex >= 0)
            clientGenericCss = clientGenericCss.slice(dirIndex + 1);
    });
}


for (let i = 0; i < configList.length; i++) {
    let configInfo = configList[i].configInfo;
    let config = configList[i].config;
    configInfo.clientScript = "{0}.js".format(configInfo.clientJsPrefix);
    configInfo.clientCss = "{0}.css".format(configInfo.clientCssPrefix);
    let customGenericCss = configInfo.clientGenricCss ? "{0}.css".format(configInfo.clientGenricCss.prefix) : null;
    let appName = configInfo.appName;

    if (process.env.NODE_ENV == 'production') {
        glob("public/{0}*.js".format(configInfo.clientJsPrefix), function (er, allScripts) {
            allScripts = allScripts.sort();
            configInfo.clientScript = allScripts[allScripts.length - 1];
    
            let dirIndex = configInfo.clientScript.lastIndexOf("/");
            if (dirIndex >= 0)
                configInfo.clientScript = configInfo.clientScript.slice(dirIndex + 1);
        });
    
        glob("public/stylesheets/{0}*.css".format(configInfo.clientCssPrefix), function (er, allStyleSheets) {
            allStyleSheets = allStyleSheets.sort();
            if (!allStyleSheets.length) {
                console.error(configInfo);
            }
            else {
                configInfo.clientCss = allStyleSheets[allStyleSheets.length - 1];
                let dirIndex = configInfo.clientCss.lastIndexOf("/");
                if (dirIndex >= 0)
                    configInfo.clientCss = configInfo.clientCss.slice(dirIndex + 1);
            }
        });

        if (customGenericCss) {
            glob("public/stylesheets/{0}*.css".format(configInfo.clientGenricCss.prefix), function (er, allStyleSheets) {
                allStyleSheets = allStyleSheets.sort();
                customGenericCss = allStyleSheets[allStyleSheets.length - 1];
        
                let dirIndex = customGenericCss.lastIndexOf("/");
                if (dirIndex >= 0)
                    customGenericCss = customGenericCss.slice(dirIndex + 1);
            });
        }
    }

    let ApplicationClass = applicationCreator.createAppClass(config);

    let router = new Router(config.routes, ApplicationClass, {
        strict: false,
        loginUrl: config.loginUrl || "/login",
        defaultTitle: config.defaultTitle,
        defaultDesc: config.defaultDesc,
        defaultLocals: function(req) {
            let locals = {};

            const chineseIp = isChineseIp(req.connection.remoteAddress);
            const ieOld = isIeOld(req);
    
            GLOBAL.google_map_host = chineseIp ? "//ditu.google.cn" : "//maps.googleapis.com";
            GLOBAL.google_api_key = secrets.google.API_KEY;
            locals.googleMapDomain = GLOBAL.google_map_host;
            locals.googleApiKey = GLOBAL.google_api_key;
            locals.language = chineseIp ? "zh-CN" : "en";
            locals.clientScript = configInfo.clientScript;
            locals.clientCss = configInfo.clientCss;
            locals.appName = appName;
            locals.customGenericCss = customGenericCss;
            locals.clientGenericCss = clientGenericCss;
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

    let configInfo = configList[0].configInfo;
    let clientCss = configInfo.clientCss || "{0}.css".format(configInfo.clientCssPrefix);

    res.render('error', {
        code: code,
        message: code == 404 ? '页面不存在' : '页面发生错误',
        errorStack: app.get('env') === 'development' ? err.stack : '',
        staticHost: GLOBAL.production_static_host,
        clientCss: clientCss,
        clientGenericCss: clientGenericCss
    });
});

module.exports = app;
