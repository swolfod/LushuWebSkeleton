"use strict";

var React = require("react");
var _ = require("lodash");


class HandlerView {
    constructor(handlerComponent, pageTitle, pageDesc) {
        this._component = handlerComponent;

        if (pageTitle)
           this.pageTitle = pageTitle;
        
        if (pageDesc)
           this.pageDescription = pageDesc
    }

    instantiateElement(component, data, key) {
        data = _.clone(data || {});
        delete data.key;
        if (key)
           data.key = key;

        return React.createElement(component, data);
    }
    
    getPageView(app, handlerData) {
        return this.instantiateElement(this._component, handlerData, handlerData.key);
    }
    
    getAccessories(app, handlerData) {
        return [];
    }
}


module.exports = HandlerView;