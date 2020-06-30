'use strict';

/**
 * Keys need to be exact table names. Sub-keys exact column names.
 * We use these keys to check that the version we are updating has that table and column.
 * Otherwise it would be an error that would cause a rollback.
 */

module.exports = {
    query: {
        flow: (bundleSchemaId, targetSchemaId) => `update query set flow = replace(flow::text,'"schemaId": "${bundleSchemaId}"','"schemaId": "${targetSchemaId}"')::jsonb[]`,
        payload: (bundleSchemaId, targetSchemaId) => `
            update query 
               set payload=replace(replace(payload::text, '": "${bundleSchemaId}"', '": "${targetSchemaId}"'), ':${bundleSchemaId}+', ':${targetSchemaId}+')::jsonb`
    },
    mapping: {
        schemaId: (bundleSchemaId, targetSchemaId) => `update mapping set "schemaId"='${targetSchemaId}'`,
        id: (bundleSchemaId, targetSchemaId) => `update mapping set id=replace(id,':${bundleSchemaId}+',':${targetSchemaId}+')`
    },
    field: {
        schemaId: (bundleSchemaId, targetSchemaId) => `update field set "schemaId"='${targetSchemaId}'`,
        mappingPath: (bundleSchemaId, targetSchemaId) => `update field set "mappingPath"=replace("mappingPath",':${bundleSchemaId}+',':${targetSchemaId}+')`,
        id: (bundleSchemaId, targetSchemaId) => `update field set id=replace(id,':${bundleSchemaId}+',':${targetSchemaId}+')`
    },
    code: {
        mappingId: (bundleSchemaId, targetSchemaId) => `update code set "mappingId"= replace("mappingId",':${bundleSchemaId}+',':${targetSchemaId}+')`,
        valueFieldId: (bundleSchemaId, targetSchemaId) => `update code set "valueFieldId"= replace("valueFieldId",':${bundleSchemaId}+',':${targetSchemaId}+')`,
        descriptionFieldId: (bundleSchemaId, targetSchemaId) => `update code set "descriptionFieldId"= replace("descriptionFieldId",':${bundleSchemaId}+',':${targetSchemaId}+')`
    },
    link: {
        defn: (bundleSchemaId, targetSchemaId) => `update link set defn=replace(defn::text, '": "${bundleSchemaId}"', '": "${targetSchemaId}"')::jsonb`,
        id: (bundleSchemaId, targetSchemaId) => `update link set id=replace(id,':${bundleSchemaId}+',':${targetSchemaId}+')`,
        fromId: (bundleSchemaId, targetSchemaId) => `update link set "fromId"=replace("fromId",':${bundleSchemaId}+',':${targetSchemaId}+')`,
        parentId: (bundleSchemaId, targetSchemaId) => `update link set "parentId"=replace("parentId",':${bundleSchemaId}+',':${targetSchemaId}+')`,
        toId: (bundleSchemaId, targetSchemaId) => `update link set "toId"=replace("toId",':${bundleSchemaId}+',':${targetSchemaId}+')`
    },
    suite_mapping: {
        mappingId: (bundleSchemaId, targetSchemaId) => `update suite_mapping set "mappingId"= replace("mappingId",':${bundleSchemaId}+',':${targetSchemaId}+')`
    },
    dataset_field: {
        fieldId: (bundleSchemaId, targetSchemaId) => `update dataset_field set "fieldId"= replace("fieldId",':${bundleSchemaId}+',':${targetSchemaId}+')`
    }

};
