'use strict';

const _ = require('lodash');
const { Logger } = require('glib');
const logger = new Logger('schema-name-changer');
const { QueryTypes } = require('sequelize');
const commands = require('./commands');
const P = require('bluebird');


module.exports = async opts => {
    const sequelize = opts.server.app.db.sequelize;
    const monitor   = opts.monitor;

    /**
     * Find the schema name to replace for this datasource in the bundle
     * @param targetDatasourceId
     * @returns {Promise<String>}
     */
    const getBundleSchemaId = async (targetDatasourceId) => {
        //one schema per mapping
        const result = await sequelize.query(`
            SELECT "schemaId"
              FROM mapping 
             WHERE "datasourceId" = :dsId 
               AND "schemaId" IS NOT NULL 
             LIMIT 1`,
            { type: QueryTypes.SELECT,
                replacements: { dsId: targetDatasourceId }
            });
        return _.get(result, [0, 'schemaId']);
    };

    /**
     * Find the replacement schema name for this datasource in the bundle
     * @param targetDatasourceDescriptor
     * @returns {Promise<String>}
     */
    const getTargetSchemaId = async (targetDatasourceDescriptor) => {
        let targetDs;
        if (targetDatasourceDescriptor.assign) {
            //load existing datasource from db
            const dsId = targetDatasourceDescriptor.assign;
            [targetDs] = await sequelize.query(`
                SELECT schemas 
                  FROM public.datasource 
                 WHERE id = :datasourceId
                   AND tenant = :tenant`,
                {
                    type: QueryTypes.SELECT,
                    replacements: {
                        datasourceId: dsId,
                        tenant: opts.tenant
                    }
                });
        } else if (targetDatasourceDescriptor.create) {
            targetDs = targetDatasourceDescriptor.create;
        }
        const schemas = [].concat(_.get(targetDs, ['schemas'], []));
        if (schemas.length > 1) {
            logger.warn(`Target datasource for import has ${schemas.length} schemas. Using first one.`);
        }
        if (schemas.length === 0) {
            logger.warn(`Target datasource for import has no schemas. Not converting.`);
            return null;
        }
        return schemas[0];
    };

    /**
     * Return an iterable that processes commands per table.
     * We do it per table for the monitor messages only, could have been all at once.
     * @param bundleSchemaId
     * @param targetSchemaId
     * @returns {Function}
     */
    const processCommands = (bundleSchemaId, targetSchemaId) => async table => {
        try {
            return P.each(filteredCommands[table], command => {
                const updateSql = command(bundleSchemaId, targetSchemaId);
                logger.debug('update-sql', updateSql);
                sequelize.query(updateSql);
            });
        } catch (e) {
            logger.error(e);
        }
    };


    /**
     * Map function to iterate and process update commands for this datasource in the bundle
     * @param filteredCommands
     * @returns {Function}
     */
    const mapper = (filteredCommands) => async (targetDatasourceDescriptor) => {
        try {
            const targetDatasourceId = targetDatasourceDescriptor.assign || targetDatasourceDescriptor.create.id;
            const targetSchemaId = await getTargetSchemaId(targetDatasourceDescriptor);
            if(!targetSchemaId) {
                logger.debug(`No schema in target datasource ${targetDatasourceId}. Skipping`);
                return;
            }
            const bundleSchemaId = await getBundleSchemaId(targetDatasourceId);
            if(!bundleSchemaId) {
                logger.debug(`No schema in bundle for target datasource ${targetDatasourceId}. Skipping.`);
                return;
            }
            if(targetSchemaId === bundleSchemaId) {
                logger.debug(`Bundle and target schemas are the same for datasource ${targetDatasourceId}. Skipping.`);
                return;
            }
            monitor.progress( { primary: `Updating schemas for local datasource (${bundleSchemaId} -> ${targetSchemaId})`} );
            return P.each(Object.keys(filteredCommands), processCommands(bundleSchemaId, targetSchemaId));
        } catch (err) {
            logger.error('Could not change schema ids in bundle', err);
            throw err;
        }
    };

    /**
     * Double check that a command can be processed. If the column it is processing is not present, omit it
     * @returns {Promise<*>}
     */
    const filterCommands = async () => {
        //get column names and table names so we omit issuing updates to objects that aren't there
        const result = await sequelize.query(`
            SELECT  t."table_name" AS table_name, 
                    ARRAY(SELECT column_name::text 
                            FROM information_schema.columns c 
                           WHERE c.table_name = t.table_name
                    ) AS columns 
               FROM information_schema.tables t 
              WHERE t.table_schema = current_schema`,
            { type: QueryTypes.SELECT });
        //reduce to reference object
        const schemaObjects = result.reduce((a, v) => _.set(a, [v.table_name], v.columns),{});
        //filter commands to omit nonexitsent tables
        return _.reduce(commands, (filteredCommands, columnObj, tableName) => {
            //if the table is in our temp schema
            if (_.has(schemaObjects, tableName)) {
                //only include commands that have a key that matches a column name
                filteredCommands[tableName] = _.filter(columnObj, (v, k) => _.contains(schemaObjects[tableName], k));
            }
            return filteredCommands;
        }, {});
    };
    /**
     *
     */
    //get a compatible list of commands to run
    const filteredCommands = await filterCommands();
    //run commands for each datasource in the bundle
    return P.each(Object.values(opts.datasources), mapper(filteredCommands));
};
