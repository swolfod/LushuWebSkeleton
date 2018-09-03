"use strict";

var _ = require("lodash");
var i18n = require("./i18n");
var consts = require("./consts");
var htmlParser = require("./htmlParser");
var Entities = require("./special-entities");


function textToContentJSON(str) {
    if (!str) return null;

    //"[{"tag":"p","contents":["aasdfas"]}]"
    return JSON.stringify(str.split("\n").map(line => ({
        tag: 'p',
        contents: [line]
    })));
}

function contentJSONToText(jsonStr) {
    if (!jsonStr) return null;

    let json = JSON.parse(jsonStr);
    if (typeof json == "string")
       return json;

    return json.map(parseText).join("\n");
}

function parseText(tag) {
    let content = tag && tag.contents && tag.contents[0];
    if (typeof content === 'string') {
        return tag.contents.join().replace(/&nbsp;/g, " ");
    } else if (typeof content === 'object') {
        return tag.contents.map(parseText).join("\n").replace(/&nbsp;/g, " ");
    } else {
        return content || '';
    }
}

function constructHtml(contentObjs) {
  var html = "";

  for (var i = 0; i < contentObjs.length; i++) {
      var contentObj = contentObjs[i];

      if (!contentObj)
        continue;

      if (!contentObj.tag)
        html += contentObj;
      else if (contentObj.tag.toLowerCase() == "img") {
        var objHtml = "<div class='mediumInsert";
        if (contentObj.small)
          objHtml += " small";
        objHtml += "' contenteditable='false'><div class='mediumInsert-placeholder'><figure class='mediumInsert-images'>";
        objHtml += "<img";
        for (var k = 0; k < contentObj.attributes.length; k++)
          objHtml += " " + contentObj.attributes[k].name + "='" + contentObj.attributes[k].value + "'";
        objHtml += " />";
        objHtml += "</figure></div></div>";

        html += objHtml;
      }
      else {
        html += "<" + contentObj.tag;
        if (contentObj.attributes && contentObj.attributes.length > 0) {
          for (var k = 0; k < contentObj.attributes.length; k++)
            html += " " + contentObj.attributes[k].name + "='" + contentObj.attributes[k].value + "'";
        }
        html += ">" + constructHtml(contentObj.contents) + "</" + contentObj.tag + ">";
      }
  }

  return html;
}


function cleanHTML(html) {
  var serializedElements = this.serializeElement($("<div>" + html + "</div>")[0], true);
  return constructHtml(serializedElements);
}

function contentJsonToHtml(contentObjs, imgW, imgH) {
    if (!imgW)
        imgW = 2000;
    if (!imgH)
        imgH = 2000;

    var html = "";

    for (var i = 0; i < contentObjs.length; i++) {
        var contentObj = contentObjs[i];

        if (!contentObj)
            continue;

        if (!contentObj.tag)
            html += contentObj;
        else if (contentObj.tag.toLowerCase() == "img") {
            var objHtml = "<div class='mediumInsert";
            if (contentObj.small)
              objHtml += " small";
            objHtml += "' contenteditable='false'><div class='mediumInsert-placeholder'><figure class='mediumInsert-images'>";
            objHtml += "<img";
            for (var k = 0; k < contentObj.attributes.length; k++)
              objHtml += " " + contentObj.attributes[k].name + "='" + contentObj.attributes[k].value.formatImg({ w:imgW, h:imgH }) + "'";
            objHtml += " />";
            objHtml += "</figure></div></div>";

            html += objHtml;
        }
        else {
            html += "<" + contentObj.tag;
            if (contentObj.attributes && contentObj.attributes.length > 0) {
            for (var k = 0; k < contentObj.attributes.length; k++)
                html += " " + contentObj.attributes[k].name + "='" + contentObj.attributes[k].value + "'";
            }
            html += ">" + constructHtml(contentObj.contents) + "</" + contentObj.tag + ">";
        }
    }

    return html;
}

function getSelectionHtml() {
    var html = "";
    if (typeof window.getSelection != "undefined") {
        var sel = window.getSelection();
        if (sel.rangeCount) {
            var container = document.createElement("div");
            for (var i = 0, len = sel.rangeCount; i < len; ++i) {
                container.appendChild(sel.getRangeAt(i).cloneContents());
            }
            html = container.innerHTML;
        }
    } else if (typeof document.selection != "undefined") {
        if (document.selection.type == "Text") {
            html = document.selection.createRange().htmlText;
        }
    }
    return html;
}

