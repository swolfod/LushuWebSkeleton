"use strict";

if (!String.prototype.format) {
    String.prototype.format = function() {

        var args = arguments;
        var sprintfRegex = /\{(\d+)\}/g;

        var sprintf = function (match, number) {
            return number in args ? args[number] : match;
        };

        return this.replace(sprintfRegex, sprintf);
    };
}


if (!String.prototype.formatClear) {
    String.prototype.formatClear = function () {

        var sprintfClear = function (match, number) {
            return "";
        };

        var sprintfRegexClear = /\&(\w+)\=undefined/g;
        return this.replace(sprintfRegexClear, sprintfClear);
    };
}


if (!String.prototype.formatImg) {
    String.prototype.formatImg = function(sizeObject) {

        var src = this;

        if (typeof sizeObject == "number"){
            sizeObject = {
                w: sizeObject,
                h: sizeObject
            };
        }

        src = src.replace("{width}", sizeObject && sizeObject.w || 0);
        src = src.replace("{height}", sizeObject && sizeObject.h || 0);
        
        return src;
    };
}

if (!String.prototype.resizeImg) {
    String.prototype.resizeImg = function(sizeObject) {
        var src = this;
        if (sizeObject && sizeObject.w){
            src = src.replace("{width}", sizeObject.w);
        }
        if (sizeObject && sizeObject.h){
            src = src.replace("{height}", sizeObject.h);
        }
        return src;
    };
}


if(typeof(String.prototype.trim) === "undefined") {
  String.prototype.trim = function(){
    return String(this).replace(/^\s+|\s+$/g, '');
  };
}

if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function(obj, start) {
       for (var i = (start || 0), j = this.length; i < j; i++) {
           if (this[i] === obj) { return i; }
       }
       return -1;
  }
}

if (!Array.prototype.last){
  Array.prototype.last = function(){
    if (this.length == 0)
      return null;
    return this[this.length - 1];
  };
}

if (!Array.isArray) {
  Array.isArray = function(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

if (typeof Element != "undefined" && !Element.prototype.hasClass) {
    Element.prototype.hasClass = function (className) {
        return this.className && new RegExp("(^|\\s)" + className + "(\\s|$)").test(this.className);
    };
}

if (typeof window != "undefined" && !window.mobilecheck) {
    window.mobilecheck = function () {
        var check = false;
        (function (a) {
            if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4)))check = true
        })(navigator.userAgent || navigator.vendor || window.opera);
        return check;
    }
}

(function () {
    function bindFunction(ctx, fn) {
        return function() {
            return fn.apply(this, arguments);
        }
    }

    function bindProperty(ctx, prop, parentDescriptor) {
        if (!parentDescriptor) {
            var defaultValue = ctx.__proto__[prop];
            parentDescriptor = {
                get: function () {
                    return ctx['__' + prop] || defaultValue
                },
                set: function (val) {
                    ctx['__' + prop] = val;
                }
            }
        }
        Object.defineProperty(ctx, prop, {
            get: parentDescriptor.get ? parentDescriptor.get.bind(ctx) : undefined,
            set: parentDescriptor.set ? parentDescriptor.set.bind(ctx) : undefined,
            configurable: true
        });

    }

    function iterateProps(subClass, superClass) {
        var props = Object.getOwnPropertyNames(superClass),
            proto;

        subClass.__proto__ = superClass;
        for (var i = 0, len = props.length; i < len; i++) {
            var prop = props[i];
            if (prop === '__proto__') {
                proto = superClass[prop];
            } else if (_exclude.indexOf(i) === -1) {
                var descriptor = Object.getOwnPropertyDescriptor(subClass, prop);
                if (!descriptor) {
                    var superDescriptor = Object.getOwnPropertyDescriptor(superClass, prop);
                    if (typeof superDescriptor.get !== 'function' && typeof superClass[prop] === 'function') {
                        subClass[prop] = bindFunction(subClass, superClass[prop]);
                    } else if (typeof superDescriptor.get == 'function') {
                        bindProperty(subClass, prop, superDescriptor);
                    } else {
                        bindProperty(subClass, prop);
                    }
                }
            }
        }
        if (proto) {
            iterateProps(subClass, proto);
        }
    }

    if (typeof Object.setPrototypeOf === 'undefined' && typeof Object.getOwnPropertyNames === 'function') {
        var _exclude = ['length', 'name', 'arguments', 'caller', 'prototype'];

        Object.setPrototypeOf = iterateProps;
    }
})();