"use strict";

var React = require("react");
var ReactDOM = require('react-dom');
var { renderToString } = require('react-dom/server');
var director = require('director');
var _ = require('lodash');
var Immutable = require("immutable");
var isServer = typeof process != "undefined" && !process.browser;
var DirectorRouter = isServer ? director.http.Router : director.Router;
var Qs = require("qs");
var RouterRoot = require("./components/routerRoot.jsx");
var serialize = require('serialize-javascript');

class Router {
    constructor(routes, appClass, options) {
        if (!routes)
            throw new Error("Must provide routes.");

        this.directorRouter = new DirectorRouter(this.parseRoutes(routes));

        this.appClass = appClass;
        this.options = options || {};
        this._events = [];

        this.directorRouter.configure({
            html5history: this.options.html5history,
            run_handler_in_init: false,
            convert_hash_in_init: false,
            recurse: false,
            strict: this.options.strict
        });
    }

    /**
     * Capture routes as object that can be passed to Director.
     */
    parseRoutes(routes) {
        let result = {};
        let handlerViewTable = {};

        let count = 0;
        _.forOwn(routes, (routeConfig, pattern) => {
            count++;
            if (_.isFunction(routeConfig) || !routeConfig.handler)
                routeConfig = {
                    handler: routeConfig
                };

            let paramNames = routeConfig.paramNames;
            let handlerConfig = routeConfig.handler;
            if (_.isFunction(handlerConfig) || !handlerConfig.type)
                handlerConfig = {
                    type: "page",
                    view: handlerConfig
                };

            let viewId = "{0}_{1}".format(pattern, handlerConfig.key ? handlerConfig.key : count);
            handlerViewTable[viewId] = handlerConfig.view;
            handlerConfig = {
                key: handlerConfig.key,
                type: handlerConfig.type,
                view: viewId,
                loginUrl: routeConfig.loginUrl,
                requireLogin: routeConfig.requireLogin,
                recursionPaths: routeConfig.recursionPaths
            };

            // Server routes are an object, not a function. We just use `get`.
            if (isServer) {
                result[pattern] = {
                    get: this.getRouteHandler(handlerConfig, paramNames, routeConfig.defaultParams)
                };
            } else {
                result[pattern] = {
                    on: this.getRouteHandler(handlerConfig, paramNames, routeConfig.defaultParams)
                };
            }

            let that = this;
            function parseRecursionPaths(recursionPaths, pattern, paramNames, params) {
                if (!recursionPaths)
                    return;

                _.forOwn(recursionPaths, (pathConfig, path) => {
                    let pathParamNames = paramNames || [];
                    if (pathConfig.paramNames)
                        pathParamNames = pathParamNames.concat(pathConfig.paramNames);

                    let pathParams = _.cloneDeep(params || {});
                    if (pathConfig.pathParams)
                        _.assign(pathParams, pathConfig.pathParams);

                    if (isServer) {
                        result[pattern + path] = {
                            get: that.getRouteHandler(handlerConfig, pathParamNames, pathParams)
                        };
                    } else {
                        result[pattern + path] = {
                            on: that.getRouteHandler(handlerConfig, pathParamNames, pathParams)
                        };
                    }

                    parseRecursionPaths(pathConfig.recursionPaths, pattern + path, pathParamNames, pathParams);
                });
            }

            parseRecursionPaths(handlerConfig.recursionPaths, pattern, paramNames, routeConfig.defaultParams);
        }, this);

        this.handlerViewTable = handlerViewTable;

        return result;
    }

    getHandlerView(viewId) {
        return this.handlerViewTable && this.handlerViewTable[viewId];
    }

