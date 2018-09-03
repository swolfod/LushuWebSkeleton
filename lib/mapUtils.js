"use strict";


var i18n = require("./i18n");
var utils = require("./utils");
var consts = require("./consts");
var _ = require("lodash");

var geocoder = null;
var directionsService = null;

function geocode(options, successFunc, failFunc) {
    var geoOptions = {address: options.address};
    if (options.bounds) {
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(new google.maps.LatLng(options.bounds.latN, options.bounds.lngE));
        bounds.extend(new google.maps.LatLng(options.bounds.latS, options.bounds.lngW));

        geoOptions.bounds = bounds;
    }

    doGeocode(geoOptions, successFunc, failFunc);
}

function reverseGeocode(options, successFunc, failFunc) {
    let geoOptions = {
        location: {
            lat: options.latitude,
            lng: options.longitude
        }
    };

    if (options.bounds) {
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(new google.maps.LatLng(options.bounds.latN, options.bounds.lngE));
        bounds.extend(new google.maps.LatLng(options.bounds.latS, options.bounds.lngW));

        geoOptions.bounds = bounds;
    }
    
    doGeocode(geoOptions, successFunc, failFunc);
}

function doGeocode(options, successFunc, failFunc) {
    if (!geocoder)
        geocoder = new google.maps.Geocoder();

    geocoder.geocode(options, function (results, status) {
        if (status == google.maps.GeocoderStatus.OK || status == google.maps.GeocoderStatus.ZERO_RESULTS) {
            var geoResults = [];
            if (status == google.maps.GeocoderStatus.OK)
                for (var i = 0; i < results.length; i++) {
                    var result = results[i];
                    geoResults.push({
                        address: result.formatted_address,
                        latitude: result.geometry.location.lat(),
                        longitude: result.geometry.location.lng()
                    });
                }

            successFunc(geoResults);
        } else {
            failFunc(status)
        }
    });
}

function getDirections(options, successFunc, failFunc) {
    if (typeof google == "undefined" || !google.maps || !google.maps.DirectionsService)
       return false;
    
    let TRANSPORT_METHOD = consts.get("TRANSPORT_METHOD");
    let travelMode;
    if (options.transportMethod == TRANSPORT_METHOD.get("PUBLIC_TRANSIT"))
       travelMode = "TRANSIT";
    else if (options.transportMethod == TRANSPORT_METHOD.get("DRIVING"))
       travelMode = "DRIVING";
    else if (options.transportMethod == TRANSPORT_METHOD.get("WALKING"))
       travelMode = "WALKING";
    else
       return setTimeout(() => {successFunc([]);}, 0);

    let origin = new google.maps.LatLng(options.departLocation.latitude, options.departLocation.longitude);
    let destination = new google.maps.LatLng(options.arriveLocation.latitude, options.arriveLocation.longitude);

    let request = {
        origin: origin,
        destination: destination,
        travelMode: travelMode
    };

    if (!directionsService)
        directionsService = new google.maps.DirectionsService();

    directionsService.route(request, function(result, status) {
        if (status == google.maps.GeocoderStatus.OK || status == google.maps.GeocoderStatus.ZERO_RESULTS) {
            var directionResults = [];

            if (status == google.maps.GeocoderStatus.OK) {
                for (var i = 0; i < result.routes.length; i++) {
                    let route = result.routes[i];
                    let bounds = route.bounds;
                    let polyline = route.overview_polyline;
                    let leg = route.legs[0];

                    let distance = leg.distance.value;
                    let duration = Math.ceil(leg.duration.value / 60);

                    let steps = _.map(leg.steps, step => _parseGoogleStep(step));

                    directionResults.push({
                        bounds: bounds,
                        polyline: polyline,
                        distance: distance,
                        duration: duration,
                        startAddress: leg.start_address,
                        startLocation: {
                            latitude: leg.start_location.lat(),
                            longitude: leg.start_location.lng()
                        },
                        endAddress: leg.end_address,
                        endLocation: {
                            latitude: leg.end_location.lat(),
                            longitude: leg.end_location.lng()
                        },
                        steps: steps
                    });
                }
            }

            successFunc(directionResults);
        } else {
            failFunc(status)
        }
    });
}


