"use strict";


var _ = require("lodash");
var Immutable = require("immutable");
var Store = require("flux/store");
var Perf = require("react-addons-perf");

class RouterStore extends Store {
    constructor() {
        super("router");

        this.state = Immutable.fromJS({
            navStamp: _.uniqueId("navigation_"),
            popLayers:[], //[{content,options:{layerid,onClose,onCancel...}}
        });

        let routerActionCreators = this.app.actions.routerActionCreators;
        let popupActionCreators = this.app.actions.popupActionCreators;

        this.handlers = {
            onClose: popupActionCreators.close,
            onAlert: popupActionCreators.alert,
            onConfirm: popupActionCreators.confirm,
            onPrompt: popupActionCreators.prompt,


            configureRouter: routerActionCreators.configureRouter,
            transitionStart: routerActionCreators.transitionStart,
            transitionDone: routerActionCreators.transitionFinished,
            transitionFailed: routerActionCreators.transitionFailed,
            cancelTransit: routerActionCreators.cancelTransit,
            warmUpDone: routerActionCreators.warmUpDone,
            setPageTitle: routerActionCreators.setPageTitle,
            setPageDescription: routerActionCreators.setPageDescription,
            readyToRender: routerActionCreators.readyToRender
        };

        this.exportPublicMethods({
            handlerAvailable: this.handlerAvailable
        });
    }

    onClose(){
      this.state = this.state.update('popLayers',layers=>layers.pop());
    }

    onPrompt(content,options){

      this.state = this.state.update('popLayers',layers=>layers.push({content,options}));
      return _.uniqueId('layerid_');
    }

    onConfirm(content,options){
      this.state = this.state.update('popLayers',layers=>layers.push({content,options}));
    }

    onAlert(content,options){
      this.state = this.state.update('popLayers',layers=>layers.push({content,options}));
    }

    configureRouter(config) {
        if (config.hasOwnProperty("rootClass"))
            this.state = this.state.set("rootClass", config.rootClass);
    }

    transitionStart(transitId, handlerConfig, transitData, navOptions) {
        //Perf.start();

        let pageLeftScrollPos = this.state.get("pageLeftScrollPos", Immutable.Map());

        let currentUrl = this.state.get("currentUrl");
        let isServer = typeof process != "undefined" && !process.browser;
        if (currentUrl && !isServer)
            pageLeftScrollPos = pageLeftScrollPos.set(currentUrl, Immutable.fromJS({
                top: window.pageYOffset || document.documentElement.scrollTop,
                left: window.pageXOffset || document.documentElement.scrollLeft
            }));

        this.state = this.state
           .set("pageLeftScrollPos", pageLeftScrollPos)
           .set("transitId", transitId)
           .set("transitData", Immutable.fromJS(transitData))
           .set("navOptions", Immutable.fromJS(navOptions))
           .set("readyToRender", false)
           .set('popLayers',Immutable.fromJS([]))
           .set("inTransit", true);

        this.state = this.state.set("transitHandler", Immutable.fromJS(handlerConfig));
    }

    cancelTransit() {
        this.clearTransitionState();
    }

