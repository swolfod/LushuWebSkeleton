"use strict";


var Immutable = require("immutable");
var immutableStore = require('./immutableStore');
var _ = require("lodash");


class Store {
    
    constructor(stateType) {
        this._stateType = stateType;
        this._stateId = _.uniqueId(this._stateType);
        this._stateBackups = Immutable.Map();
        this.state = Immutable.Map();
        
        Object.defineProperty(this, "app", { get: () => this.alt.application });
    }

    initNewState(initialStates) {
        if (this._stateId)
            this.app.hubStorage.clearReferredData(this._stateId);

        this._stateId = _.uniqueId(this._stateType);
        this.state = initialStates ? Immutable.fromJS(initialStates) : Immutable.Map();
        this._stateBackups = Immutable.Map();
    }

    backUpState(backupKey, state) {
        if (!backupKey)
           backupKey = "default";

        state = state ? Immutable.fromJS(state) : this.state;

        let currentBackups = this._stateBackups.get(backupKey) || Immutable.List();
        this._stateBackups = this._stateBackups.set(backupKey, currentBackups.push(state));
    }

    popStateBackup(backupKey) {
        if (!backupKey)
           backupKey = "default";

        let backups = this._stateBackups.get(backupKey);
        if (!backups)
           return null;
        
        let stateBackup = backups.get(0);
        backups = backups.shift();

        if (backups.size > 0)
           this._stateBackups = this._stateBackups.set(backupKey, backups);
        else
           this._stateBackups = this._stateBackups.delete(backupKey);

        return stateBackup;
    }

    get stateId() {
        return this._stateId;
    }

    set handlers(actionHandlers) {

        _.forOwn(actionHandlers, (actions, handler) => {
            let that = this;

            let listener = function(payload, action) {
                if (_.isArray(payload))
                    return that[handler](...payload);
                else
                    return that[handler](payload);
            };

            if (_.isArray(actions)) {
                _.forEach(actions, action => {
                    if (typeof action == "undefined")
                       throw new Error("Undefined action for " + handler);

                    this.bindAction(action, listener)
                })
            } else {
                if (typeof actions == "undefined")
                   throw new Error("Undefined action for " + handler);

                this.bindAction(actions, listener);
            }
        });
    }
}

module.exports = immutableStore(Store);
