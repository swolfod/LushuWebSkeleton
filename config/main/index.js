"use strict";

const _ = require("lodash");
const baseConfig = require("../baseConfig");


let config = {
    routes: require("./routes"),
    stores: require('./stores'),
    actions: require("./actions"),
    apis: require("./dataApis"),
    
    customWarmUp(app, transitData) {
    }
};

module.exports = _.extend(config, baseConfig);