    getRouteHandler(handlerConfig, paramNames, defaultParams) {
        var router = this;

        return function() {
            let navOptions = router.navOptions || {};
            router.navOptions = undefined;

            if (router.initing)
                return;

            let resetPos = navOptions.scrollToTop;

            var transitId = _.uniqueId("transit_");

            var app = router.app || router.createApp(this.req, this.res, this.next);

            let pageUrl = isServer ? this.req.originalUrl : window.location.href;
            if (pageUrl.indexOf("//") >= 0)
                pageUrl = pageUrl.substr(pageUrl.indexOf("//") + 2);

            if (pageUrl.indexOf("/") > 0)
                pageUrl = pageUrl.substr(pageUrl.indexOf("/"));

            if (pageUrl.indexOf("/") < 0)
                pageUrl = "/";

            var that = this;
            function transitFailed(error) {
                console.error("Transition Failed: ", error, error.stack);
                if (that.next)
                    that.next(error);
                else {
                    router.trigger("transitionFailed", [pageUrl, error]);
                    app.actions.routerActionCreators.transitionFailed(transitId, error);
                }
            }

            let currentUrl = app.stores.routerStore.currentUrl;
            if (navOptions.restoreState && currentUrl && currentUrl == pageUrl)
                return;

            let currentHandlers = app.stores.routerStore.state.get("routeHandler");
            let topModal = null;
            if (currentHandlers) {
                let modals = currentHandlers.get("modals");
                if (modals && modals.size > 0)
                    topModal = modals.last();
            }

            if ((!navOptions.fromApp || handlerConfig.type != "modal" || navOptions.popBack || (topModal && topModal.get("key") == handlerConfig.key))
               && pageUrl != currentUrl && router.trigger("transitStarting", [pageUrl]) === false)
            {
                this.setRoute(currentUrl, {restoreState: true});
                return;
            }

            try {
                var params = Array.prototype.slice.call(arguments);

                var transitData = {};
                if (defaultParams)
                    _.assign(transitData, defaultParams);

                transitData.url = pageUrl;

                if (params && params.length && paramNames && paramNames.length) {
                    for (var i = 0; i < paramNames.length; i++)
                        transitData[paramNames[i]] = params[i];
                }

                transitData.urlParams = params;
                transitData.query = _.clone(Qs.parse(transitData.url.split("?")[1]));
                if (resetPos)
                    transitData.resetPos = true;

                transitData = Immutable.fromJS(transitData);

                app.actions.routerActionCreators.transitionStart(transitId, handlerConfig, transitData, navOptions);

                var warmUps = [];
                var handlerView = router.getHandlerView(handlerConfig.view);
                if (handlerView) {
                    let doWarmUp = true;
                    if (!navOptions.forceRefresh) {
                        if (!navOptions.fromApp) {
                            if (app.stores.routerStore.handlerAvailable(handlerConfig, transitData))
                                doWarmUp = false;
                            else if (handlerView.dataAvailable && handlerView.dataAvailable(app, transitData)) {
                                doWarmUp = false;
                                transitData.scrollToLeftPos = !resetPos;
                            }
                        }
                        else if (navOptions.popBack && app.stores.routerStore.handlerAvailable(handlerConfig, transitData)) {
                            doWarmUp = false;
                        }
                    }

                    if (doWarmUp && handlerView.warmUpTransition) {
                        warmUps.push(handlerView.warmUpTransition.bind(handlerView));
                    }
                }

                let appWarmUp = app.warmUp ? app.warmUp(transitData) : null;
                Promise.resolve(appWarmUp).then(function() {

                    if (handlerConfig.requireLogin && (handlerConfig.loginUrl || navOptions.unauthorizedUrl || router.options.loginUrl)){
                        if (!app.ensureLogin(transitData, handlerConfig.loginUrl ||navOptions.unauthorizedUrl || router.options.loginUrl)) {
                            return;
                        }
                    }

                    let warmUpPromise = app.actions.routerActionCreators.warmUpTransition(transitId, warmUps, transitData);

                    if (warmUpPromise) {
                        warmUpPromise.catch(transitFailed).then(() => {
                            let title = router.getContent(handlerView, 'pageTitle', app, transitData);
                            app.actions.routerActionCreators.setPageTitle(transitId, router.buildPageTitle(title));

                            let description = router.getContent(handlerView, 'pageDescription', app, transitData);
                            app.actions.routerActionCreators.setPageDescription(transitId, router.buildPageDescription(description));

                            app.actions.routerActionCreators.readyToRender(transitId);
                        }).catch(transitFailed);
                    }
                }).catch(transitFailed);
            } catch (err) {
                transitFailed(err);
            }
        };
    }


