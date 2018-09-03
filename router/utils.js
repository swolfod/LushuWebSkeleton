"use strict";

const _ = require("lodash");

function extendRoutes(routes, root, config, subRoutes) {
    _.forEach(subRoutes, (subConfig, path) => {
        let routeConfig = _.cloneDeep(config);

        if (subConfig.paramNames) {
            routeConfig.paramNames = (routeConfig.paramNames || []).concat(subConfig.paramNames);
        }

        if (subConfig.pathParams)
           routeConfig.pathParams = _.extend(routeConfig.pathParams || {}, subConfig.pathParams);
        
        if (subConfig.defaultParams)
           routeConfig.defaultParams = _.extend(routeConfig.defaultParams || {}, subConfig.defaultParams);

        routeConfig.requireLogin = routeConfig.requireLogin || subConfig.requireLogin;
        routeConfig.recursionPaths = _.cloneDeep(subConfig.recursionPaths);
        routeConfig.handler = subConfig.handler;

        routes[root + path] = routeConfig
    });
}

module.exports = {
    extendRoutes
};