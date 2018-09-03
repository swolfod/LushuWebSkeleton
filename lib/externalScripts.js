"use strict";

var consts = require("./consts");

let host = GLOBAL.production_static_host;

module.exports = {
    babel: host + "/js/babel.min.js"
};