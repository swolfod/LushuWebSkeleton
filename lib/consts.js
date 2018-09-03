var Immutable = require("immutable");
var i18n = require("./i18n");
require("lib/extensions");

function detectIE() {
    if (typeof window === "undefined")
        return false;

    var ua = window.navigator.userAgent;

    var msie = ua.indexOf('MSIE ');
    if (msie > 0) {
        // IE 10 or older => return version number
        return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
    }

    var trident = ua.indexOf('Trident/');
    if (trident > 0) {
        // IE 11 => return version number
        var rv = ua.indexOf('rv:');
        return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
    }

    var edge = ua.indexOf('Edge/');
    if (edge > 0) {
       // IE 12 => return version number
       return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
    }

    // other browser
    return false;
}

var ieVersion = detectIE();

module.exports = Immutable.fromJS({
    GOOGLE_LANGUAGE_CODE: (typeof window != "undefined" && window.language_code) || 'zh-CN',
    LANGUAGE_CODE: 'zh_cn',

    IE_VERSION: ieVersion,

    FROALA_EDITOR_KEY: "odC-11ycyA3md1C-13=="
});