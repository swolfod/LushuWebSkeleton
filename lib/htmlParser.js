"use strict";

//https://github.com/blowsie/Pure-JavaScript-HTML5-Parser

// Regular Expressions for parsing tags and attributes
var startTag = /^<([-A-Za-z0-9_]+)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
    endTag = /^<\/([-A-Za-z0-9_]+)[^>]*>/,
    attr = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;

// Empty Elements - HTML 5
var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,link,meta,param,embed,command,keygen,source,track,wbr");

// Block Elements - HTML 5
var block = makeMap("address,article,applet,aside,audio,blockquote,button,canvas,center,dd,del,dir,div,dl,dt,fieldset,figcaption,figure,footer,form,frameset,h1,h2,h3,h4,h5,h6,header,hgroup,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,output,p,pre,section,script,table,tbody,td,tfoot,th,thead,tr,ul,video");

// Inline Elements - HTML 5
var inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var");

// Elements that you can, intentionally, leave open
// (and which close themselves)
var closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");

// Attributes that have their values filled in disabled="disabled"
var fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected");

// Special Elements (can contain anything)
var special = makeMap("script,style");

var HTMLParser = function (html, handler) {
    var index, chars, match, stack = [], last = html;
    stack.last = function () {
        return this[this.length - 1];
    };

    while (html) {
        chars = true;

        // Make sure we're not in a script or style element
        if (!stack.last() || !special[stack.last()]) {

            // Comment
            if (html.indexOf("<!--") == 0) {
                index = html.indexOf("-->");

                if (index >= 0) {
                    if (handler.comment)
                        handler.comment(html.substring(4, index));
                    html = html.substring(index + 3);
                    chars = false;
                }

                // end tag
            } else if (html.indexOf("</") == 0) {
                match = html.match(endTag);

                if (match) {
                    html = html.substring(match[0].length);
                    match[0].replace(endTag, parseEndTag);
                    chars = false;
                }

                // start tag
            } else if (html.indexOf("<") == 0) {
                match = html.match(startTag);

                if (match) {
                    html = html.substring(match[0].length);
                    match[0].replace(startTag, parseStartTag);
                    chars = false;
                }
            }

            if (chars) {
                index = html.indexOf("<");

                var text = index < 0 ? html : html.substring(0, index);
                html = index < 0 ? "" : html.substring(index);

                if (handler.chars)
                    handler.chars(text);
            }

        } else {
            html = html.replace(new RegExp("([\\s\\S]*?)<\/" + stack.last() + "[^>]*>"), function (all, text) {
                text = text.replace(/<!--([\s\S]*?)-->|<!\[CDATA\[([\s\S]*?)]]>/g, "$1$2");
                if (handler.chars)
                    handler.chars(text);

                return "";
            });

            parseEndTag("", stack.last());
        }

        if (html == last)
            throw "Parse Error: " + html;
        last = html;
    }

    // Clean up any remaining tags
    parseEndTag();

    function parseStartTag(tag, tagName, rest, unary) {
        tagName = tagName.toLowerCase();

        if (block[tagName]) {
            while (stack.last() && inline[stack.last()]) {
                parseEndTag("", stack.last());
            }
        }

        if (closeSelf[tagName] && stack.last() == tagName) {
            parseEndTag("", tagName);
        }

        unary = empty[tagName] || !!unary;

        if (!unary)
            stack.push(tagName);

        if (handler.start) {
            var attrs = [];

            rest.replace(attr, function (match, name) {
                var value = arguments[2] ? arguments[2] :
                    arguments[3] ? arguments[3] :
                    arguments[4] ? arguments[4] :
                    fillAttrs[name] ? name : "";

                attrs.push({
                    name: name,
                    value: value,
                    escaped: value.replace(/(^|[^\\])"/g, '$1\\\"') //"
                });
            });

            if (handler.start)
                handler.start(tagName, attrs, unary);
        }
    }

    function parseEndTag(tag, tagName) {
        // If no tag name is provided, clean shop
        if (!tagName)
            var pos = 0;

            // Find the closest opened tag of the same type
        else
            for (var pos = stack.length - 1; pos >= 0; pos--)
                if (stack[pos] == tagName)
                    break;

        if (pos >= 0) {
            // Close all the open elements, up the stack
            for (var i = stack.length - 1; i >= pos; i--)
                if (handler.end)
                    handler.end(stack[i]);

            // Remove the open elements from the stack
            stack.length = pos;
        }
    }
};

function HTMLtoXML(html) {
    var results = "";

    HTMLParser(html, {
        start: function (tag, attrs, unary) {
            results += "<" + tag;

            for (var i = 0; i < attrs.length; i++)
                results += " " + attrs[i].name + '="' + attrs[i].escaped + '"';
            results += ">";
        },
        end: function (tag) {
            results += "</" + tag + ">";
        },
        chars: function (text) {
            results += text;
        },
        comment: function (text) {
            results += "<!--" + text + "-->";
        }
    });

    return results;
}

function HTMLtoDOM(html, doc) {
    // There can be only one of these elements
    var one = makeMap("html,head,body,title");

    // Enforce a structure for the document
    var structure = {
        link: "head",
        base: "head"
    };

    if (!doc) {
        if (typeof DOMDocument != "undefined")
            doc = new DOMDocument();
        else if (typeof document != "undefined" && document.implementation && document.implementation.createDocument)
            doc = document.implementation.createDocument("", "", null);
        else if (typeof ActiveX != "undefined")
            doc = new ActiveXObject("Msxml.DOMDocument");

    } else
        doc = doc.ownerDocument ||
            doc.getOwnerDocument && doc.getOwnerDocument() ||
            doc;

    var elems = [],
        documentElement = doc.documentElement ||
            doc.getDocumentElement && doc.getDocumentElement();

    // If we're dealing with an empty document then we
    // need to pre-populate it with the HTML document structure
    if (!documentElement && doc.createElement) (function () {
        var html = doc.createElement("html");
        var head = doc.createElement("head");
        head.appendChild(doc.createElement("title"));
        html.appendChild(head);
        html.appendChild(doc.createElement("body"));
        doc.appendChild(html);
    })();

    // Find all the unique elements
    if (doc.getElementsByTagName)
        for (var i in one)
            one[i] = doc.getElementsByTagName(i)[0];

    // If we're working with a document, inject contents into
    // the body element
    var curParentNode = one.body;

    HTMLParser(html, {
        start: function (tagName, attrs, unary) {
            // If it's a pre-built element, then we can ignore
            // its construction
            if (one[tagName]) {
                curParentNode = one[tagName];
                if (!unary) {
                    elems.push(curParentNode);
                }
                return;
            }

            var elem = doc.createElement(tagName);

            for (var attr in attrs)
                elem.setAttribute(attrs[attr].name, attrs[attr].value);

            if (structure[tagName] && typeof one[structure[tagName]] != "boolean")
                one[structure[tagName]].appendChild(elem);

            else if (curParentNode && curParentNode.appendChild)
                curParentNode.appendChild(elem);

            if (!unary) {
                elems.push(elem);
                curParentNode = elem;
            }
        },
        end: function (tag) {
            elems.length -= 1;

            // Init the new parentNode
            curParentNode = elems[elems.length - 1];
        },
        chars: function (text) {
            curParentNode.appendChild(doc.createTextNode(text));
        },
        comment: function (text) {
            // create comment node
        }
    });

    return doc;
}

function makeMap(str) {
    var obj = {}, items = str.split(",");
    for (var i = 0; i < items.length; i++)
        obj[items[i]] = true;
    return obj;
}

function html2json(html) {
  // Inline Elements - HTML 4.01
  var inline = makeMap('a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var');
  // but I want to handle some tag like block tag
  inline.textarea = false;
  inline.input = false;
  inline.img = false;

  html = html.replace(/<!DOCTYPE[\s\S]+?>/, '');

  var bufArray = [];
  var results = [];
  bufArray.last = function() {
    return this[ this.length - 1];
  };
  HTMLParser(html, {
    start: function(tag, attrs, unary) {
        var buf = {}; // buffer for single tag
        buf.tag = tag;
        if (attrs.length !== 0) {
          var attr = {};
          for (var i = 0; i < attrs.length; i++) {
            var attr_name = attrs[i].name;
            var attr_value = attrs[i].value;
            if (attr_name === 'class') {
              attr_value = attr_value.split(' ');
            }
            attr[attr_name] = attr_value;
          }
          buf['attr'] = attr;
        }
        if (unary) {
          // if this tag don't has end tag
          // like <img src="hoge.png"/>
          // add last parents
          var last = bufArray.last();
          if (last) {
              if (!(last.children instanceof Array)) {
                last.children = [];
              }
              last.children.push(buf);
          } else {
            results.push(buf);
          }
        } else {
          bufArray.push(buf);
        }
    },
    end: function(tag) {
        var buf = bufArray.pop();
        if (bufArray.length === 0) {
          return results.push(buf);
        }
        var last = bufArray.last();
        if (!(last.children instanceof Array)) {
          last.children = [];
        }
        last.children.push(buf);
    },
    chars: function(text) {
        var last = bufArray.last();
        if (last) {
            if (last.tag && block[last.tag] && !text.trim())
                return;

            if (!(last.children instanceof Array)) {
                last.children = [];
            }
            last.children.push(text);
        } else {
            var buf = {};
            buf.tag = 'p';
            buf.children = [text]
            results.push(buf);
        }
    },
    comment: function(text) {
      // results += "<!--" + text + "-->";
    }
  });
  return results;
}

function json2html(json) {

    if (!json)
        return '';

    if (!(json instanceof Array))
        json = [json];

    // Empty Elements - HTML 5
    var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,link,meta,param,embed,command,keygen,source,track,wbr");
    var html = '';

    for (var i = 0; i < json.length; i++) {
        var ele = json[i];

        if (typeof ele == "string") {
            html += ele;
            continue;
        }

        var tag = ele.tag;
        var children = ele.children;
        var buf = [];

        var buildAttr = function(attr) {
        for (var k in attr) {
            buf.push(' ' + k + '="');
            if (attr[k] instanceof Array) {
                buf.push(attr[k].join(' '));
            } else {
                buf.push(attr[k]);
            }
                buf.push('"');
            }
        };

        buf.push('<');
        buf.push(tag);
        ele.attr ? buf.push(buildAttr(ele.attr)) : null;
        if (empty[tag]) buf.push('/');
            buf.push('>');
        if (children) {
            buf.push(json2html(children));
        }
        if (!empty[tag]) buf.push('</' + tag + '>');
            html += buf.join('');
    }

    return html;
}

module.exports = {
    json2html: json2html,
    html2json: html2json,
    isBlockTag: function(tag) {return tag && block[tag]},
    isInlineTag: function(tag) {return tag && inline[tag]}
};