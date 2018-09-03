"use strict";

var React = require("react");
var ReactComponent = require("flux/reactComponent");
var _ = require("lodash");
const PropTypes = require('prop-types');

var object = PropTypes.object;
var string = PropTypes.string;
var func = PropTypes.func;
var bool = PropTypes.bool;

function isLeftClickEvent(event) {
    return event.button === 0;
}

function isModifiedEvent(event) {
    return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

class Link extends ReactComponent {

    static propTypes = {
        activeStyle: object,
        activeClassName: string,
        scrollToTop: bool,
        to: string.isRequired,
        query: object,
        state: object,
        onClick: func
    };

    static defaultProps = {
        className: '',
        activeClassName: 'activeLink',
        style: {},
        scrollToTop: true
    };

    constructor(props) {
        super(props);

        this.autoBind();
    }

    handleClick(event) {
        var allowTransition = true;
        var clickResult;

        if (this.props.onClick)
            clickResult = this.props.onClick(event);

        if (isModifiedEvent(event) || !isLeftClickEvent(event))
            return;

        if (clickResult === false || event.defaultPrevented === true)
            allowTransition = false;

        event.preventDefault();

        if (allowTransition) {
            let navOptions = {
                scrollToTop: this.props.scrollToTop
            };

            if (!this.props.replacing)
                this.context.router.setRoute(this.props.to, navOptions);
            else
                this.context.router.replaceWith(this.props.to, navOptions);
        }
    }

    isNoFollowLinks() {
        let list = ["/reset-password",
                    "/email-reset-password",
                    "/change-password",
                    "/binding",
                    "/register",
                    "/login"];

        let href = this.props.href || this.props.to || "";

        let matches = list.filter((item) => {
            return href.indexOf(item) == 0;
        });

        return matches && matches.length > 0;
    }

    render() {
        var props = _.assign({}, {
            className: this.props.className,
            style: this.props.style,
            href: this.props.href || this.props.to,
            onClick: this.handleClick,
            children: this.props.children
        });

        if (this.isNoFollowLinks()) {
            props.rel = "nofollow";
        }

        // ignore if rendered outside of the context of a router, simplifies unit testing
        if (this.context.router) {
            if (props.activeClassName)
                props.className = (props.className + " " + props.activeClassName).trim();

            if (props.activeStyle)
                _.assign(props.style, props.activeStyle);
        }

        return React.createElement('a', props);
    }

}

module.exports = Link;