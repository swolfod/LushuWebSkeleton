"use strict";

require('babel-polyfill');

var React = require('react');
var Router = require('../router');
var applicationCreator = require('../application');

require("../lib/extensions");

window.React = React; // For React Developer Tools

var config = require("config");

if (process.env.NODE_ENV !== 'test') {
    var Application = applicationCreator.createAppClass(config);
    
    var router = new Router(config.routes, Application, {
            html5history: true,
            strict: false,
            rootId: "webMain",
            loginUrl: config.loginUrl || "/login",
            defaultTitle: config.defaultTitle,
            defaultDesc: config.defaultDesc,
            rendered: (options) => {
                
            }
        });

    router.start();

    router.on("transitionFailed", function(pageUrl, error) {
        console.error(error);
    });
}
