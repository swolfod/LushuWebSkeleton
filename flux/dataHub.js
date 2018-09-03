"use strict";


var _ = require('lodash');
var Immutable = require("immutable");
var immutableStore = require('./immutableStore');


function EntityField(fieldType, options) {
    if (!options)
        options = {};

    return {
        fieldType: fieldType,
        isIdField: options.isIdField
    }
}

function StringField(options) {
    return EntityField("string", options);
}


function BooleanField(options) {
    return EntityField("boolean", options);
}

function IntegerField(options) {
    return EntityField("integer", options);
}

function FloatField(options) {
    return EntityField("float", options);
}

function ArrayField(entityType) {
    return {
        fieldType: [entityType.fieldType]
    }
}

function generateEntityKey(type, id) {
    return type + "-" + id;
}

const PERSISTENT_REFERRER = "PERSISTENT_REFERRER";

class DataHub {
    constructor() {
        this.state = Immutable.fromJS({
            structures: {},
            storage: {},
            dataReferrers: {},
            referringData: {}
        });
    }

    static configStructures(structuresConfig) {
        if (!structuresConfig)
            throw new Error("Must provide data structures.");

        function structuredFieldType(fieldType) {
            if (!fieldType || !_.isObject(fieldType))
                return fieldType;

            if (_.isArray(fieldType))
                return [structuredFieldType(fieldType[0])];

            return _.reduce(fieldType, (objFieldType, childFieldConfig, childField) => {
                objFieldType[childField]  = structuredFieldType(childFieldConfig.fieldType || childFieldConfig);
                return objFieldType;
            }, {});
        }

        let structures = _.reduce(structuresConfig, (structures, config, type) => {
            structures[type] = _.reduce(config, (structure, fieldConfig, fieldName) => {
                structure.dataStructure[fieldName] = structuredFieldType(fieldConfig.fieldType);
                if (!structure.idField && fieldConfig.isIdField)
                    structure.idField = fieldName;

                return structure;
            }, {dataStructure: {}});

            return structures;
        }, {});

        this.state = this.state.set("structures", Immutable.fromJS(structures));
    }

    static dataStructures() {
        return this.state.get("structures");
    }

    static extractId(type, entity) {

        let structureConfig = this.dataStructures().get(type);
        if (!structureConfig)
            throw new Error("Unregistered data type: "+type);

        entity = Immutable.fromJS(entity);


        let idField = structureConfig.get("idField", "id");
        let id = entity.get(idField);
        if (_.isUndefined(id))
            throw new Error("Entity id not found.");

        return id;
    }

    static saveEntity(type, entity, referrer, reset) {
        if (!entity)
            return null;

        let structureConfig = this.dataStructures().get(type);
        if (!structureConfig)
            throw new Error("Unregistered data type: "+type);



        entity = Immutable.fromJS(entity);


        let id = this.extractId(type, entity);

        let entityKey = generateEntityKey(type, id);
        let savedEntity = this.state.get("storage").get(entityKey);
        if (!savedEntity)
            savedEntity = Immutable.Map();

        let referrers = _.isArray(referrer) ? referrer : [referrer];
        let dataReferrers = this.state.get("dataReferrers");
        let entityReferrers = dataReferrers.get(entityKey);
        if (entityReferrers) {
            _.forEach(referrers, referrer => {
                if (!referrer)
                   referrer = PERSISTENT_REFERRER;

                entityReferrers = entityReferrers.set(referrer, true)
            });

            referrers = entityReferrers.reduce((referrers, v, k) => {
                referrers.push(k);
                return referrers;
            }, []);
        }


        entity = this.updateEntity(structureConfig.get("dataStructure"), savedEntity, entity, referrers, reset);
        this.state = this.state.set("storage", this.state.get("storage").set(entityKey, entity));
        this.addReferrer(type, id, referrer);


        return id;
    }

    static updateEntity(dataStructure, target, source, referrer, reset) {
        if (!source)
            return target;

        if (!target || reset)
            target = Immutable.Map();

        let theHub = this;
        function extractFieldValue(fieldType, oriValue, newValue) {
            if (_.isString(fieldType) && theHub.dataStructures().get(fieldType)) {
                try {
                    return theHub.saveEntity(fieldType, newValue, referrer, reset);
                }
                catch(e) {
                    if (newValue === null)
                       return null;

                    let fieldStructure = theHub.dataStructures().get(fieldType).get("dataStructure");
                    return theHub.updateEntity(fieldStructure, oriValue, newValue, referrer, reset);
                }
            }
            else if (_.isObject(fieldType)) {
                if (newValue === null)
                   return null;

                return theHub.updateEntity(fieldType, oriValue, newValue, referrer, reset);
            }
            else
                return newValue
        }

        target = target.withMutations(target => {
            dataStructure.forEach((fieldType, field) => {
                let newValue = source.get(field);

                if (_.isUndefined(newValue))
                    return;

                let oriValue = target.get(field);

                if (Immutable.List.isList(fieldType)) {
                    let newValueArray = newValue ? newValue.reduce((newValueArray, newValueEle) => {
                        newValueArray.push(extractFieldValue(fieldType.get(0), null, newValueEle));
                        return newValueArray;
                    }, []) : newValue;

                    target.set(field, Immutable.List(newValueArray));
                }
                else {
                    target.set(field, extractFieldValue(fieldType, oriValue, newValue));
                }
            });
        });

        return target;
    }

