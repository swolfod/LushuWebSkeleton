"use strict";


var Immutable = require('immutable');
var _ = require("lodash");

function immutableStore(StoreModel, overrides) {
  StoreModel.config = _.assign({
    setState(currentState, nextState) {
      this._state = nextState;
      let stateStamp = this._state.get("__state_stamp__", 0);
      this._state = this._state.set("__state_stamp__", stateStamp + 1);
      return this._state;
    },

    getState(currentState) {
      return currentState;
    },

    onSerialize(state) {
      return state.toJS();
    },

    onDeserialize(data) {
      return Immutable.fromJS(data);
    }
  }, overrides);

  Object.defineProperty(StoreModel.prototype, "state", {
    get: function() {
      let instance = this.getInstance();

      if (instance)
         return instance.state;
      else
         return this._state;
    },

    set: function(nextState) {
      let instance = this.getInstance();

      if (instance)
        this.setState(nextState);
      else
        this._state = nextState;
    }
  });

  Object.defineProperty(StoreModel.prototype, "app", {
    get: function() {
      return this.alt;
    }
  });

  return StoreModel;
}

module.exports = immutableStore;