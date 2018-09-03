"use strict";

const React = require('react');
const _ = require("lodash");
const autoBind = require('react-autobind');
const Immutable = require("immutable");
const PropTypes = require('prop-types');

class ReactComponent extends React.Component {
    autoBind() {
        autoBind(this);
    }

    static contextTypes = {
        router: PropTypes.object,
        app: PropTypes.object.isRequired
    };

    static getStores(props, context) {
        if (this.listenTo) {
            let stores = this.listenTo(props.app || context.app, props, context);
            if (stores && !_.isArray(stores))
               stores = [stores];

            return stores;
        }
    }

    static getPropsFromStores(props, context) {
        let stores = this.getStores ? this.getStores(props, context) : [];
        let componentProps = this.fetch ? (this.fetch(props.app || context.app, props, context) || {}) : {};

        if (stores && stores.length) {
            componentProps.fluxAllStoreStates = _.reduce(stores, (storeStates, store) => {
                storeStates[store.displayName] = store.getState();
                return storeStates;
            }, {});
            componentProps.fluxStorePropKeys = Immutable.Set(_.keys(componentProps));
        }

        return componentProps;
    }

    get app() {
        return this.props.app || this.context.app;
    }
    
    shouldComponentUpdate(nextProps, nextState) {
        if (!nextProps.fluxAllStoreStates || !this.props.fluxAllStoreStates)
           return true;
        
        let componentStateChanged = false;
        _.forOwn(nextProps.fluxAllStoreStates, (state, storeName) => {
            if (this.props.fluxAllStoreStates[storeName] !== state) {
                componentStateChanged = true;
                return false;
            }
        });

        if (!componentStateChanged) {
            let propKeys = _.keys(nextProps);
            if (propKeys.length > nextProps.fluxStorePropKeys.size + 1) {
                _.forEach(propKeys, propKey => {
                    if (nextProps.fluxStorePropKeys.contains(propKey) || propKey == "fluxStorePropKeys")
                       return;

                    if (nextProps[propKey] != this.props[propKey]){
                        componentStateChanged = true;
                        return false;
                    }
                });
            }
        }

        if (!componentStateChanged && nextState && this.state) {
            _.forOwn(nextState, (v, k) => {
                if (this.state[k] !== v) {
                    componentStateChanged = true;
                    return false;
                }
            });
        }

        return componentStateChanged;                
    }
}

module.exports = ReactComponent;
