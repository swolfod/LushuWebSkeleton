"use strict";

var _ = require("lodash");
var fetch = require("isomorphic-fetch");
//var getFakeData = require("./fakeData");

var accepts = {
  html: 'text/html',
  text: 'text/plain',
  json: 'application/json',
  xml: 'application/xml, text/xml',
  script: 'text/javascript, application/javascript, application/x-javascript'
};

var CONTENT_TYPE = 'Content-Type';
var JSON_CONTENT_TYPE = 'application/json';

var HEADERS_TO_IGNORE = [
    'accept',
    'accept-encoding',
    'host',
    'connection'
];


function fixHeaders(headers) {
    var result = {};
    for(var i in headers) {
        var name = normalizeName(i);
        result[name] = normalizeValue(headers[i]);
    }

    return result;
}

function normalizeName(name) {
    if (typeof name !== 'string') {
        name = String(name)
    }

    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
        throw new TypeError('Invalid character in header field name')
    }

    return name.toLowerCase()
}

function normalizeValue(value) {
    if (typeof value !== 'string') {
        value = String(value)
    }

    return value
}

class ApiSource {
    constructor(options) {
        if (!options) options = {};
        this._app = options.app || {};
        this._baseUrl = options.apiBaseUrl || '';
    }

    addHooks(req) {

        let app = this._app;

        function getBaseUrl(req) {
            return req.protocol + '://' + req.get('host');
        }

        function headers() {
            return _.omit(fixHeaders(app.req.headers), HEADERS_TO_IGNORE);
        }
        
        if (app && app.req) {
            // Don't change fully qualified urls
            if (!/^https?:\/\//.test(req.url)) {
                req.url = getBaseUrl(app.req) + req.url;
            }
    
            req.headers = fixHeaders(req.headers);
    
            // Add all headers from original request
            _.extend(req.headers, headers());
    
            req.headers = _.omit(req.headers, ['content-length']);
        }

        // Enable sending Cookies for authentication.
        // Ref: https://fetch.spec.whatwg.org/#concept-request-credentials-mode
        req.credentials = 'same-origin';

        if (typeof FormData == 'undefined' || !(req.body instanceof FormData)) {
            var contentType = req.headers[CONTENT_TYPE] || JSON_CONTENT_TYPE;

            if (contentType === JSON_CONTENT_TYPE && _.isObject(req.body)) {
              req.body = JSON.stringify(req.body);
              req.headers[CONTENT_TYPE] = JSON_CONTENT_TYPE;
            }
        }
    }

    request(req) {
        if (!req.headers) {
            req.headers = {};
        }
        
        this.addHooks(req);
        
        return fetch(req.url, req);
    }

    requestOptions(method, options) {
      var baseUrl = this._baseUrl || '';

      if (_.isString(options)) {
        options = _.extend({
          url: options
        });
      }

      _.defaults(options, {
        headers: {}
      });

      options.method = method.toUpperCase();

      if (baseUrl && !_.startsWith(options.url, "http")) {
        var separator = '';
        var firstCharOfUrl = options.url[0];
        var lastCharOfBaseUrl = baseUrl[baseUrl.length - 1];

        if (lastCharOfBaseUrl !== '/' && firstCharOfUrl !== '/') {
          separator = '/';
        } else if (lastCharOfBaseUrl === '/' && firstCharOfUrl === '/') {
          options.url = options.url.substring(1);
        }

        options.url = baseUrl + separator + options.url;
      }

      if (options.contentType) {
        options.headers['Content-Type'] = options.contentType;
      }

      if (options.dataType) {
        var contentType = accepts[options.dataType];

        if (!contentType) {
          console.warn('Unknown data type ' + options.dataType);
        } else {
          options.headers['Accept'] = contentType;
        }
      }

      return options;
    }


    /********************** Api Methods **********************
     * The following are helpers that are either set by MediumEditor
     * during initialization, or are helper methods which either
     * route calls to the MediumEditor instance or provide common
     * functionality for all extensions
     *********************************************************/


