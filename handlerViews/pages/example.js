"use strict";

const i18n = require("lib/i18n");
const Example = require("components/pages/example");
const HandlerView = require("flux/handlerView");


class ExampleView extends HandlerView {
    constructor() {
        super(Example, i18n.gettext("Example Page"));
    }
    
    warmUpTransition(app, transitData) {
    }
}

module.exports = new ExampleView();