function _parseGoogleStep(googleStep) {
    let transitStep = {
        distance: googleStep.distance.value,
        duration: Math.ceil(googleStep.duration.value / 60),
        startLocation: {
            latitude: googleStep.start_location.lat(),
            longitude: googleStep.start_location.lng()
        },
        endLocation: {
            latitude: googleStep.end_location.lat(),
            longitude: googleStep.end_location.lng()
        },
        instruction: googleStep.instructions ? googleStep.instructions.replace(/<[^>]+>/g, "") : null,
        mode: googleStep.travel_mode
    };

    if (googleStep.steps)
        transitStep.subSteps = _.map(googleStep.steps, step => _parseGoogleStep(step));

    let transitDetails = googleStep.transit;
    if (transitDetails) {
        transitStep.line = {
            departStop: {
                name: transitDetails.departure_stop.name,
                latitude: transitDetails.departure_stop.location.lat(),
                longitude: transitDetails.departure_stop.location.lng()
            },
            arriveStop: {
                name: transitDetails.arrival_stop.name,
                latitude: transitDetails.arrival_stop.location.lat(),
                longitude: transitDetails.arrival_stop.location.lng()
            },
            directionSign: transitDetails.headsign,
            transitName: ((transitDetails.line.name || "") + " " + (transitDetails.line.short_name || "")).trim(),
            methodName: transitDetails.line.vehicle.name,
            methodCode: transitDetails.line.vehicle.type,
            methodIcon: transitDetails.line.vehicle.icon
        }
    }

    return transitStep;
}

function validateCreatePlace(infoWindow) {
    let placeName = utils.findNodesByName("placeName", infoWindow)[0].value.trim();
    let tag = utils.findNodesByName("placeTag", infoWindow)[0].value.trim();
    let createBtn = utils.findNodesByClass("createPlaceBtn", infoWindow)[0];
    if (placeName && parseInt(tag))
        utils.addClass(createBtn, "active");
    else
        utils.removeClass(createBtn, "active");
}