    parseResponse(response) {
        var result = response.result;

        if (!response.success)
            throw {
                error: result.errMsg,
                errorCode: result.errCode
            };

        return result;
    }

    resolveApiPromise(apiPromise) {
        let that = this;

        return apiPromise.catch(function (e){
            throw {
                error: e,
                errorCode: 255
            };
        }).then(function(response) {
            if (response.status < 400)
                return response.json().then(function(json) {
                    return {
                        statusCode: response.status,
                        content: json
                    };
                });
            else {
                let errorCode = response.status;
                return response.text().then(function(errMsg) {
                    try {
                        errMsg = JSON.parse(errMsg);
                    }
                    catch(error) {}

                    throw {
                        error: errMsg.detail || errMsg,
                        errorCode: errorCode
                    };
                });
            }
        }).then(function(response) {
            if (response.statusCode < 400)
                return that.parseResponse(response.content);
            else
                throw {
                    error: response.content.detail,
                    errorCode: response.statusCode
                };
        });
    }

    constructGetParams(options, paramNames) {
        if (!options || !paramNames)
            return "";
    
        var getParams = "";
        for (var i = 0; i < paramNames.length; i++) {
            var paramVal = options[paramNames[i]];
            if (!_.isUndefined(paramVal) && paramVal !== null)
                getParams += (getParams ? "&" : "") + paramNames[i] + "=" + encodeURIComponent(paramVal);
        }
    
        return getParams;
    }
    
    constructQueryUrl(baseUrl, options, paramNames) {
        var params = this.constructGetParams(options, paramNames);
        if (params)
            baseUrl += "?" + params;

        return baseUrl;
    }
    
    constructHeaders(pageName, method) {
        if (typeof localStorage == "undefined")
            return {};
    
        let headers = {
            'Accept': 'application/json'
        };
    
        let token = localStorage.getItem("userToken");
        let userId = localStorage.getItem("userId");

        let apiAccess = this._app.apiAccess || {};
        let requireTokenPaths = apiAccess.requireTokenPaths || {};
    
        if (pageName && requireTokenPaths[pageName] && token &&
           (requireTokenPaths[pageName] === true || (method && requireTokenPaths[pageName].indexOf(method) >= 0))) {
                headers["Authorization"] = "Token " + token;
        }
        else if (userId)
            headers["Authorization"] = "id " + userId;
    
        return headers;
    }

    constructApiUrl(pageName, formatPar) {

        let apiAccess = this._app.apiAccess || {};
        let paths = apiAccess.paths || {};
        var pageUrl = paths[pageName];
        if (formatPar)
            pageUrl = pageUrl.format(...formatPar);
        return pageUrl;
    }


    apiGet(options) {
        if (_.isString(options))
            options = { pageName: options };

        var url = this.constructApiUrl(options.pageName, options.formatPar);

        if (options.data && options.paramNames)
            url = this.constructQueryUrl(url, options.data, options.paramNames);

        return this.resolveApiPromise(this.request(this.requestOptions('GET', {
            url: url,
            headers: this.constructHeaders(options.pageName, "get")
        })));
    }

    apiPost(options) {
        if (_.isString(options))
            options = { pageName: options };

        var url = this.constructApiUrl(options.pageName, options.formatPar);
        return this.resolveApiPromise(this.request(this.requestOptions('POST', {
            url: url,
            headers: this.constructHeaders(options.pageName, "post"),
            body: options.data
        })));
    }

    apiPut(options) {
        if (_.isString(options))
            options = { pageName: options };

        var url = this.constructApiUrl(options.pageName, options.formatPar);

        return this.resolveApiPromise(this.request(this.requestOptions('PUT', {
            url: url,
            headers: this.constructHeaders(options.pageName, "put"),
            body: options.data
        })));
    }

    apiDelete(options) {
        if (_.isString(options))
            options = { pageName: options };

        var url = this.constructApiUrl(options.pageName, options.formatPar);
        return this.resolveApiPromise(this.request(this.requestOptions('DELETE', {
            url: url,
            headers: this.constructHeaders(options.pageName, "delete"),
            body: options.data
        })));
    }
}

module.exports = ApiSource;