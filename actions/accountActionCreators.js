"use strict";

var BaseActionCreators = require("flux/actionCreators");

class AccountActionCreators extends BaseActionCreators {
    constructor(options) {
        super(options);

        this.generateDirectActions(
        );

        this.generateAsyncActions(
           "getViewerInfo"
        );
    }
    
    getViewerInfo(accesses, transitData) {
        //TODO: get current user info
        return null;
    }
}

module.exports = AccountActionCreators;
