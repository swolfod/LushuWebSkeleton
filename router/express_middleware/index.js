"use strict";


module.exports = function (options) {
    options = options || {};

    if (!options.router) {
        throw new Error('Router is required');
    }

    return function (req, res, next) {
        var directorRouter = options.router.directorRouter;
        // Attach `this.next` to route handler, for better handling of errors.
        directorRouter.attach(function() {
            this.next = next;
        });

        // Dispatch the request to the Director router.
        directorRouter.dispatch(req, res, function (err) {
            // When a 404, just forward on to next Express middleware.
            if (err && err.status === 404) {
                next();
            }
        });
    };
};