"use strict";

var _ = require("lodash");

function directDispatch(...payloads) {
    return payloads;
}

class ActionCreators {
    constructor(options) {
        this.app = options.app;
    }

    generateDirectActions(...actionNames) {
        actionNames.forEach((actionName) => {
            this[actionName] = directDispatch
        });
    }

    generateAsyncActions() {
        let actions = _.reduce(arguments, (actions, actionName) => {
            actions.push(`${actionName}Starting`);
            actions.push(`${actionName}Done`);
            actions.push(`${actionName}Failed`);

            return actions;
        }, []);

        return this.generateDirectActions(...actions);
    }

    _getParameters(options, warmUp) {
        let parameterDict = options.parameterDict;
        let requestParameterKeys = options.requestParameterKeys;
        let actionParameterKeys = options.actionParameterKeys;

        let requestParameters;
        if (parameterDict && requestParameterKeys)
            requestParameters = _.map(requestParameterKeys, key => parameterDict[key]);

        let actionParameters = requestParameters;
        if (parameterDict && actionParameterKeys)
            actionParameters = _.map(actionParameterKeys, key => parameterDict[key]);

        requestParameters = requestParameters || (warmUp ? options.warmUpParameters : options.requestParameters) || [];
        actionParameters = actionParameters || requestParameters;
        return {
            requestParameters: requestParameters,
            actionParameters: actionParameters
        }
    }

    _resolveActionPromise(promiseAction, options) {
        let promise;
        if (this.blockingPromise) {
            let currentPromise = this.blockingPromise;
            promise = new Promise((resolve, reject) => {
                currentPromise.then(() => {
                    promiseAction().then(resolve).catch(reject);
                })
            });
        }
        else
            promise = promiseAction();

        if (options.blocking) {
            promise = promise.then((result) => {
                if (this.blockingPromise == promise) {
                    delete this.blockingPromise;

                    if (options.clearUpBlockCalls)
                        options.clearUpBlockCalls();
                }

                return result;
            }).catch(error => {
                console.error("Error after blocking request");
                console.error(error);

                if (this.blockingPromise == promise) {
                    delete this.blockingPromise;

                    if (options.clearUpBlockCalls)
                        options.clearUpBlockCalls();
                }

                throw error;
            });

            this.blockingPromise = promise;
        }

        return promise;
    }

    warmUpAction(warmUpOptions) {
        let apiName = warmUpOptions.apiName;
        let warmUpFuncName = warmUpOptions.warmUpFuncName;
        let warmUpCacheKey = warmUpOptions.warmUpCacheKey || warmUpFuncName;
        let transitData = warmUpOptions.transitData;
        let actionName = warmUpOptions.actionName;
        let constructCacheData = warmUpOptions.constructCacheData;
        let refreshOptions = warmUpOptions.refreshOptions;
        let preprocessResult = warmUpOptions.preprocessResult;

        let {requestParameters, actionParameters} = this._getParameters(warmUpOptions, true);

        if (!transitData && actionName && _.isFunction(this[`${actionName}Starting`]))
            this[`${actionName}Starting`](...actionParameters);

        let that = this;
        function doWarmUpAction() {
            if (refreshOptions) {
                refreshOptions(warmUpOptions, true);
                let newParameters = that._getParameters(warmUpOptions);
                requestParameters = newParameters.requestParameters;
                actionParameters = newParameters.actionParameters;
            }

            if (!that.app.apis[apiName]) {
                throw new Error('Cannot find apiName {0}'.format(apiName));
            }

            if (!that.app.apis[apiName][warmUpFuncName]) {
                throw new Error('Cannot find api function {0}.{1}'.format(apiName, warmUpFuncName));
            }

            return that.app.apis[apiName][warmUpFuncName](...requestParameters).then(result => {
                if (preprocessResult)
                    result = preprocessResult(warmUpOptions, result, transitData);

                if (transitData){
                    that.app.actions.genericActionCreators.warmUpCache(warmUpCacheKey, transitData, constructCacheData(result));
                }
                else if (actionName && _.isFunction(that[actionName])) {
                    actionParameters.push(result);
                    that[`${actionName}Done`](...actionParameters);
                }

                return result;
            }).catch(error => {
                console.log(warmUpFuncName);
                console.error(error);

                if (warmUpOptions.handleError && warmUpOptions.handleError(error) === false)
                    return;

                if (actionName && _.isFunction(that[`${actionName}Failed`]))
                    that[`${actionName}Failed`](error, ...actionParameters);

                that.app.actions.genericActionCreators.handleApiError(error);

                throw error;
            });
        }

        return this._resolveActionPromise(doWarmUpAction, warmUpOptions);
    }

    requestAction(requestOptions) {
        let apiName = requestOptions.apiName;
        let requestFuncName = requestOptions.requestFuncName;
        let actionName = requestOptions.actionName;
        let refreshOptions = requestOptions.refreshOptions;
        let preprocessResult = requestOptions.preprocessResult;

        let {requestParameters, actionParameters} = this._getParameters(requestOptions);


        if (actionName && _.isFunction(this[`${actionName}Starting`]))
            this[`${actionName}Starting`](...actionParameters);

        let that = this;
        function doRequestAction() {
            if (refreshOptions) {
                refreshOptions(requestOptions);
                let newParameters = that._getParameters(requestOptions);
                requestParameters = newParameters.requestParameters;
                actionParameters = newParameters.actionParameters;
            }

            return that.app.apis[apiName][requestFuncName](...requestParameters).then(result => {
                if (preprocessResult)
                    result = preprocessResult(requestOptions, result);

                actionParameters.push(result);
                if (actionName && _.isFunction(that[actionName]))
                    that[`${actionName}Done`](...actionParameters);

                return result;
            }).catch(error => {
                console.log(apiName, requestFuncName, requestParameters);
                console.error(error);

                if (requestOptions.handleError && requestOptions.handleError(error) === false)
                    return;

                if (actionName && _.isFunction(that[`${actionName}Failed`]))
                    that[`${actionName}Failed`](error, ...actionParameters);

                that.app.actions.genericActionCreators.handleApiError(error);

                throw error;
            });
        }

        return this._resolveActionPromise(doRequestAction, requestOptions);
    }
}


module.exports = ActionCreators;