    /**
     * Client-side handler to start router.
     */
    start() {
        /**
        * Tell Director to use HTML5 History API (pushState).
        */
        this.app = this.createApp();

      /**
       * Intercept any links that don't have 'data-pass-thru' and route using
       * pushState.
       */
      /*document.addEventListener('click', function(e) {
        var el = e.target;
        var dataset = el && el.dataset;
        if (el && el.nodeName === 'A' && (
            dataset.passThru == null || dataset.passThru === 'false'
          )) {
          this.directorRouter.setRoute(el.attributes.href.value);
          e.preventDefault();
        }
      }.bind(this), false);*/

        /**
        * Kick off routing.
        */
        this.initing = true;
        this.directorRouter.notfound = () => {
            if (typeof window != "undefined" && this.app.stores.routerStore.currentUrl) {
                let path = window.location.pathname;
                let prevPath = this.app.stores.routerStore.currentUrl;
                window.history.back();
                window.history.pushState({path: prevPath}, "", prevPath);
                window.location.href = path;
            }
        };
        this.directorRouter.init();

        //note IE8 is being counted as 'modern' because it has the hashchange event
        if ('onhashchange' in window && (document.documentMode === undefined || document.documentMode > 7))
          this.mode = 'modern';

        this.initing = false;

        this.app.bootstrap(window.__APP_STATE);
        var reactApp = <RouterRoot app={this.app} />;

        let rootEle;
        if (this.options.rootId)
            rootEle = document.getElementById(this.options.rootId);

        ReactDOM.render(reactApp, rootEle || document.body);

        if (_.isFunction(this.options.rendered)) {
            this.options.rendered({ app: this.app });
        }
    }

    buildPageTitle(title) {
        let defaultTitle = this.options.defaultTitle || "";
        if (title) {
            return title;// + " － " + defaultTitle;
        } else {
            return defaultTitle;
        }
    }

    buildPageDescription(desc) {
        let defaultDesc = this.options.defaultDesc || "";
        if (desc) {
            return desc + " － " + defaultDesc;
        } else {
            return defaultDesc;
        }
    }

    getContent(handlerView, propName, app, transitData) {
        let result = null;

        if (propName && handlerView[propName]) {
            if (typeof handlerView[propName] == "string") {
                result = handlerView[propName];
            } else if (_.isFunction(handlerView[propName])) {
                result = handlerView[propName](app, transitData);
            }
        }

        return result && result.replace(/[\n\r]/g, ' ');
    }

    createApp(req, res, next) {
        var app = new this.appClass({
            req: req,
            res: res,
            next: next
        });

        app.actions.routerActionCreators.configureRouter(this.options);
        app.fluxRouter = this;

        if (isServer) {
            var options = this.options;

            app.stores.routerStore.listen(function(state) {
                if (!state.get("inTransit") || !state.get("readyToRender"))
                    return;

                try {
                    var htmlBody = renderToString(<RouterRoot app={app} />);
                    var htmlState = `<script>window.__APP_STATE = ${ serialize(app.takeSnapshot()) };</script>`;

                    var locals = null;
                    if (options.defaultLocals)
                        locals = options.defaultLocals(req);
                    if (!locals)
                        locals = {};

                    locals[options.body || 'body'] = htmlBody.trim();
                    locals[options.state || 'state'] = htmlState.trim();
                    locals['pageTitle'] = app.stores.routerStore.pageTitle;
                    locals['pageDescription'] = app.stores.routerStore.pageDescription;

                    res.render(options.indexView || 'index', locals);

                    if (_.isFunction(options.rendered)) {
                        options.rendered(_.extend({
                            app: app
                        }, locals));
                    }
                }
                catch(error) {
                    if (_.isFunction(options.error)) {
                        options.error(req, res, next, error);
                    } else {
                        console.error('Failed to render ' + req.url, error, error.stack);
                        if (next) {
                            next(error);
                        }
                        else
                            res.sendStatus(500).end();
                    }
                }
            });
        }

        return app;
    }

