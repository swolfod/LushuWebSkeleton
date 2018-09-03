"use strict";

var _ = require("lodash");

var _eventHandlers = {};

function addHandler(event, handler) {
    if (!_eventHandlers[event])
        _eventHandlers[event] = [];

    _eventHandlers[event].push(handler);
}

function removeHandler(event, handler) {
    let handlers = _eventHandlers[event] || [];
    let index = handlers.indexOf(handler);
    if (index >= 0)
        handlers.splice(index, 1);
}

function trigger(event, options) {
    let handlers = _eventHandlers[event] || [];
    _.forEach(handlers, handler => handler(event, options));
}


module.exports = {
    addHandler: addHandler,
    removeHandler: removeHandler,
    trigger: trigger
};