function createPoiMapProps(locInfo, options) {
    let mapProps = {
        mapDblClicked: options.mapDblClicked,
        overlays: {}
    };

    function placeTagItem(tag, className, title) {
        if ("" + tag == "" + options.presetTag)
            className += " active";

        return "<li value='{0}' class='{1}' title='{2}'></li>".format(tag, className, title);
    }

    let config = {
        key: "createPlaceLoc",
        latitude: locInfo.get("latitude"),
        longitude: locInfo.get("longitude"),
        iconTag: "pin",
        showInfo: true,
        infoConfig: {
            content: (
                "<div class='createPlaceInfo'>" +
                    "<div class='placeInfo'>" +
                        "<div class='placeName'>" +
                            "<input type='text' name='placeName' value='{0}' placeholder='{1}' />" +
                        "</div>" +
                        "<div class='placeAddress'>{2}</div>" +
                        "<ul class='tagsWrap clear{3}'>" +
                            placeTagItem(1, "icon-tag-1-food", i18n.gettext("Food & Drinks")) +
                            placeTagItem(2, "icon-tag-2-hotel", i18n.gettext("Stay")) +
                            placeTagItem(3, "icon-tag-3-traveling", i18n.gettext("Transit")) +
                            placeTagItem(4, "icon-tag-4-tour", i18n.gettext("Views")) +
                            placeTagItem(5, "icon-tag-5-shopping", i18n.gettext("Shopping")) +
                            placeTagItem(6, "icon-tag-6-entertainment", i18n.gettext("Activities")) +
                        "</ul>" +
                        "<input type='hidden' name='placeTag' value='{4}' />" +
                    "</div>" +
                    "<a href='javascript:void(0)' class='btnAddGrey createPlaceBtn'>{5}</a>" +
                "</div>"
            ).format(
               locInfo.get("name") || "",
               i18n.gettext("Type new location name here"),
               locInfo.get("address") || "",
               options.presetTag ? " fixed" : 0,
               options.presetTag || 0,
               i18n.gettext("Add POI")
            ),
            padding: 10,
            backgroundColor: "#fff",
            borderRadius: 5,
            arrowSize: 10,
            wrapperClassName: "createPlaceWrapper",
            minWidth: 320,
            maxWidth: 320,
            infoKeyUp: (function(e) {
                let targetNode = e.target;
                let infoWindow = null;

                while (targetNode) {
                    if (targetNode.className == "createPlaceInfo") {
                        infoWindow = targetNode;
                        break;
                    }

                    targetNode = targetNode.parentElement;
                }

                if (infoWindow)
                    validateCreatePlace(infoWindow);
            }),
            infoClicked: (function(e) {
                if (!e || !e.target)
                    return;

                let targetNode = e.target;
                let createBtnClicked = false, tagClicked = false;
                let infoWindow = null;
                let tagList = null;

                while (targetNode) {
                    if (utils.hasClass(targetNode, "createPlaceBtn") && utils.hasClass(targetNode, "active"))
                        createBtnClicked = true;
                    else if (!options.presetTag && utils.hasClass(targetNode, "tagsWrap")) {
                        tagList = targetNode;
                        tagClicked = true;
                    }
                    else if (targetNode.className == "createPlaceInfo") {
                        infoWindow = targetNode;
                        break;
                    }

                    targetNode = targetNode.parentElement;
                }

                if (!infoWindow)
                    return;

                if (tagClicked) {
                    let tagItem = e.target;

                    while (tagItem && tagItem.tagName && tagItem.tagName.toLowerCase() != "li")
                        tagItem = tagItem.parentElement;

                    if (!tagItem || typeof tagItem.value !== "number" || utils.hasClass(tagItem, "active"))
                        return;

                    _.forEach(tagList.children, node => {
                        utils.removeClass(node, "active");
                    });
                    utils.addClass(tagItem, "active");
                    utils.findNodesByName("placeTag", infoWindow)[0].value = tagItem.value;

                    validateCreatePlace(infoWindow);
                }

                if (createBtnClicked) {
                    let placeName = utils.findNodesByName("placeName", infoWindow)[0].value.trim();
                    let tag = utils.findNodesByName("placeTag", infoWindow)[0].value.trim();

                    options.savePoi(placeName, tag);
                }
            })
        }
    };

    mapProps.overlays.createPlace = { places: [config] };
    mapProps.viewport = {
        zoom: 15,
        center: {
            lat: locInfo.get("latitude"),
            lng: locInfo.get("longitude")
        },
        allowHigherZoom: locInfo.get("moved")
    };

    return mapProps;
}
// source: http://doublespringlabs.blogspot.com.br/2012/11/decoding-polylines-from-google-maps.html
function decodePolyline(encoded){

    // array that holds the points
    var points=[ ];
    var index = 0, len = encoded.length;
    var lat = 0, lng = 0;
    while (index < len) {
        var b, shift = 0, result = 0;
        do {
            b = encoded.charAt(index++).charCodeAt(0) - 63;//finds ascii and substract it by 63
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        var dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        shift = 0;
        result = 0;
        do {
            b = encoded.charAt(index++).charCodeAt(0) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        var dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        
        points.push({latitude:( lat / 1E5),longitude:( lng / 1E5)});
    }
    
    return points;    
}

// The mapping between latitude, longitude and pixels is defined by the web
// mercator projection.
function project(lat, lng) {
    var siny = Math.sin(lat * Math.PI / 180);

    // Truncating to 0.9999 effectively limits latitude to 89.189. This is
    // about a third of a tile past the edge of the world tile.
    siny = Math.min(Math.max(siny, -0.9999), 0.9999);

    return {
        x: 0.5 + lng / 360,
        y: 0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)
    };
}


function maxFittedPoints(points, mapW, mapH, minZoom) {
    let TILE_SIZE = 256;
    
    let projectedPoints = _.map(points, (point, index) => {
        let projectedPoint = project(point.latitude, point.longitude);
        projectedPoint.index = index;
        projectedPoint.weight = typeof point.weight == "number" ? point.weight : 1;
        return projectedPoint;
    });

    let xPoints = _.sortBy(projectedPoints, point => point.x), yPoints = _.sortBy(projectedPoints, point => point.y);

    let leftPoint = 0, maxDist = xPoints[0].x + 1 - xPoints.last().x;
    for (let i = 1; i < xPoints.length; i++) {
        let dist = xPoints[i] - xPoints[i - 1];
        if (dist > maxDist) {
            maxDist = dist;
            leftPoint = i;
        }
    }
    xPoints = xPoints.slice(leftPoint).concat(xPoints.slice(0, leftPoint));
    
    let scale = (1 << minZoom) * TILE_SIZE;
    mapW = mapW / scale;
    mapH = mapH / scale;
    
    if (mapW > 1 && mapH > 1)
       return points;
    
    let xDist = xPoints.last().x - xPoints[0].x, yDist = yPoints.last().y - yPoints[0].y;
    if (xDist < 0)
       xDist += 1;

    if (mapW > xDist && mapH > yDist)
       return points;

    let resultPoints = [], maxWeight = 0;
    for (let xIndex = 0; xIndex < xPoints.length; xIndex++) {
        let left = xPoints[xIndex].x;
        let right = left + mapW;
        if (right > 1)
           right -= 1;

        let candidates = _.filter(yPoints, point => {
            if (right > left)
               return point.x >= left && point.x <= right;
            else
               return point.x >= left || point.x <= right;
        });

        for (let yIndex = 0; yIndex < candidates.length; yIndex++) {
            let top = candidates[yIndex].y;
            let bottom = top + mapH;
            if (bottom > 1)
               bottom = 1;

            let inBoundsPoints = _.filter(candidates, point => point.y >= top && point.y <= bottom);
            let inBoundsWeight = _.reduce(inBoundsPoints, (weight, point) => {
                weight += point.weight;
                return weight;
            }, 0);

            if (inBoundsWeight > maxWeight) {
                resultPoints = inBoundsPoints;
                maxWeight = inBoundsWeight;
            }

            if (inBoundsPoints.length == candidates.length)
               break;
        }
    }

    return _.map(resultPoints, point => points[point.index]);
}


module.exports = {
    geocode: geocode,
    reverseGeocode: reverseGeocode,
    getDirections: getDirections,
    decodePolyline: decodePolyline,
    createPoiMapProps: createPoiMapProps,
    project: project,
    maxFittedPoints: maxFittedPoints
};