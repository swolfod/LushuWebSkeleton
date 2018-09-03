"use strict";


var paths = {
    // login: "/auth/login/"
};

var requireSecurePaths = {
    // login: true
};

var requireTokenPaths = {
   // changePassword: ["put"]
};

module.exports = {
    paths: paths,
    requireSecurePaths: requireSecurePaths,
    requireTokenPaths: requireTokenPaths
};