    warmUpDone(transitId) {
        if (transitId != this.state.get("transitId"))
            return;

        var transitHandler = this.state.get("transitHandler");
        var transitData = this.state.get("transitData");
        var currentRouteHandler = this.state.get("routeHandler");
        var navOptions = this.state.get("navOptions");
        var currentStamp = this.state.get("navStamp");

        var handler = Immutable.fromJS({
            key: transitHandler.get("key"),
            handler: transitHandler.get("view"),
            data: transitData
        });

        let root, modals;
        if (transitHandler.get("type") == "modal") {
            //Not navigating to a new page, but poping modals
            if (currentRouteHandler) {
                root = currentRouteHandler.get("root");
                modals = currentRouteHandler.get("modals") || Immutable.List();

                if (navOptions.get("popBack")) {
                    while(modals.size > 0) {
                        let modal = modals.last();
                        modals = modals.pop();

                        if (modal.get("handler") == handler.get("handler")) {
                            let stateTran = _.cloneDeep(transitData.toJS());
                            let modalTran = _.cloneDeep(transitData.toJS());

                            delete stateTran.resetPos;
                            delete modalTran.resetPos;

                            if (_.eq(stateTran, modalTran)) break;
                        }
                    }
                }
                else if (navOptions.get("replaceState") && modals.size > 0)
                    modals = modals.pop();

                let handlerKey = handler.get("key");
                if (handlerKey) {
                    modals = modals.reduce((result, modal) => {
                        let key = modal.get("key");
                        if (!key || key != handlerKey)
                            result = result.push(modal);

                        return result;
                    }, Immutable.List());
                }

                modals = modals.push(handler.set("stamp", currentStamp));
            }
            else
                modals = Immutable.List([handler.set("stamp", currentStamp)])
        }
        else {
            currentStamp = _.uniqueId("navigation_");
            root = handler.set("stamp", currentStamp);
        }

        this.state = this.state.set("routeHandler", Immutable.Map({
            root: root,
            modals: modals
        })).set("routeData", transitData).set("navStamp", currentStamp);

    }

    setPageTitle(transitId, title) {
        if (transitId && this.state.get("transitId") != transitId)
            return;

        this.state = this.state.set("pageTitle", title);
    }

    setPageDescription(transitId, desc) {
        if (this.state.get("transitId") != transitId)
            return;

        this.state = this.state.set("pageDescription", desc);
    }

    readyToRender(transitId) {
        if (this.state.get("transitId") != transitId)
            return;

        this.state = this.state.set("readyToRender", true);
    }

    pageLeftScrollPos(pageUrl) {
        return this.state.get("pageLeftScrollPos", Immutable.Map()).get(pageUrl);
    }

    clearTransitionState() {
        this.state = this.state.delete("transitId")
                               .delete("transitHandler")
                               .delete("transitData")
                               .delete("readyToRender")
                               .set("inTransit", false);
    }

    transitionDone(transitId) {
        if (this.state.get("transitId") != transitId)
            return;

        let currentUrl = this.state.get("transitData").get("url");

        this.state = this.state.set("currentUrl", currentUrl);
        this.clearTransitionState();

        // setTimeout(() => {
        //     Perf.stop();
        //     Perf.printInclusive();
        //     Perf.printExclusive();
        // })
    }

    transitionFailed(transitId, error) {
        if (this.state.get("transitId") != transitId)
            return;

        this.clearTransitionState();
        this.state = this.state.set("error", error);
    }

    get hasPageRootHandler() {
        return !!this.state.get("routeHandler").get("root");
    }

    get hasModalHandlers() {
        let modals = this.state.get("routeHandler").get("modals");
        return modals && modals.size > 0;
    }

    get currentRouteData() {
        return this.state.get("routeData");
    }

    get pageTitle() {
        return this.state.get("pageTitle");
    }

    get pageDescription() {
        return this.state.get("pageDescription");
    }

    get currentUrl() {
        return this.state.get("currentUrl");
    }

    handlerAvailable(handlerConfig, transitData) {
        handlerConfig = Immutable.fromJS(handlerConfig);
        transitData = Immutable.fromJS(transitData);

        let routeHandler = this.state.get("routeHandler");
        let currentStamp = this.state.get("navStamp");
        if (!routeHandler || !currentStamp)
            return false;

        let rootHandler = routeHandler.get("root");
        let handlerView = handlerConfig.get("view");
        if (rootHandler && rootHandler.get("handler") == handlerView && rootHandler.get("data").get("url") == transitData.get("url")
           && rootHandler.get("stamp") == currentStamp)
            return true;

        let modals = routeHandler.get("modals");
        if (!modals || !modals.size)
            return false;
        return modals.reduce((found, modal) => {
            return found || (modal.get("handler") == handlerView && modal.get("data").get("url") == transitData.get("url")
               && modal.get("stamp") == currentStamp);
        }, false);
    }
}

module.exports = RouterStore;