    static addReferrer(type, entity, referrer) {
        let id = _.isObject(entity) ? this.extractId(type, entity) : entity;
        let entityKey = generateEntityKey(type, id);

        let referrers = _.isArray(referrer) ? referrer : [referrer];
        _.forEach(referrers, referrer => {
            if (referrer && referrer != PERSISTENT_REFERRER) {
                let referringData = this.state.get("referringData");
                let referringEntities = referringData.get(referrer);

                if (!referringEntities)
                    referringEntities = Immutable.Map();

                if (!referringEntities.get(entityKey)) {
                    referringEntities = referringEntities.set(entityKey, true);
                    this.state = this.state.set("referringData", referringData.set(referrer, referringEntities));
                }
            }
            else
                referrer = PERSISTENT_REFERRER;

            let dataReferrers = this.state.get("dataReferrers");
            let entityReferrers = dataReferrers.get(entityKey);
            if (!entityReferrers)
                entityReferrers = Immutable.Map();

            if (!entityReferrers.get(referrer)) {
                entityReferrers = entityReferrers.set(referrer, true);
                this.state = this.state.set("dataReferrers", dataReferrers.set(entityKey, entityReferrers));
            }
        });
    }

    static getEntity(type, id, resultStructure, fullFillRequired, optionalFields) {
        if (!type || _.isUndefined(id))
            return;

        let structureConfig = this.dataStructures().get(type);
        if (!structureConfig)
            throw new Error("Unregistered data type: "+type);

        let dataStructure = structureConfig.get("dataStructure");
        let entityKey = generateEntityKey(type, id);
        let savedEntity = this.state.get("storage").get(entityKey);

        if (!resultStructure || !_.isObject(resultStructure)) {
            resultStructure = dataStructure;
            fullFillRequired = false;
        }
        else
            resultStructure = Immutable.fromJS(resultStructure);

        return this.extractData(savedEntity, dataStructure, resultStructure, fullFillRequired, optionalFields);
    }

    static extractData(entity, dataStructure, resultStructure, fullFillRequired, optionalFields) {
        if (_.isUndefined(entity))
            return;

        let result = {};

        let theHub = this;
        function extractFieldData(fieldType, fieldStructure, entityField) {
            if (_.isString(fieldType) && theHub.dataStructures().get(fieldType)) {
                if (_.isString(entityField))
                    return theHub.getEntity(fieldType, entityField, fieldStructure, fullFillRequired);
                else {
                    let dataStructure = theHub.dataStructures().get(fieldType).get("dataStructure");
                    return theHub.extractData(entityField, dataStructure, fieldStructure, fullFillRequired);
                }
            }
            else if (_.isObject(fieldType)) {
                let fieldFullFillRequired = fullFillRequired;

                if (!_.isObject(fieldStructure)) {
                    fieldStructure = fieldType;
                    fieldFullFillRequired = false;
                }

                return theHub.extractData(entityField, fieldType, fieldStructure, fieldFullFillRequired);
            }
            else
                return entityField;
        }

        resultStructure.forEach((fieldStructure, field) => {
            if (!fieldStructure)
                return;

            let entityField = entity.get(field);
            let fieldType = dataStructure.get(field);

            if (entityField) {
                if (Immutable.List.isList(fieldType)) {
                    entityField = entityField.reduce((fieldDataArray, fieldDataEle) => {
                        fieldDataArray.push(extractFieldData(fieldType.get(0), fieldStructure, fieldDataEle));
                        return fieldDataArray;
                    }, []);
                }
                else
                    entityField = extractFieldData(fieldType, fieldStructure, entityField)
            }

            if (_.isUndefined(entityField) && optionalFields && !_.includes(optionalFields, fieldType) && fullFillRequired) {
                console.log("Field missed: " + field);
                result = undefined;
                return false;
            }

            result[field] = entityField;
        });

        return result;
    }

    static clearReferredData(referrer) {
        if (!referrer || referrer == PERSISTENT_REFERRER)
            return;

        let referringData = this.state.get("referringData");
        let dataReferred = referringData.get(referrer);
        if (!dataReferred)
            return;

        referringData = referringData.delete(referrer);
        this.state = this.state.set("referringData", referringData);

        let dataReferrers = this.state.get("dataReferrers");

        dataReferred.forEach((v, entityKey) => {
            let entityReferrers = dataReferrers.get(entityKey);
            if (!entityReferrers)
                return;

            entityReferrers = entityReferrers.delete(referrer);
            if (entityReferrers.size == 0) {
                let storage = this.state.get("storage");
                this.state = this.state.set("storage", storage.delete(entityKey));

                dataReferrers = dataReferrers.delete(entityKey);
            }
            else
                dataReferrers = dataReferrers.set(entityKey, entityReferrers);

            this.state = this.state.set("dataReferrers", dataReferrers);
        });
    }
}

module.exports = {
    DataHub: immutableStore(DataHub),
    EntityField: EntityField,
    StringField: StringField,  
    BooleanField: BooleanField,
    IntegerField: IntegerField,
    FloatField: FloatField,
    ArrayField: ArrayField
};