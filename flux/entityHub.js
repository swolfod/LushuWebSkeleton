"use strict";


var Immutable = require("immutable");
var _ = require("lodash");


class EntityHub {
    constructor(options, type, briefStructure, detailStructure, optionalFields, fullFillRequired) {
        this.app = options.app;

        this.type = type;
        this.briefStructure = briefStructure;
        this.detailStructure = detailStructure;
        this.optionalFields = optionalFields || [];
        this.fullFillRequired = fullFillRequired || false;
    }

    saveEntities(entities, referrer) {

        if (!entities)
            return;

        if (!_.isArray(entities))
            entities = [entities];


        for (let entity of entities)
            this.saveEntity(entity, referrer);
    }

    saveEntity(entity, referrer) {
        if (!entity)
            return;

        this.app.hubStorage.saveEntity(this.type, entity, referrer);
    }

    getEntitiesBrief(entityIds, referrer) {
        let entities = [];
        entityIds = Immutable.List(entityIds);

        entityIds.forEach(entityId => {
            let entity = this.app.hubStorage.getEntity(this.type, entityId, this.briefStructure, this.fullFillRequired, this.optionalFields);


            if (_.isUndefined(entity)) {
                entities = undefined;
                return false;
            }

            entities.push(entity);
        });

        if (entities && entities.length > 0) {
            entityIds.forEach(entityId => {
                this.app.hubStorage.addReferrer(this.type, entityId, referrer);
            })
        }

        return Immutable.fromJS(entities);
    }

    getEntityBrief(entityId, referrer) {

        let entity = this.app.hubStorage.getEntity(this.type, entityId, this.briefStructure, this.fullFillRequired, this.optionalFields);
        if (entity)
            this.app.hubStorage.addReferrer(this.type, entityId, referrer);

        return Immutable.fromJS(entity);
    }

    getEntityDetails(entityId, referrer) {
        let entity = this.app.hubStorage.getEntity(this.type, entityId, this.detailStructure, this.fullFillRequired, this.optionalFields);
        if (entity)
            this.app.hubStorage.addReferrer(this.type, entityId, referrer);

        return Immutable.fromJS(entity);
    }

    getEntitiesDetails(entityIds, referrer) {

        let entities = [];
        entityIds = Immutable.List(entityIds);

        entityIds.forEach(entityId => {
            let entity = this.app.hubStorage.getEntity(this.type, entityId, this.detailStructure, this.fullFillRequired, this.optionalFields);


            if (_.isUndefined(entity)) {
                entities = undefined;
                return false;
            }

            entities.push(entity);
        }, []);


        if (entities && entities.length > 0) {
            entityIds.forEach(entityId => {
                this.app.hubStorage.addReferrer(this.type, entityId, referrer);
            })
        }

        return Immutable.fromJS(entities);
    }
}

module.exports = EntityHub;