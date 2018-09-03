"use strict";

const React = require("react");
const i18n = require("lib/i18n");
const styles = require("./example.scss");

class ExamplePage extends React.Component {
    render() {        
        return (
            <div className={styles.examplePage}>
                <div className={styles.title}>{i18n.gettext("Hello World!")}</div>
            </div>
        );
    }
}

module.exports = ExamplePage;