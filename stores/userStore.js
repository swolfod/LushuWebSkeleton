"use strict";


const _ = require("lodash");
const Immutable = require("immutable");
var BaseStore = require("flux/store");

const STORE_TYPE = "user";

const STATE_USER_INFO = "userInfo";
const STATE_SITE_ACCESSES = "siteAccesses";


class UserStore extends BaseStore {
    constructor(options) {
        super(STORE_TYPE, options);

        let accountActionCreators = this.app.actions.accountActionCreators;

        this.handlers = {
            gotViewerInfo: accountActionCreators.getViewerInfoDone
        };
    }
    
    gotViewerInfo(viewer, accesses) {
        if (viewer){
            let currentAccesses = this.state.get(STATE_SITE_ACCESSES) || Immutable.Map();
            if (accesses)
               currentAccesses = currentAccesses.merge(accesses);

            this.state = this.state.set(STATE_USER_INFO, Immutable.fromJS(viewer)).set(STATE_SITE_ACCESSES, currentAccesses);
        }
        else{
            this.state = this.state.delete(STATE_USER_INFO).delete(STATE_SITE_ACCESSES);
        }
    }

    get userInfo() {
        return this.state.get(STATE_USER_INFO);
    }

    get userId() {
        let userInfo = this.userInfo;
        return userInfo ? userInfo.get("id") : null;
    }

    get siteAccesses() {
        return this.state.get(STATE_SITE_ACCESSES) || Immutable.Map();
    }
}

module.exports = UserStore;
