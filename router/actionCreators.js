var ActionCreators = require("flux/actionCreators");
var _ = require("lodash");

class RouterActionCreators extends ActionCreators {
    constructor(options) {
        super(options);

        this.generateDirectActions(
           "transitionStart",
           "transitionFinished",
           "transitionFailed",
           "readyToRender",
           "configureRouter",
           "initNewNavigation",
           "cancelTransit",
           "popToView",
           "setPageTitle",
           "setPageDescription"
        );

        this.generateAsyncActions("warmUp");
    }

    warmUpTransition(transitId, warmUpOperations, transitData) {
        let warmUpPromises = _.reduce(warmUpOperations, (warmUpPromises, warmUpOperation) => {
            warmUpPromises.push(warmUpOperation(this.app, transitData));
            return warmUpPromises;
        }, []);

        if (warmUpPromises.indexOf(false) >= 0)
            //TODO: cancel transition
            return null;

        return Promise.all(warmUpPromises).then(() => {
            this.warmUpDone(transitId, transitData);

        }).catch(reason => {
            this.warmUpFailed(transitId, transitData, reason);
            throw reason;
        });
    }
}

module.exports = RouterActionCreators;