function validateEmail(email) {
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

function validatePhone(phone) {
    var re1 = /^[0-9]*$/;
    //var re2 = /^1\d{10}$/;
    if (re1.test(phone)) {
        return (true);
    }
    return (false);
}

function getFunctionByName(functionName, context) {
  if (!context)
    context = window;

  var namespaces = functionName.split(".");
  var func = namespaces.pop();
  for(var i = 0; i < namespaces.length; i++) {
    context = context[namespaces[i]];
  }
  return context[func];
}

function strictParseInt(str) {
  try {
    var result = parseInt(str);
    if ("" + result != str.trim())
      return NaN;

    return result;
  }
  catch (e) {
    return NaN;
  }
}

function setGetParameter(url, paramName, paramValue) {
    let paramQuery = "";
    if (paramValue !== undefined && paramValue !== null)
        paramQuery = paramName + "=" + encodeURIComponent(paramValue);

    let match = new RegExp("[\\?&]" + paramName + "=", "g").exec(url);
    if (match)
    {
        var prefix = url.substring(0, match.index + 1);
        var suffix = url.substring(match.index + 1);
        suffix = suffix.substring(suffix.indexOf("=") + 1);
        suffix = (suffix.indexOf("&") >= 0) ? suffix.substring(suffix.indexOf("&")) : "";
        url = prefix + paramQuery + suffix;
    }
    else if (paramQuery)
    {
        if (url.indexOf("?") < 0)
            url += "?" + paramQuery;
        else
            url += "&" + paramQuery;
    }

    url = url.replace("&&", "&").replace("?&", "?");
    if (url[url.length - 1] == "?" || url[url.length - 1] == "&")
       url = url.substr(0, url.length - 1);

    return url;
}

function hasClass(element, className) {
    return element.className && new RegExp("(^|\\s)" + className + "(\\s|$)").test(element.className);
}

function constructUrl(baseUrl, queries) {
    if (!baseUrl)
        baseUrl = "/";

    if (!queries)
        return baseUrl;

    _.forOwn(queries, function(value, key) {
        if (typeof value != "undefined")
            baseUrl = setGetParameter(baseUrl, key, value);
    });

    return baseUrl;
}

function topOfElement(element) {
  if (!element) {
    return 0;
  }
  return element.offsetTop + topOfElement(element.offsetParent);
}

function windowScrollTop() {
    return (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
}

function elementTop(element) {
    var y = element.offsetTop;
    var node = element;
    while (node.offsetParent && node.offsetParent != document.body) {
        node = node.offsetParent;
        y += node.offsetTop;
    } return y;
}

function smoothScrollTo(element, options) {
    if (!options)
        options = {};

    var startY = windowScrollTop();
    var stopY = elementTop(element) - (options.offsetTop || 0);

    var distance = stopY > startY ? stopY - startY : startY - stopY;

    if (distance < 50) {
        scrollTo(0, stopY); return;
    }

    var step = Math.round(distance / (options.steps || 25));
    var leapY = stopY > startY ? startY + step : startY - step;
    var timer = 0;
    if (stopY > startY) {
        for ( var i=startY; i<stopY; i+=step ) {
            setTimeout("window.scrollTo(0, "+leapY+")", timer * 20);
            leapY += step;
            if (leapY > stopY)
                leapY = stopY;
            timer++;
        }
    }
    else {
        for (var i = startY; i > stopY; i -= step) {
            setTimeout("window.scrollTo(0, " + leapY + ")", timer * 20);
            leapY -= step;
            if (leapY < stopY)
                leapY = stopY;
            timer++;
        }
    }
}

function distanceStr(distance) {
    if(!distance){
        return "";
    }
    if (distance > 1000) {
        return i18n.gettext("{0} KM").format((distance / 1000).toFixed(1));
    }else {
        return i18n.gettext("{0} M").format(distance);
    }
}

function durationStr(duration) {
    if(!duration){
        return "";
    }
    let durationStr="";
    if (duration >= 60) {
        durationStr = i18n.gettext("{0}h").format(Math.floor(duration / 60));//.toFixed(1)
    }
    if(duration%60){
      durationStr += i18n.gettext("{0}m").format(duration % 60);
    }
    if(!durationStr){
      durationStr = '0m';
    }
    return durationStr;
}

function durationStrFull(duration) {
    if(!duration){
        return "";
    }
    let durationStr="";
    if (duration >= 60) {
        durationStr = i18n.gettext("{0} hours").format(Math.floor(duration / 60));//.toFixed(1)
    }
    if(duration%60){
      durationStr += " " + i18n.gettext("{0} minutes").format(duration % 60);
    }
    if(!duration){
      durationStr += " " + i18n.gettext("{0} minutes").format(duration % 60);
    }
    return durationStr;
}

function formatTime(time) {
    if(!time){
        return "";
    }
    var timeArr = time.split(":");
    return timeArr[0]+":"+timeArr[1];
}

function getEleOffset(elem) {
    var box = elem.getBoundingClientRect();

    return {
        top: box.top + (window.pageYOffset || document.scrollTop || 0) - (document.clientTop || 0),
        left: box.left + (window.pageXOffset || document.scrollLeft || 0) - (document.clientLeft || 0)
    };
}

function smoothScrollToInner (element, target, duration) {
    target = Math.round(target);
    duration = Math.round(duration);
    if (duration < 0) {
        return Promise.reject("bad duration");
    }
    if (duration === 0) {
        element.scrollTop = target;
        return Promise.resolve();
    }

    var start_time = Date.now();
    var end_time = start_time + duration;

    var start_top = element.scrollTop;
    var distance = target - start_top;

    // based on http://en.wikipedia.org/wiki/Smoothstep
    var smooth_step = function(start, end, point) {
        if(point <= start) { return 0; }
        if(point >= end) { return 1; }
        var x = (point - start) / (end - start); // interpolation
        return x*x*(3 - 2*x);
    }

    return new Promise(function(resolve, reject) {
        // This is to keep track of where the element's scrollTop is
        // supposed to be, based on what we're doing
        var previous_top = element.scrollTop;

        // This is like a think function from a game loop
        var scroll_frame = function() {
            if(element.scrollTop != previous_top) {
                reject("interrupted");
                return;
            }

            // set the scrollTop for this frame
            var now = Date.now();
            var point = smooth_step(start_time, end_time, now);
            var frameTop = Math.round(start_top + (distance * point));
            element.scrollTop = frameTop;

            // check if we're done!
            if(now >= end_time) {
                resolve();
                return;
            }

            // If we were supposed to scroll but didn't, then we
            // probably hit the limit, so consider it done; not
            // interrupted.
            if(element.scrollTop === previous_top
                && element.scrollTop !== frameTop) {
                resolve();
                return;
            }
            previous_top = element.scrollTop;

            // schedule next frame for execution
            setTimeout(scroll_frame, 0);
        }

        // boostrap the animation process
        setTimeout(scroll_frame, 0);
    });
}


function poiTypeClass(tagId) {
    let pieceTags = consts.get("PIECE_TYPE");
    for (let i = 0; i < pieceTags.size; i++) {
        let tag = pieceTags.get(i);
        if (parseInt(tag.value) == parseInt(tagId))
            return tag.className;
    }
}

function calcMapZoom(latN, lngE, latS, lngW, mapWidth, mapHeight) {
    var worldDimH = 256;
    var worldDimW = 256;
    var zoomMax = 21;

    function latRad(lat) {
        var sin = Math.sin(lat * Math.PI / 180);
        var radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
        return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2
    }

    function zoom(mapPx, worldPx, fraction) {
        return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.log(2))
    }

    var latFraction = (latRad(latN) - latRad(latS)) * 1.1 / Math.PI;

    var lngDiff = lngE - lngW;
    var lngFraction = (lngDiff < 0 ? (lngDiff + 360) : lngDiff) * 1.1 / 360;

    var latZoom = zoom(mapHeight, worldDimH, latFraction);
    var lngZoom = zoom(mapWidth, worldDimW, lngFraction);

    return Math.min(latZoom, lngZoom, zoomMax);
}


function staticMapUrl(lat, lng, zoom, width, height, marker=false, scale=1, language="en", format="jpg") {
    var mapDomain = GLOBAL.google_map_host || (language == "zh-CN" ? "//ditu.google.cn" : "//maps.googleapis.com");
    var mapUrl = "{0}/maps/api/staticmap?center={1},{2}&zoom={3}&size={4}x{5}&scale={6}&language={7}&format={8}&key=AIzaSyBx6JAiyAFPwBN1nM-g_hpQ7lvdPY3n2oU"
       .format(mapDomain, lat, lng, zoom, width, height, scale, language, format);

    if (marker && typeof lat == "number" && typeof lng == "number")
        mapUrl += "&markers={0}%7C{1},{2}".format(marker === true ? "color:red" : "icon:" + marker, Math.round(lat * 1000000) / 1000000, Math.round(lng * 1000000) / 1000000);

    return mapUrl;
}


function py2_round(value) {
    // Google's polyline algorithm uses the same rounding strategy as Python 2, which is different from JS for negative values
    return Math.floor(Math.abs(value) + 0.5) * Math.sign(value);
}

function encode(current, previous, factor) {
    current = py2_round(current * factor);
    previous = py2_round(previous * factor);
    var coordinate = current - previous;
    coordinate <<= 1;
    if (current - previous < 0) {
        coordinate = ~coordinate;
    }
    var output = '';
    while (coordinate >= 0x20) {
        output += String.fromCharCode((0x20 | (coordinate & 0x1f)) + 63);
        coordinate >>= 5;
    }
    output += String.fromCharCode(coordinate + 63);
    return output;
}


function polylineEncode (coordinates, precision) {
    if (!coordinates.length) { return ''; }

    var factor = Math.pow(10, precision || 5),
        output = encode(coordinates[0][0], 0, factor) + encode(coordinates[0][1], 0, factor);

    for (var i = 1; i < coordinates.length; i++) {
        var a = coordinates[i], b = coordinates[i - 1];
        output += encode(a[0], b[0], factor);
        output += encode(a[1], b[1], factor);
    }

    return output;
}



var alphabet = ["A", "B", "C", "D", "E", "F", "G",
    "H", "I", "J", "K", "L", "M", "N",
    "O", "P", "Q", "R", "S", "T",
    "U", "V", "W", "X", "Y", "Z"];

function buildStaticMapURL (markers, polylines, size, options) {
    if (typeof size === 'number') {
        size = {
            w: size,
            h: size
        }
    } else if (!size) {
        size = {
            w: 640,
            h: 300
        }
    }

    options = options || {};

    var scale = options.scale || 2;
    var language = options.language || "zh-CN";
    var format = options.format || 'png';
    var mapDomain = GLOBAL.google_map_host || (language == "zh-CN" ? "//ditu.google.cn" : "//maps.googleapis.com");

    var mapUrl = '{0}/maps/api/staticmap?size={1}x{2}&scale={3}&language={4}&format={5}&key={6}'.format(
        mapDomain, size.w, size.h, scale, language, format, 'AIzaSyBx6JAiyAFPwBN1nM-g_hpQ7lvdPY3n2oU'
    );

    for (var i = 0; i < polylines.length; i++) {
        var line = polylines[i];
        mapUrl += "&path=weight:{0}%7Ccolor:0x{1}%7Cenc:{2}".format(line.weight || 2, line.color || '000000ee', line.enc);
    }

    if (markers.length > 0) {
        for (var j = 0; j < markers.length; j++) {
            var marker = markers[j];
            var icon = "";
            if (marker.icon) {
                icon = "scale:2%7Cicon:" + (marker.icon)
            } else if (options.indexing) {
                icon = "color:0xFB5B5B%7Clabel:" + alphabet[marker.label]
            }

            mapUrl += "&markers={0}%7C{1},{2}".format(icon, marker.lat, marker.lng);
        }

        if (markers.length == 1 && options.maxZoom) {
            mapUrl += "&zoom=" + options.maxZoom;
        }
    } else {
        mapUrl += "&center=35.859295,104.13611&zoom=3"; // China for default
    }

    return mapUrl;
}

//This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
function calcDistance(lat1, lon1, lat2, lon2)
{
    var R = 6371; // km
    var dLat = toRad(lat2-lat1);
    var dLon = toRad(lon2-lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d;
}

// Converts numeric degrees to radians
function toRad(Value)
{
    return Value * Math.PI / 180;
}

const EMPTY_TAGS = "img,hr".split(",");
function isEmptyTag(tag) {
    return _.includes(EMPTY_TAGS, tag);
}

function formatContentJson(content) {
    var formattedContent = [];

    for (var i = 0; i < content.length; i++) {
        var paragraph = content[i];
        var formattedParagraph = formatElement(paragraph);
        if (formattedParagraph && (isEmptyTag(formattedParagraph.tag) || (formattedParagraph.contents && formattedParagraph.contents.length)))
            formattedContent.push(formattedParagraph);
    }

    return formattedContent;
}

function formatElement(element) {
    if (typeof element == "string")
        return element;

    var tag = element.tag.toLowerCase();
    var attributes = clearAttributes(tag, element.attr);

    if (isEmptyTag(tag)) {
        return {
            tag: tag,
            attributes: attributes
        }
    }

    var contents = [];
    if (element.children && element.children.length > 0) {
        for (var i = 0; i < element.children.length; i++) {
            var formattedChild = formatElement(element.children[i]);
            if (!formattedChild)
                continue;

            if (formattedChild.tag == "img")
                return formattedChild;

            if (htmlParser.isBlockTag(formattedChild.tag)) {
                contents = contents.concat(formattedChild.contents);
                if (formattedChild.attributes) {
                    attributes = attributes || {};
                    _.assign(attributes, formattedChild.attributes);
                }
            }
            else
                contents = contents.concat(formattedChild);
        }
    }

    if (!contents || !contents.length)
      return null;

    var result = {
        tag: tag,
        contents: contents
    };

    if (attributes)
        result.attributes = attributes;

    return result;
}

function clearAttributes(tag, attributes) {
    if (!tag || !attributes)
        return null;

    if (_.isArray(attributes)) {
        attributes = _.reduce(attributes, (attributes, attribute) => {
            if (attribute.name && attribute.value)
                attributes[attribute.name] = attribute.value;

            return attributes;
        }, {});
    }

    tag = tag.toLowerCase();
    if (tag == "img")
        return attributes.src ? { src: attributes.src } : null;

    if (tag == "a")
        return attributes.href ? { href: attributes.href } : null;

    if (htmlParser.isBlockTag(tag) && attributes.style) {
        let style = clearStyles(attributes.style);
        if (style)
            return { style: style };
    }

    return null;
}

function clearStyles(styles) {
    if (!styles)
        return "";

    styles = _.reduce(styles.split(";"), (styles, style) => {
        style = style.trim();
        if (!style)
            return styles;

        var parts = style.split(":");
        var styleName = parts[0].trim().toLowerCase();
        var styleValue = parts[1].trim().toLowerCase();

        if (styleName == "text-align" && styleValue == "center")
            styles.push(styleName + ": " + styleValue);

        return styles;
    }, []);

    if (!styles.length)
        return "";

    return styles.join(": ") + ";";
}

// For editing
function constructContentJson(content, imgWidth, imgHeight) {
    if (!content) return [];
    return _constructContentJson(content, imgWidth, imgHeight, true);
}

function constructContentJsonForShowing(content, imgWidth, imgHeight) {
    if (!content) return [];

    let result = _constructContentJson(content, imgWidth, imgHeight, false);

    for(let i = result.length - 1; i >= 0; i--) {
        if (_isEmptyTag(result[i])) {
            result.length--;
        } else {
            break;
        }
    }

    return result;
}

function _isEmptyTag(tag) {
    if (!tag || !tag.children || tag.children.length == 0) return true;

    let serialized = tag.children.map(child => {
        if (_.isPlainObject(child)) {
            if (child.tag == "br") {
                return "";
            } else {
                return "NOT_EMPTY"
            }
        } else {
            if (child) {
                child = child.replace(/&nbsp;/ig, "");
                child = child.replace(/\s+/g, "");
            }

            return child;
        }
    }).join("");

    return !serialized;
}

function _constructContentJson(content, imgWidth, imgHeight, appendBROnTail) {
    if (!(content instanceof Array))
        content = [content];

    content = _.cloneDeep(content);

    var hasWidth = true;
    if (typeof imgWidth == "undefined") {
        imgWidth = 700;
        hasWidth = false;
    }

    if (typeof imgHeight == "undefined")
       imgHeight = 0;

    var contentMap = [];
    var isImgOnTheTail = false;
    var isHROnTheTail = false;
    for (var i = 0; i < content.length; i++) {
        var paragraph = content[i];
        var paragraphMap = remapElement(paragraph);
        if (paragraphMap) {
            if (paragraphMap.tag == "hr") {
                if (i == content.length - 1) {
                    isHROnTheTail = true;
                }
            }
            else if (paragraphMap.tag == "p") {
                if (i == content.length - 1) {
                    if (!paragraphMap.children || paragraphMap.children.length == 0) {
                        paragraphMap.children = [{tag: 'br'}];
                    }
                }
            }
            else if (paragraphMap.tag == "img") {
                let attr = {"class": "content-image"};

                if (paragraphMap.attr && paragraphMap.attr.src) {
                    let imgSrc = paragraphMap.attr.src;
                    //paragraphMap.attr.src = imgSrc.formatImg({w: imgWidth, h: imgHeight});
                    let matches = imgSrc.match(/[0-9a-f]{32}_([0-9]{2,5})x([0-9]{2,5})/);
                    if (matches && matches.length == 3) {
                        let oriW = parseInt(matches[1]), oriH = parseInt(matches[2]);

                        oriW = oriW > 9999 ? 9999 : oriW;
                        oriH = oriH > 9999 ? 9999 : oriH;

                        if (hasWidth) {
                            let actW, actH;

                            if (imgHeight && (imgWidth / imgHeight > oriW / oriH)) {

                                actH = imgHeight > oriH ? oriH : imgHeight;
                                actW = Math.round(actH / oriH * oriW);
                            }
                            else {
                                actW = imgWidth > oriW ? oriW : imgWidth;
                                actH = Math.round(actW / oriW * oriH);
                            }

                            if (actW && actH) {
                                paragraphMap.attr.src = imgSrc.formatImg({w: actW, h: actH});
                                if(imgSrc.indexOf("width") != -1){
                                    _.assign(attr, {"style": "width:{0}px;height:{1}px".format(actW, actH)});
                                }
                            }
                        }else if(imgHeight == 0){

                            let relativeH = Math.round(imgWidth * oriH / oriW);
                            paragraphMap.attr.src = imgSrc.formatImg({w: imgWidth, h: relativeH});
                        }
                    }
                }

                //if (paragraphMap.attr && paragraphMap.attr.src) {
                //    let imgSrc = paragraphMap.attr.src;
                //    paragraphMap.attr.src = imgSrc.formatImg({w: imgWidth, h: imgHeight});
                //
                //    if (hasWidth) {
                //        let matches = paragraphMap.attr.src.match(/[0-9a-f]{32}_([0-9]{2,5})x([0-9]{2,5})/);
                //
                //        if (matches && matches.length == 3) {
                //            let oriW = parseInt(matches[1]), oriH = parseInt(matches[2]);
                //
                //            let actW, actH;
                //
                //            if (imgHeight && (imgWidth / imgHeight > oriW / oriH)) {
                //                actH = imgHeight > oriH ? oriH : imgHeight;
                //                actW = Math.round(actH / oriH * oriW);
                //            }
                //            else {
                //                actW = imgWidth > oriW ? oriW : imgWidth;
                //                actH = Math.round(actW / oriW * oriH);
                //            }
                //
                //            if (actW && actH) {
                //                paragraphMap.attr.src = imgSrc.formatImg({w: actW, h: actH});
                //                _.assign(attr, {"style": "width:{0}px;height:{1}px".format(actW, actH)});
                //            }
                //        }
                //    }
                //}

                paragraphMap = {
                    tag: "p",
                    attr: attr,
                    children: [paragraphMap]
                };

                if (i == content.length - 1) {
                    isImgOnTheTail = true;
                }
            }
            else if (htmlParser.isBlockTag(paragraphMap.tag) && paragraphMap.tag != "p" && paragraphMap.tag != "h3") {
                paragraphMap = {
                    tag: paragraphMap.tag,
                    children: [{
                        tag: "p",
                        attr: paragraphMap.attr,
                        children: paragraphMap.children
                    }]
                }
            }

            contentMap.push(paragraphMap);
        }
    }

    if (appendBROnTail && (isImgOnTheTail || isHROnTheTail || contentMap.length == 0)) {
        contentMap.push({tag: "p", children: [{tag: "br"}] });
    }

    return contentMap;
}

function remapElement(element) {
    if (!element || typeof element == "string")
        return element;

    var map = {
        tag: element.tag,
        attr: clearAttributes(element.tag, element.attributes)
    };

    if (_.isArray(map.attr)) {
        map.attr = _.reduce(map.attr, (attributes, attrObj) => {
            if (attrObj.name && attrObj.value)
                attributes[attrObj.name] = attrObj.value;

            return attributes;
        }, {});
    }

    if (map.tag == "a" && map.attr)
        map.attr.target = "_blank";

    if (element.contents && element.contents.length) {
        var children = [];
        for (var i = 0; i < element.contents.length; i++) {
            var child = remapElement(element.contents[i]);
            if (child)
                children.push(child);
        }

        map.children = children;
    }

    return map;
}

function getBounds(places) {
    if (places.toJS)
       places = places.toJS();
    let latN = -90, latS = 90;
    let placesLng = _.reduce(places, (results, place) => {
        latN = Math.max(latN, place.latitude);
        latS = Math.min(latS, place.latitude);

        results.push(place.longitude);
        return results;
    }, []).sort((a, b) => a - b);

    let lngW = placesLng[0], lngE = placesLng[placesLng.length - 1];
    let minLngDis = lngE - lngW;

    for (let i = 0; i < placesLng.length - 1; i++) {
        let lngDis = placesLng[i] - placesLng[i + 1] + 360;
        if (lngDis < minLngDis) {
            minLngDis = lngDis;
            lngE = placesLng[i];
            lngW = placesLng[i + 1];
        }
    }

    return {
        latN: latN,
        latS: latS,
        lngE: lngE,
        lngW: lngW
    }
}

function destinationBounds(destination) {
    if (destination.toJS)
       destination = destination.toJS();

    return {
        latN: destination.bounds.latitudeN,
        lngE: destination.bounds.longitudeE,
        latS: destination.bounds.latitudeS,
        lngW: destination.bounds.longitudeW
    };
}

function searchInCityBounds(city) {
    if (city.toJS)
       city = city.toJS();

    let cityBounds = city.bounds;
    let latN = cityBounds.latitudeN;
    let latS = cityBounds.latitudeS;
    let lngE = cityBounds.longitudeE;
    let lngW = cityBounds.longitudeW;

    let latDist = Math.min((latN - latS) * 5, 1);
    let lngDist = lngE - lngW;
    if (lngDist < 0)
        lngDist += 360;
    lngDist = Math.min(lngDist * 5, 1.5);

    latN = Math.min(latN + latDist, 85);
    latS = Math.max(latS - latDist, -85);
    lngE += lngDist;
    if (lngE > 180)
        lngE -= 360;
    lngW -= lngDist;
    if (lngW < -180)
        lngW += 360;

    return {
        latN: latN,
        latS: latS,
        lngE: lngE,
        lngW: lngW
    };
}

function pointInBounds(latitude, longitude, bounds) {
    if (latitude > bounds.latN || latitude < bounds.latS)
       return false;

    if (bounds.lngE > bounds.lngW)
       return longitude <= bounds.lngE && longitude >= bounds.lngW;
    else
       return longitude <= bounds.lngE || longitude >= bounds.lngW;
}

function findNodesByName(nodeName, ancestor) {
    let nodes = document.getElementsByName(nodeName);
    if (ancestor)
        nodes = _.reduce(nodes, (result, node) => {
            if (ancestor.contains(node))
                result.push(node);
            return result;
        }, []);

    return nodes;
}

function findNodesByClass(nodeClass, ancestor) {
    let nodes = document.getElementsByClassName(nodeClass);
    if (ancestor)
        nodes = _.reduce(nodes, (result, node) => {
            if (ancestor.contains(node))
                result.push(node);
            return result;
        }, []);

    return nodes;
}

function addClass(node, className) {
    if (!node || !className || hasClass(node, className))
        return;

    node.className += " " + className;
}

function removeClass(node, className) {
    if (!node || !className || !hasClass(node, className))
        return;

    node.className = node.className.split(/\s+/).reduce((array, part) => {
        if (part != className) array.push(part);
        return array;
    }, []).join(" ");
}

function getViewportSize() {
    if (typeof document == "undefined" || typeof window == "undefined")
        return null;

    return {
        w: Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
        h: Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
    };
}

function isCharCode(keycode) {
    return (keycode > 47 && keycode < 58)   || // number keys
            keycode == 32 || keycode == 13   || // spacebar & return key(s) (if you want to allow carriage returns)
            (keycode > 64 && keycode < 91)   || // letter keys
            (keycode > 95 && keycode < 112)  || // numpad keys
            (keycode > 185 && keycode < 193) || // ;=,-./` (in order)
            (keycode > 218 && keycode < 223);   // [\]' (in order)
}

function addEventListener(ele, event, handler) {
   if (ele.addEventListener)  // W3C DOM
      ele.addEventListener(event,handler, false);
   else if (ele.attachEvent) { // IE DOM
      ele.attachEvent("on" + event, handler);
   }
   else { // No much to do
      ele[event] = handler;
   }
}

function removeEventListener(ele, event, handler) {
    if(ele.removeEventListener) {
        ele.removeEventListener(event, handler);
    }
    else if(ele.detachEvent) {
        ele.detachEvent("on" + event, handler);
    }
    else if(ele["on" + event] == handler) {
        ele["on" + event] = null;
    }
}

function findParent(ele, selector) {
    let parent = ele.parentElement;
    while(parent) {
        if (parent.parentElement && _.includes(parent.parentElement.querySelectorAll(selector), parent)) {
            return parent;
        }

        parent = parent.parentElement;
    }
}

function handleEvents(e, config) {
    if (!e || !e.target)
        return;

    let targetNode = e.target;

    while (targetNode) {
        let breakLoop = false;
        for(let i = 0; i < Object.keys(config).length; i++) {
            let selector = Object.keys(config)[i];
            if (!targetNode.parentElement) break;
            let isCurrentNode = targetNode.parentElement.querySelector(selector) === targetNode;
            if (isCurrentNode && typeof config[selector] === 'function') {
                if (true !== config[selector](e)) {
                    breakLoop = true;
                    break;
                }
            }
        }

        if (breakLoop || !targetNode.parentElement) break;

        targetNode = targetNode.parentElement;
    }
}

function closest(el, parClassName) {
    while (el!==null) {
        if (hasClass(el, parClassName)) {
            return el;
        }
        el = el.parentElement;
    }
}

function parseError(errorObject) {
    let errorObjectStr = '';
    if (_.isPlainObject(errorObject)) {
        if (errorObject.error) {
            if (_.isArray(errorObject.error)) {
                errorObjectStr.join(" ");
            } else {
                errorObjectStr = errorObject.error;
            }
        } else if (errorObject.errorCode) {
            errorObjectStr = ERROR_ENUM[errorObject.errorCode] || errorObject.errorCode;
        } else {
            errorObjectStr = DEFAULT_ERROR_MESSAGE;
        }
    } else if (_.isString(errorObject)){
        errorObjectStr = errorObject;
    } else {
        errorObjectStr = DEFAULT_ERROR_MESSAGE;
    }

    return errorObjectStr;
}

var DEFAULT_ERROR_MESSAGE = "Unknown error occurred";
var ERROR_ENUM = {
    404: 'Not found',
    500: 'Server error'
};

function isMobile(userAgent) {
    let ua = userAgent || navigator.userAgent;
    return ua.match(/Android|BlackBerry|iPhone|iPad|iPod|IEMobile|WPDesktop/i)
}

function isApple(userAgent) {
    let ua = userAgent || navigator.userAgent;
    return ua.match(/iPhone|iPad|iPod/i)
}

function isAndroid(userAgent) {
    let ua = userAgent || navigator.userAgent;
    return ua.match(/Android/i)
}

function isWechat(userAgent) {
    let ua = userAgent || navigator.userAgent;
    return ua.match(/micromessenger/i);
}

function getShareToWeiboUrl(shareUrl, title) {
    let url = "http://service.weibo.com/share/share.php"
            + "?url="       + encodeURIComponent(shareUrl)
            + "&title="     + encodeURIComponent(title)
            + "&appkey="    + consts.get("WEIBO_APP_KEY")
            + "&type="      + "icon"
            + "&language="  + "zh_cn"
            + "&searchPic=" + "true";

    url += "#_loginLayer_" + new Date().getTime();

    return url;
}

function allCookies() {
    if (this.app && this.app.req && this.app.req.cookies) {
        return this.app.req.cookies || {};
    }

    if (typeof document == "undefined")
        return {};

    let c = document.cookie.split('; ');
    let cookies = {};

    for(let i=c.length-1; i>=0; i--){
       let C = c[i].split('=');
       cookies[C[0]] = C[1];
    }

    return cookies;
}

function readCookie(name) {
    return allCookies.call(this)[name];
}

function focusEnd(obj) {
    obj.focus();
    var len = obj.value.length;
    if (document.selection) {
        var sel = obj.createTextRange();
        sel.moveStart('character', len);
        sel.collapse();
        sel.select();
    } else if (typeof obj.selectionStart == 'number' && typeof obj.selectionEnd == 'number') {
        obj.selectionStart = obj.selectionEnd = len;
    }
}

function decodeHtml(html){
    return Entities.normalizeXML(html, "UTF-8");
}

function formatDateToMonthDay(dateStr, formatStr=i18n.gettext("{0}month{1}")){

    let dateStrArr = dateStr.split('-');
    if (dateStrArr.length == 3) {

        let month = "";
        if (dateStrArr[1].startsWith("0")) {
            month += dateStrArr[1][1];
        }
        else {
            month += dateStrArr[1];
        }

        return formatStr.format(month, dateStrArr[2]);
    }
    else {
        return "";
    }
}

function formatDateToDot(dateStr){
    var dateStrArr = dateStr.split('-');
    return dateStrArr[0]+"."+dateStrArr[1]+"."+dateStrArr[2];
}

function formatDateStr(dateStr, separator){
    var dateStrArr = dateStr.split(' ')[0].split('-');
    separator = separator || "/";

    return dateStrArr[0] + separator + dateStrArr[1] + separator + dateStrArr[2];
}

function formatDateToWord(dateStr){
    var dateStrArr = dateStr.split('-');
    return i18n.gettext("{0}year{1}month{2}day").format(dateStrArr[0], dateStrArr[1], dateStrArr[2]);
}

function getDate(date, offsetDay, seperator, options) {
    if (offsetDay < 1) {
        console.error("offsetDay cannot less than 1.\nFor example, during 1 day is day1-day1, during 2 days is day1-day2, nothing is for during 0 days");
    }

    if (typeof date === 'string') {
        date = parseDateStr(date)
    } else if (!(date instanceof Date)) {
        throw new Error('date has to be string or Date')
    } else {
        date = new Date(date.getTime());
    }

    if (_.isNumber(offsetDay) && !_.isNaN(offsetDay)) {
        date.setDate(offsetDay + date.getDate() - 1)
    }

    if (!options)
       options = {
           year: true
       };

    var dateElements = [ _.padStart(date.getMonth() + 1, 2, '0'), _.padStart(date.getDate(), 2, '0')];
    if (options.year)
       dateElements.unshift(date.getFullYear());

    return dateElements.join(seperator || "-");
}

function getWeek(date, offsetDays){
    if (typeof date === 'string') {
        date = parseDateStr(date)
    } else if (!(date instanceof Date)) {
        throw new Error('date has to be string or Date')
    } else {
        date = new Date(date.getTime());
    }

    if (_.isNumber(offsetDays) && !_.isNaN(offsetDays)) {
        date.setDate(offsetDays + date.getDate() - 1)
    }

    var weekday = new Array(7);
    weekday[0] = "Sunday";
    weekday[1] = "Monday";
    weekday[2] = "Tuesday";
    weekday[3] = "Wednesday";
    weekday[4] = "Thursday";
    weekday[5] = "Friday";
    weekday[6] = "Saturday";

    return i18n.gettext(weekday[date.getDay()]);
}


function getSex(sex){

    let sexStr = "";
    if(sex == 1){
        sexStr = "Male";
    }else if(sex == 2){
        sexStr = "Female";
    }

    if(sex){
        return i18n.gettext(sexStr);
    }else{
        return null;
    }
}

function parseDateStr(s) {
  var b = s.split(/\D/);
  return new Date(b[0], b[1]-1, b[2]);
}

function parseDatetimeStr(s) {
  var b = s.split(/\D/);
  return new Date(b[0], b[1]-1, b[2], b[3], b[4], b[5]);
}


function addDays(date, days){
    if(!date){
        return "";
    }
    date = new Date(date);
    date.setDate(date.getDate() + days);

    return dateToString(date);
}

function addMonths(date, months){
    if(!date){
        return "";
    }

    let dateTimeStamp = date.replace(/-/g,'/');// ie11 bug, cannot convert datestring which contains '-' ;
    let dateNew = new Date(dateTimeStamp)
    dateNew.setMonth(dateNew.getMonth() + months); 
    return dateToStringDash(dateNew);
}

function relativeTime(dateTimeStamp){
    if (dateTimeStamp === null) {
        return '';
    }

    if (typeof dateTimeStamp === 'string') {
        dateTimeStamp = dateTimeStamp.replace(/-/g,'/');// ie11 bug, cannot convert datestring which contains '-' ;
        dateTimeStamp = new Date(dateTimeStamp).getTime();
    }

    var now = new Date().getTime();
    var relative = now - dateTimeStamp;

    var minutes = Math.floor(relative / 1000 / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    var months = Math.floor(days / 30);

    let result = '';
    if(days>=1){
      result = dateToString(new Date(dateTimeStamp));
    } else if (hours >= 1) { 
        result = i18n.gettext("{0} hours ago").format(hours);
    } else if (minutes >= 1) { 
        result = i18n.gettext("{0} minutes ago").format(minutes);
    } else {
        result = i18n.gettext("Just now");
    }

    return result;
}

function dateLongValueToString(date){
    date = new Date(date);
    return dateToString(date);
}

function dateToString(date, withTime, seperator) {
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    seperator = seperator || "/";

    if(month < 10){
        month = "0"+month;
    }

    if(day < 10){
        day = "0"+day;
    }

    let fullDate = year + seperator + month + seperator + day;
    if (withTime) {
        fullDate += " " + date.getHours();
        fullDate += ":" + date.getMinutes();
        fullDate += ":" + date.getSeconds();
    }

    return fullDate;
}

function dateYearToAge(year) {
    if(!year){
        return;
    }
    year = parseInt(year);
    let nowYear = new Date().getFullYear();
    return nowYear - year;
}

function dateAgeToYear(age) {
    if(!age){
        return;
    }
    let nowYear = new Date().getFullYear();
    return nowYear - age;
}

function dateToStringDash(date) {
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();

    if(month < 10){
        month = "0"+month;
    }

    if(day < 10){
        day = "0"+day;
    }

    let fullDate = year+"-"+month+"-"+day;

    return fullDate;
}

function isFloat(floatStr) {
    return !!(/^(?:[0-9]*[.])?[0-9]+$/.exec(floatStr));
}

function zeroPad(num, places) {
  var zero = places - num.toString().length + 1;
  return Array(+(zero > 0 && zero)).join("0") + num;
}

function extractDomain(url, includePort) {
    var domain;
    //find & remove protocol (http, ftp, etc.) and get domain
    if (url.indexOf("://") > -1) {
        domain = url.split('/')[2];
    }
    else {
        domain = url.split('/')[0];
    }

    //find & remove port number
    if (!includePort)
        domain = domain.split(':')[0];

    return domain;
}

function getSearchBounds(bounds) {
    let {latN, latS, lngE, lngW} = bounds;
    let latDist = latN - latS;
    let lngDist = lngE - lngW;
    if (lngDist < 0)
        lngDist += 360;

    latN -= latDist / 10;
    latS += latDist / 10;
    lngE -= lngDist / 10;
    if (lngE < -180)
        lngE += 360;
    lngW += lngDist / 10;
    if (lngW > 180)
        lngW -= 360;

    return {
        latN: latN,
        latS: latS,
        lngE: lngE,
        lngW: lngW
    };
}

function getPrice(price, currency){

    let priceCurrency = 0;
    if(currency){
        priceCurrency = currency;
    }

    let priceText = "";
    if(price){
        let currencyItem = consts.get("CURRENCY").find(item => item.id == priceCurrency);
        priceText = price;

        if (currencyItem) {
            priceText = currencyItem.symbol + price;

            if (currencyItem.id)
               priceText += " " + currencyItem.text;
        }
    }
    return priceText;
}


function extractHrMins(time) {
    if (!time || !time.trim())
       return "";

    let firstIndex = time.indexOf(":");
    let lastIndex = time.lastIndexOf(":");
    if (firstIndex != lastIndex) {
        time = time.substr(0, lastIndex);
    }

    return time;
}


function locInBounds(lat, lng, latN, latS, lngE, lngW) {
    if (lat > latN || lat < latS)
        return false;

    return lngE > lngW ? (lng < lngE && lng > lngW) : (lng < lngE || lng > lngW);
}

function computeHash() {
    return JSON.stringify(arguments);
}

function buildImageStyle(url, format, defaultUrl, options) {
    let imageStyle = {};
    if (options)
        _.assign(imageStyle, options);

    if(url) {
        imageStyle.backgroundImage = 'url(' + url.formatImg(format) + ')';
    }else if(defaultUrl){
        imageStyle.backgroundImage = 'url(' + GLOBAL.production_static_host + defaultUrl + ')';
    }

    return imageStyle;
}

function isNotEmptyStr(str) {
    return typeof str === 'string' && !!_.trim(str);
}

function isNotEmptyJSON(str) {
    if (str && str.toJS) {
        str = JSON.stringify(str.toJS());
    } else if (_.isPlainObject(str) || _.isArray(str)) {
        str = JSON.stringify(str);
    }

    return isNotEmptyStr(str) && _.trim(str) !== '[]' && _.trim(str) !== '""';
}

function getEntityNames(dest) {
    if (!dest) return [];

    dest = dest.toJS ? dest.toJS() : dest;
    return ([dest.name_cn, dest.name_en, dest.name_etc]).filter(Boolean)
}

function getDisplayName(dest) {
    return getEntityNames(dest)[0];
}

function checkEach(newObj, origObj, fields, checkFunc) {
    return fields.reduce((map, field) => {
        let newValue = checkFunc(newObj, origObj, field);
        if (typeof newValue !== "undefined") {
            map[field] = newValue;
        }

        return map;
    }, {});
}

function _eq(a, b) {
    if (!a && !b) return true;
    
    if (a && a.toJS)
       a = a.toJS();
    
    if (b && b.toJS)
       b = b.toJS()
    
    return _.isEqual(a, b);
}

function checkFieldChanged(newObj, origObj, field) {
    if (_eq(newObj[field], origObj[field])) {
        return undefined;
    } else {
        return newObj[field] || "";
    }
}

function checkNormalFieldsChanged(newObj, origObj, fields) {
    return checkEach(newObj, origObj, fields, checkFieldChanged);
}

function checkArrayChangedByField(newObj, origObj, field) {
    return checkArrayChanged(newObj[field], origObj[field]);
}

function checkArrayChanged(newObj, origObj) {
    if (newObj && newObj.toJS) newObj = newObj.toJS();
    if (origObj && origObj.toJS) origObj = origObj.toJS();
    
    let newArray = newObj || [];
    let origArray = origObj || [];

    if (_.isEqual(newArray, origArray)) {
        return undefined;
    } else {
        return newArray;
    }
}

function checkSetChangedByField(newObj, origObj, field) {
    return checkSetChanged(newObj[field], origObj[field]);
}

function checkSetChanged(newObj, origObj) {
    if (newObj && newObj.toJS) newObj = newObj.toJS();
    if (origObj && origObj.toJS) origObj = origObj.toJS();
    
    let newArray = newObj || [];
    let origArray = origObj || [];

    if (newArray.length != origArray.length || _.differenceWith(newArray, origArray, _.isEqual).length) {
        return newArray;
    } else {
        return undefined;
    }
}

function checkArraysChanged(newObj, origObj, fields) {
    return checkEach(newObj, origObj, fields, checkArrayChangedByField);
}

function checkSetsChanged(newObj, origObj, fields) {
    return checkEach(newObj, origObj, fields, checkSetChangedByField);
}

function checkContentJSONChanged(newObj, origObj, field) {
    let newJSON = newObj[field] || "";
    newJSON = _.isArray(newJSON) ? JSON.stringify(newJSON) : newJSON;

    let origJSON = origObj[field] || "";
    origJSON = _.isArray(origJSON) ? JSON.stringify(origJSON) : origJSON;

    if (_eq(newJSON, origJSON)) {
        return undefined;
    } else {
        return newJSON;
    }
}

function checkContentJSONsChanged(newObj, origObj, fields) {
    let map = checkEach(newObj, origObj, fields, checkContentJSONChanged);
    for(let key in map) {
        map[key] = _.isString(map[key]) ? map[key] : JSON.stringify(map[key]);
    }

    return map;
}

function checkChangedFields(newObj, origObj, fieldMap) {
    if (newObj && newObj.toJS) newObj = newObj.toJS();
    if (origObj && origObj.toJS) origObj = origObj.toJS();
    if (!origObj || !newObj) return newObj;

    return _.keys(fieldMap).reduce((data, key) => {
        let fields = fieldMap[key];
        let appendingData = {};
        switch(key) {
            case "normal":
                appendingData = checkNormalFieldsChanged(newObj, origObj, fields);
                break;
            case "array":
                appendingData = checkArraysChanged(newObj, origObj, fields);
                break;
            case "set":
                appendingData = checkSetsChanged(newObj, origObj, fields);
                break;
            case "json":
                appendingData = checkContentJSONsChanged(newObj, origObj, fields);
                break;
        }

        return {...data, ...appendingData};
    }, {});
}

function buildCopyName(name, existingNames = null) {
    const REG = /\((\d+)\)$/;

    while (true) {
        let match = name.match(REG);
        if (match) {
            name = name.replace(REG, (...args) => {
                let num = args[1];
                return "({0})".format(parseInt(num, 10) + 1);
            });
        } else {
            name += "(1)";
        }

        if (!existingNames || !_.includes(existingNames, name))
            return name;
    }
}

function getDatePickerI18N() {
    let i18nObject = {
            previousMonth : i18n.gettext("Last Month"),
            nextMonth     : i18n.gettext("Next Month"),
            months        : [i18n.gettext("January"),
                                i18n.gettext("February"),
                                i18n.gettext("March"),
                                i18n.gettext("April"),
                                i18n.gettext("May"),
                                i18n.gettext("June"),
                                i18n.gettext("July"),
                                i18n.gettext("August"),
                                i18n.gettext("September"),
                                i18n.gettext("October"),
                                i18n.gettext("November"),
                                i18n.gettext("December")],
            weekdays      : [i18n.gettext("Sunday"),
                                i18n.gettext("Monday"),
                                i18n.gettext("Tuesday"),
                                i18n.gettext("Wednesday"),
                                i18n.gettext("Thursday"),
                                i18n.gettext("Friday"),
                                i18n.gettext("Saturday")],
            weekdaysShort : [i18n.gettext("Sun"),
                                i18n.gettext("Mon"),
                                i18n.gettext("Tue"),
                                i18n.gettext("Wed"),
                                i18n.gettext("Thu"),
                                i18n.gettext("Fri"),
                                i18n.gettext("Sat")]
    };

    return i18nObject;
}

function groupByCountry (dess){
    /*
     * dess:[
     * {country},
     * {country-c1},
     * {country-c2},
     * {country2-d1},
     * ]
     */

    var countries={};
    dess.filter(item=>item.type==2).forEach(item=>{
        countries[item.parent.id]= countries[item.parent.id]||[];
        countries[item.parent.id].push(item);
    });
    dess.filter(item=>item.type==1).forEach(item=>{
        if(!countries[item.id]){
            countries[item.id]= countries[item.id]||[];
            countries[item.id].unshift(item);
        }
    });
    return _.values(countries);
}

function getActualPicture(src) {
    let matches = src.match(/[0-9a-f]{32}_(?:png_)?([0-9]{2,5})x([0-9]{2,5})/);
    let oriW = null, oriH = null;
    if (matches && matches.length == 3) {
        oriW = parseInt(matches[1]);
        oriW = oriW > 9999 ? 9999 : oriW;

        oriH = parseInt(matches[2]);
        oriH = oriH > 9999 ? 9999 : oriH;
    }
    return {oriW: oriW, oriH: oriH};
}

function hideYScroll(isHide) {
    let bodyEle = document.getElementsByTagName("body")[0];
    if (isHide)
        bodyEle.style.cssText = "overflow:scroll;overflow-y:hidden;";
    else
        bodyEle.style.cssText = "overflow:scroll;";
}

function calculateFitSize(oriW, oriH, maxW, maxH) {
    let fitW, fitH;

    if (oriW / oriH > maxW / maxH) {
        fitW = Math.min(oriW, maxW);
        fitH = Math.min(Math.round(oriH / oriW * fitW), oriH);
    }
    else {
        fitH = Math.min(oriH, maxH);
        fitW = Math.min(Math.round(oriW / oriH * fitH), oriW);
    }

    return {
        w: fitW,
        h: fitH
    }
}

let storage = {
    set(key, value) {
        if (typeof document != "undefined") {
            document.cookie = "{0}=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT;domain={1}".format(key, document.domain.substr(document.domain.indexOf(".") + 1));
            document.cookie = "{0}={1};path=/;expires=Fri, 31 Dec 9999 23:59:59 GMT;domain={2}".format(key, value || "", document.domain);
        }
    },

    get(key, _this) {
        return readCookie.call(_this || this, key);
    },

    all(_this) {
        return allCookies.call(_this || this);
    }
};

function getDeepValue(path, dataObj){

    let pathArr = path.split(".");

    var tempObj = dataObj;
    for(let i=0; i<pathArr.length;i++){

        let field = pathArr[i];

        if (tempObj[field] == undefined) {
            return undefined;
        } else {
            tempObj = tempObj[field];
        }
    }
    return tempObj;
}

function setDeepValue(value, path, obj){
    let pathArr = path.split(".");

    var tempObj = obj;
    for (var i = 0; i < pathArr.length - 1; i++) {
        let key = pathArr[i];
        tempObj = tempObj[key];
    }
    tempObj[pathArr[i]] = value;

    return obj;
}

function getDiffDay(date){
    let dateTimeStamp = date.replace(/-/g,'/');// ie11 bug, cannot convert datestring which contains '-' ;
    dateTimeStamp = new Date(dateTimeStamp).getTime();

    var now = new Date().getTime();
    var relative = dateTimeStamp - now;

    var day = Math.ceil(relative / 1000 / 60 / 60 / 24);
    
    return day;
}

function getPictureName(src) {
    if (!src) {
        return "";
    }

    let matches = src.match(/([0-9a-f]{32})_(?:png_)?([0-9]{2,5})x([0-9]{2,5})/);
    if (matches && matches.length == 4) {
        return matches[0];
    }
    else {
        return "";
    }
}

function getPictureID(src) {
    if (!src) {
        return "";
    }

    let matches = src.match(/([0-9a-f]{32})_(?:png_)?([0-9]{2,5})x([0-9]{2,5})/);
    if (matches && matches.length == 4) {
        return matches[1];
    }
    else {
        return "";
    }
}


var inquiryStatusArr = [
    "Closed", //已关闭
    "Pending", //待处理
    "In Processing", //制作路书
    "Submitted", //路书已提交
    "Under Revision", //路书待调整
    "Confirmed", //路书已确认
    "status6",
    "status7",
    "status8",
    "Completed" //已完成
];

function getInquiryStatus(status){

    return i18n.gettext(inquiryStatusArr[status]);
    //inquiryStatus int 0 - 已关闭，1 - 待处理，2 - 制作路书，3 - 路书已提交，4 - 路书待调整，5，路书已确认，9，已完成
}

function getInquiryStatusClass(status){
    return "inquiryStatus"+status;
    //inquiryStatus int 0 - 已关闭，1 - 待处理，2 - 制作路书，3 - 路书已提交，4 - 路书待调整，5，路书已确认，9，已完成
}

module.exports = {
    isApple: isApple,
    isAndroid: isAndroid,
    validateEmail: validateEmail,
    validatePhone: validatePhone,
    contentJsonToHtml: contentJsonToHtml,
    hasClass: hasClass,
    addClass: addClass,
    removeClass: removeClass,
    setGetParameter: setGetParameter,
    constructUrl: constructUrl,
    topOfElement: topOfElement,
    windowScrollTop: windowScrollTop,
    elementTop: elementTop,
    smoothScrollTo: smoothScrollTo,
    smoothScrollToInner: smoothScrollToInner,
    calcMapZoom: calcMapZoom,
    calcDistance: calcDistance,
    distanceStr: distanceStr,
    durationStr: durationStr,
    durationStrFull: durationStrFull,
    formatTime: formatTime,
    staticMapUrl: staticMapUrl,
    polylineEncode: polylineEncode,
    buildStaticMapURL: buildStaticMapURL,
    poiTypeClass: poiTypeClass,
    getBounds: getBounds,
    destinationBounds: destinationBounds,
    searchInCityBounds: searchInCityBounds,
    pointInBounds: pointInBounds,
    formatContentJson: formatContentJson,
    constructContentJson: constructContentJson,
    constructContentJsonForShowing: constructContentJsonForShowing,
    findNodesByName: findNodesByName,
    findNodesByClass: findNodesByClass,
    getViewportSize: getViewportSize,
    isCharCode: isCharCode,
    addEventListener: addEventListener,
    removeEventListener: removeEventListener,
    findParent: findParent,
    handleEvents: handleEvents,
    closest: closest,
    parseError: parseError,
    isMobile: isMobile,
    isWechat: isWechat,
    getShareToWeiboUrl: getShareToWeiboUrl,
    readCookie: readCookie,
    focusEnd: focusEnd,
    decodeHtml: decodeHtml,
    formatDateToMonthDay: formatDateToMonthDay,
    getSex: getSex,
    parseDateStr: parseDateStr,
    parseDatetimeStr: parseDatetimeStr,
    addDays: addDays,
    addMonths: addMonths,
    formatDateToDot: formatDateToDot,
    formatDateStr: formatDateStr,
    formatDateToWord: formatDateToWord,
    dateToString: dateToString,
    dateToStringDash: dateToStringDash,
    dateLongValueToString: dateLongValueToString,
    relativeTime: relativeTime,
    getDate: getDate,
    getWeek: getWeek,
    isFloat: isFloat,
    zeroPad: zeroPad,
    extractHrMins: extractHrMins,
    computeHash: computeHash,
    getSearchBounds: getSearchBounds,
    locInBounds: locInBounds,
    storage: storage,
    extractDomain: extractDomain,
    textToContentJSON: textToContentJSON,
    getPrice: getPrice,
    contentJSONToText: contentJSONToText,
    buildImageStyle: buildImageStyle,
    getEleOffset: getEleOffset,
    isNotEmptyJSON: isNotEmptyJSON,
    isNotEmptyStr: isNotEmptyStr,
    getEntityNames: getEntityNames,
    getDisplayName: getDisplayName,
    checkChangedFields: checkChangedFields,
    checkArrayChanged: checkArrayChanged,
    checkSetChanged: checkSetChanged,
    buildCopyName: buildCopyName,
    getDatePickerI18N: getDatePickerI18N,
    groupByCountry: groupByCountry,
    getActualPicture: getActualPicture,
    calculateFitSize: calculateFitSize,
    getDeepValue: getDeepValue,
    setDeepValue: setDeepValue,
    hideYScroll: hideYScroll,
    getDiffDay: getDiffDay,
    getPictureName: getPictureName,
    getPictureID: getPictureID,
    getInquiryStatus: getInquiryStatus,
    getInquiryStatusClass: getInquiryStatusClass,
    dateYearToAge: dateYearToAge,
    dateAgeToYear: dateAgeToYear,
};
