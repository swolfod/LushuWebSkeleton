"use strict";


var Alt = require('alt');
var _ = require("lodash");
var hosts = require("./lib/hosts");

const isServer = typeof process != "undefined" && !process.browser;
const host = isServer ? hosts.serverRestHost : hosts.restHost;
const secureHost = isServer ? hosts.serverSecureRestHost : hosts.secureRestHost;

var {DataHub} = require("flux/dataHub");

function registerAppProperty(propConfig, container, path, addFunc, getFunc) {
    _.forOwn(propConfig, (v, k) => {
        let objKey = path ? path + "." + k : k;

        if (_.isFunction(v)) {
            if (getFunc(objKey))
                throw new Error(`Object already registered: ${objKey}`);

            addFunc(objKey, v);
            Object.defineProperty(container, k, { get: () => getFunc(objKey) });
        }
        else if (_.isObject(v)) {
            container[k] = container[k] || {};
            registerAppProperty(v, container[k], objKey, addFunc, getFunc);
        }
    });
}


class GenericActions {
    constructor() {
        this.generateActions(
            'warmUpCache',
            'errorOccurred'
        );
    }

    handleApiError(error) {
        this.errorOccurred(error);
    }
}

var dispatching = false;
var actionQueue = [];


class Flux extends Alt {
    dispatch() {
        actionQueue.push(arguments);

        if (dispatching)
           return;

        dispatching = true;

        while (actionQueue.length > 0) {
            let actionArguments = actionQueue.shift();
            super.dispatch(...actionArguments)
        }

        dispatching = false;
    }
}


function createAppClass(appConfig) {
    var {paths, requireSecurePaths, requireTokenPaths} = appConfig.apiPaths;
    var pages = {};
    
    _.each(paths, function(value, key) {
        if (value.indexOf("http") == 0)
            pages[key] = value;
        else if (requireSecurePaths[key] || requireTokenPaths[key])
            pages[key] = secureHost + value;
        else
            pages[key] = host + value;
    });
    
    var apiAccess = {
        paths: pages,
        requireSecurePaths: requireSecurePaths,
        requireTokenPaths: requireTokenPaths
    };

    class Application {
        constructor(options={}) {
            this.req = options.req;
            this.res = options.res;
            this.next = options.next;

            this._alt = new Flux();
            this._alt.application = this;

            this._actions = {};
            this._stores = {};
            this.apis = {};
            this.dataHubs = {};

            let hubStorage = this._alt.createStore(DataHub, "hubStorage");
            hubStorage.configStructures(appConfig.dataStructures);

            this.registerActions({ genericActionCreators: GenericActions });

            this.registerActions({ routerActionCreators: require("router/actionCreators") });
            this.registerActions(appConfig.actions);
            this.registerStores({ routerStore: require("router/store") });

            this.registerStores(appConfig.stores);
            this.registerEntityHubs(appConfig.dataHubs);
            this.registerApis(appConfig.apis);

            this.currentSite = appConfig.siteName;
            this.iconCategory = appConfig.iconCategory;
            
            this.settings = appConfig.settings || {};
        }

        registerActions(actionConfig) {
            if (!actionConfig)
               return;

            let addActions = (name, ActionsClass) => {
                this._alt.addActions(name, ActionsClass, undefined, {
                    app: this
                });
            };

            registerAppProperty(actionConfig, this._actions, "actions", addActions, name => this._alt.getActions(name));
        }

        registerStores(storeConfig) {
            if (!storeConfig)
               return;

            let addStore = (name, StoreModel) => {
                let store = this._alt.createStore(StoreModel, name);
                store.app = this;

                _.forEach(Object.getOwnPropertyNames(StoreModel.prototype), prop => {
                    let propDesc = Object.getOwnPropertyDescriptor(StoreModel.prototype, prop);
                    if (propDesc.get && !(prop in store))
                       Object.defineProperty(store, prop, { get: propDesc.get });
                });
            };

            registerAppProperty(storeConfig, this._stores, "stores", addStore, name => this._alt.getStore(name));
        }

        registerEntityHubs(hubConfig) {
            if (!hubConfig)
               return;

            if (!this._entityHubs)
               this._entityHubs = {};

            let addEntityHub = (name, EntityHub) => {
                this._entityHubs[name] = new EntityHub({
                    app: this
                });
            };

            registerAppProperty(hubConfig, this.dataHubs, "dataHubs", addEntityHub, name => this._entityHubs[name]);
        }

        registerApis(apiConfig) {
            if (!apiConfig)
               return;

            if (!this._apiSources)
               this._apiSources = {};

            let addApi = (name, ApiSource) => {
                this._apiSources[name] = new ApiSource({
                    app: this
                });
            };

            registerAppProperty(apiConfig, this.apis, "apis", addApi, name => this._apiSources[name]);
        }

        get hubStorage() {
            return this._alt.getStore("hubStorage");
        }

        get actions() {
            return this._actions;
        }

        get stores() {
            return this._stores;
        }

        warmUp(transitData) {
            let isServer = typeof process != "undefined" && !process.browser;
            if (isServer) {
                let accesses = appConfig.siteRequireAccess ? appConfig.siteName : null;
                let warmUpPromises = [this.actions.accountActionCreators.getViewerInfo(accesses, transitData)];

                if (appConfig.customWarmUp) {
                    let customWarmUpPromise = appConfig.customWarmUp(this);
                    if (customWarmUpPromise)
                        warmUpPromises.push(customWarmUpPromise);
                }

                return Promise.all(warmUpPromises);
            }
        }

        loggedIn() {
            let userStore = this.stores.userStore;

            if (typeof localStorage != "undefined") {
                let token = localStorage.getItem("userToken");
                let userId = localStorage.getItem("userId");

                if (!token || !userId || userId != userStore.userId)
                   return false;
            }

            return !!userStore.userId && (!appConfig.siteRequireAccess || userStore.siteAccesses.get(appConfig.siteName));
        }

        redirectLogin(options) {
            if (!options)
               options = {};

            let loginUrl = options.loginUrl || "/login";
            let currentUrl = options.transitData ? options.transitData.get("url") : this.stores.routerStore.currentUrl;

            if (_.startsWith(currentUrl, "/login"))
               return;

            loginUrl += "?redirect=" + currentUrl.trim();
            if (options.forceRefresh)
               loginUrl += "&forceRefresh=1";
            this.fluxRouter.replaceWith(loginUrl, {app: this});
        }

        ensureLogin(transitData, loginUrl) {

            if (!this.loggedIn()) {
                this.redirectLogin({
                    transitData: transitData,
                    loginUrl: loginUrl
                });
                return false;
            }

            return true;
        }

        takeSnapshot() {
            return this._alt.takeSnapshot();
        }

        bootstrap(state) {
            return this._alt.bootstrap(state);
        }

        get apiAccess() {
            return apiAccess;
        }
    }

    return Application;
}

module.exports = {
    createAppClass:createAppClass
};
