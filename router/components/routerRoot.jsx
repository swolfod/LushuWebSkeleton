"use strict";

var React = require('react');
var connectToStores = require("flux/connectToStores");
var _ = require('lodash');
var utils = require("lib/utils");
const PropTypes = require('prop-types');


class RouterRoot extends React.Component {
    static getStores(props, context) {
        return [
            props.app.stores.routerStore
        ];
    }

    static getPropsFromStores(props, context) {
        let state = props.app.stores.routerStore.getState();

        return {
            transitId       : state.get("transitId"),
            routeHandler    : state.get("routeHandler"),
            inTransit       : state.get("inTransit"),
            transitData     : state.get("transitData"),
            readyToRender   : state.get("readyToRender"),
            pageTitle       : state.get("pageTitle"),
            popLayers    : state.get('popLayers'),
        };
    }

    static childContextTypes = {
        router: PropTypes.object.isRequired,
        app: PropTypes.object.isRequired
    };

    getChildContext() {
        return {
            app: this.props.app,
            router: this.props.app.fluxRouter
        };
    }

    render() {
        var routeHandler = this.props.routeHandler;
        var app = this.props.app;
        var router = app.fluxRouter;
        var handlers = [];

        var rootHandler = "";
        var rootComponent = routeHandler.get("root");
        if (rootComponent) {
            var handlerViewId = rootComponent.get("handler");
            var handlerData = rootComponent.get("data").toJS();

            var rootView = router.getHandlerView(handlerViewId);
            handlers.push({view: rootView, data: handlerData});
            rootHandler = rootView.getPageView ? rootView.getPageView(app, handlerData) : React.createElement(rootView, handlerData);
        }

        var modalHandlers;
        var modalComponents = routeHandler.get("modals");
        if (modalComponents && modalComponents.size) {
            modalHandlers = modalComponents.map(function (modalComponent) {
                var modalView = modalComponent.get("handler");
                var modalData = modalComponent.get("data").toJS();
                modalData.key = modalComponent.get("key");
                if (!modalData.key)
                    modalData.key = _.uniqueId("modal_");

                modalView = router.getHandlerView(modalView);
                handlers.push({view: modalView, data: modalData});

                return modalView.getPageView ? modalView.getPageView(app, modalData) : React.createElement(modalView, modalData);
            }).toJS();
        }

        var popLayers=this.renderPopLayers();


        var accessories = [];
        if (handlers.length > 0) {
            for (var i = handlers.length - 1; i >= 0; i--) {
                var handler = handlers[i];
                var handlerView = handler.view;

                var handlerAccessories = handlerView.getAccessories && handlerView.getAccessories(app, handler.data);
                if (!handlerAccessories || handlerAccessories.length === 0)
                   continue;

                if (!handlerAccessories.length)
                   handlerAccessories = [handlerAccessories];

                for (var j = handlerAccessories.length - 1; j >= 0; j--) {
                    var nextAccessory = handlerAccessories[j];
                    if (nextAccessory.key) {
                       if (_.find(accessories, function(accessory) {return accessory.key == nextAccessory.key}))
                           continue;
                    }

                    accessories.unshift(nextAccessory);
                }
            }
        }

        var classes = "";
        if (this.props.inTransit && !this.props.readyToRender)
            classes = (classes + " warmingUp").trim();

        return (
            <div className={classes}>
                {rootHandler}
                {modalHandlers}
                {popLayers}
                {accessories.length > 0 ? accessories : null}
            </div>
        );
    }

    renderPopLayers(){
      let popLayers = this.props.popLayers;
      //console.log('poplayers',popLayers.toJS());
      return popLayers.map(({content,options},index)=>{
        return <div className='layers' key={index}>
        {content}
        </div>
      });
    }

    shouldComponentUpdate(nextProps, nextState) {
        // always return boolean
        return !!(!this.props.inTransit || this.props.readyToRender || nextProps.readyToRender);
    }

    componentDidMount() {
        this.props.app.actions.routerActionCreators.transitionFinished(this.props.transitId);

        let modals = this.props.routeHandler.get("modals");
        if (modals && modals.size)
            utils.addClass(document.body, "showModal");
        else
            utils.removeClass(document.body, "showModal");

        document.title = this.props.app.stores.routerStore.getState().get("pageTitle");
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.transitId === prevProps.transitId &&
           this.props.inTransit === prevProps.inTransit && this.props.readyToRender === prevProps.readyToRender)
            return;

        if (this.props.inTransit && this.props.readyToRender) {
            if (this.props.transitData) {
                if (this.props.transitData.get("resetPos"))
                    window.scrollTo(0, 0);
                else if (this.props.transitData.get("scrollToLeftPos")) {
                    let pageUrl = this.props.transitData.get("url");
                    let leftPos = this.props.app.stores.routerStore.pageLeftScrollPos(pageUrl);
                    if (leftPos)
                        window.scrollTo(leftPos.get("left"), leftPos.get("top"));
                }
            }
            this.props.app.actions.routerActionCreators.transitionFinished(this.props.transitId);
        }

        let modals = this.props.routeHandler.get("modals");
        if (modals && modals.size)
            utils.addClass(document.body, "showModal");
        else
            utils.removeClass(document.body, "showModal");

        document.title = this.props.pageTitle;
    }
}

module.exports = connectToStores(RouterRoot);