    setRoute(route, options) {

        if (isServer) {
            if (options.app) {
                if (options.app.res)
                    options.app.res.redirect(route);

                options.app.actions.routerActionCreators.cancelTransit();
            }
            return;
        }

        if (!options)
            options = {};
        options.fromApp = true;

        this.navOptions = options;
        let onChangeFunc = this.directorRouter.history === true ? window.onpopstate : window.onhashchange;
        if (onChangeFunc) {
            this.directorRouter.setRoute(route);
        }
        else {
            //wait for page load, because of the chrome bug
            // http://code.google.com/p/chromium/issues/detail?id=63040
            setTimeout(() => {this.directorRouter.setRoute(route)}, 501);
        }
    }

    replaceWith(path, options) {
        if (isServer) {
            this.setRoute(path, options);
            return;
        }

        if (this.isCrossDomain(path)) {
            window.location.replace(path);
            return;
        }

        if (this.mode == 'modern') {
            this.navOptions = _.assign({replaceState: true}, options);

            let onChangeFunc = this.directorRouter.history === true ? window.onpopstate : window.onhashchange;
            if (onChangeFunc) {
                window.history.replaceState({path: path}, '', path);
                onChangeFunc(path);
            } else {
                setTimeout(() => {
                    window.history.replaceState({path: path}, '', path);
                    let onChangeFunc = this.directorRouter.history === true ? window.onpopstate : window.onhashchange;
                    onChangeFunc(path);
                }, 501);
            }
        }
        else {
            window.location.replace(path);
        }
    }

    isCrossDomain(path) {
        return /^https?:\/\/.+/i.test(path) && window.location.host !== new URL(path).host;
    }

    reload() {
        if (isServer)
            return;

        this.replaceWith(window.location.href, {forceRefresh: true});
    }

    closeModal(options) {
        if (!options)
            options = {};

        if (_.isString(options)) {
            options = {defaultUrl: options};
        }

        if (options.closeCnt === undefined)
            options.closeCnt = 1;

        let currentHandlers = this.app.stores.routerStore.state.get("routeHandler");
        let root = currentHandlers.get("root");
        let modals = currentHandlers.get("modals");
        if (!modals || modals.size == 0)
            return;

        let toHandler;
        if (options.closeCnt > 0 && modals.size > options.closeCnt)
            toHandler = modals.get(modals.size - options.closeCnt - 1);
        else
            toHandler = root;

        let toUrl = "/";
        if (toHandler) {
            let transitData = toHandler.get("data");
            toUrl = transitData.get("url").trim();
        } else if (options.defaultUrl) {
            toUrl = options.defaultUrl;
        }

        if (options.replacing)
            this.replaceWith(toUrl, {
                forceRefresh: options.forceRefresh,
                popBack: true
            });
        else
            this.setRoute(toUrl, {
                forceRefresh: options.forceRefresh,
                popBack: true
            });
    }


    on(name, callback, first) {
        var callbacks = (this._events[name] = this._events[name] || []);

        if (first) {
            callbacks.unshift(callback);
        }
        else {
            callbacks.push(callback);
        }
    }

    off(name, callback) {
        var callbacks = this._events[name];
        if (!callbacks || !callbacks.length)
            return;

        _.pull(callbacks, callback);
    }

    trigger(name, args) {
        var callbacks = this._events[name];
        var val;

        if (callbacks) {
            for (var i = 0; i < callbacks.length; i++) {
                val = callbacks[i].apply(null, args);

                if (val === false)
                    return false;
            }
        }

        return val;
    }
}


Router.Link = require("./components/link.jsx");


module.exports = Router;
