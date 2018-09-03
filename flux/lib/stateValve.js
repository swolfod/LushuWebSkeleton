"use strict";

const _ = require("lodash");


var __valve_opened = false;


function closeValve() {
    __valve_opened = false;
}

function openValve() {
    if (!__valve_opened) {
        __valve_opened = true;
        return true;
    }
    
    return false;
}

function isOpenning() {
    return __valve_opened;
}

function flushState(t, n, descriptor) {
    const original = descriptor.value;
    
    if (typeof original === 'function') {
        descriptor.value = function(...args) {
            let isValveKeeper = openValve();
            const result = original.apply(this, args);
        
            if (isValveKeeper)
                closeValve();
        
            return result;
      }
    }
    
    return descriptor;
}



module.exports = {
    closeValve,
    openValve,
    isOpenning,
    flushState
};