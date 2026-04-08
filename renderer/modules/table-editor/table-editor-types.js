/**
 * Table Editor Type Definitions and Utilities
 * Comprehensive type utilities for entities in table editor
 * @module table-editor/table-editor-types
 */

/**
 * Entity type constants
 * @enum {string}
 */
const ENTITY_TYPE = {
  TABLE: 'TABLE',
  PARTITIONED_TABLE: 'PARTITIONED_TABLE',
  VIEW: 'VIEW',
  MATERIALIZED_VIEW: 'MATERIALIZED_VIEW',
  FOREIGN_TABLE: 'FOREIGN_TABLE',
};

/**
 * Foreign data wrapper handler constants
 * @enum {string}
 */
const WRAPPER_HANDLERS = {
  MSSQL: 'mssql_fdw',
  MYSQL: 'mysql_fdw',
  POSTGRES: 'postgres_fdw',
  REDIS: 'redis_fdw',
  ELASTICSEARCH: 'elasticsearch_fdw',
};

/**
 * Check if entity is a regular table
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is a table
 */
function isTable(entity) {
  return entity?.entity_type === ENTITY_TYPE.TABLE;
}

/**
 * Check if entity is a partitioned table
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is a partitioned table
 */
function isPartitionedTable(entity) {
  return entity?.entity_type === ENTITY_TYPE.PARTITIONED_TABLE;
}

/**
 * Check if entity is table-like (Table or PartitionedTable)
 * Foreign tables are not considered table-like
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is table-like
 */
function isTableLike(entity) {
  return isTable(entity) || isPartitionedTable(entity);
}

/**
 * Check if entity is a foreign table
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is a foreign table
 */
function isForeignTable(entity) {
  return entity?.entity_type === ENTITY_TYPE.FOREIGN_TABLE;
}

/**
 * Check if entity is a MS SQL foreign table
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is MS SQL foreign table
 */
function isMsSqlForeignTable(entity) {
  return isForeignTable(entity) && entity.foreign_data_wrapper_handler === WRAPPER_HANDLERS.MSSQL;
}

/**
 * Check if entity is a regular view
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is a view
 */
function isView(entity) {
  return entity?.entity_type === ENTITY_TYPE.VIEW;
}

/**
 * Check if entity is a materialized view
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is a materialized view
 */
function isMaterializedView(entity) {
  return entity?.entity_type === ENTITY_TYPE.MATERIALIZED_VIEW;
}

/**
 * Check if entity is view-like (View or MaterializedView)
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is view-like
 */
function isViewLike(entity) {
  return isView(entity) || isMaterializedView(entity);
}

/**
 * Convert PostgresTable to Entity type
 * Handles conversion with proper error checking
 * @param {Object} table - PostgreSQL table object
 * @returns {Object|undefined} Converted entity or undefined if invalid
 */
function postgresTableToEntity(table) {
  if (table.columns === undefined || table.relationships === undefined) {
    console.error(
      'Unable to convert PostgresTable to Entity type: columns and relationships must not be undefined.'
    );
    return undefined;
  }

  // Map relationships with default action values
  const tableRelationships = table.relationships.map((rel) => ({
    deletion_action: 'a',
    update_action: 'a',
    ...rel,
  }));

  return {
    id: table.id,
    schema: table.schema,
    name: table.name,
    comment: table.comment,
    rls_enabled: table.rls_enabled,
    rls_forced: table.rls_forced,
    replica_identity: table.replica_identity,
    bytes: table.bytes,
    size: table.size,
    live_rows_estimate: table.live_rows_estimate,
    dead_rows_estimate: table.dead_rows_estimate,
    columns: table.columns,
    relationships: tableRelationships,
    primary_keys: table.primary_keys,
    entity_type: ENTITY_TYPE.TABLE,
  };
}

/**
 * Get entity type display name
 * @param {Object} entity - Entity object
 * @returns {string} Human-readable entity type
 */
function getEntityTypeName(entity) {
  const typeNames = {
    [ENTITY_TYPE.TABLE]: 'Table',
    [ENTITY_TYPE.PARTITIONED_TABLE]: 'Partitioned Table',
    [ENTITY_TYPE.VIEW]: 'View',
    [ENTITY_TYPE.MATERIALIZED_VIEW]: 'Materialized View',
    [ENTITY_TYPE.FOREIGN_TABLE]: 'Foreign Table',
  };
  return typeNames[entity?.entity_type] || 'Unknown';
}

/**
 * Check if entity supports certain operations
 * @param {Object} entity - Entity object
 * @returns {Object} Operations support object
 */
function getEntityOperations(entity) {
  const isTableEntity = isTableLike(entity);
  const isViewEntity = isViewLike(entity);
  const isFKTable = isForeignTable(entity);

  return {
    canInsert: isTableEntity,
    canUpdate: isTableEntity,
    canDelete: isTableEntity,
    canTruncate: isTableEntity,
    canAlter: !isViewEntity && !isFKTable,
    canAddColumn: isTableEntity,
    canDropColumn: isTableEntity,
    canCreateIndex: isTableEntity,
    canCreateForeignKey: isTableEntity,
    canEnableRLS: isTableEntity,
    canEnableVacuum: isTableEntity,
  };
}

// Export for ES6 modules
export {
    ENTITY_TYPE,
    WRAPPER_HANDLERS,
    isTable,
    isPartitionedTable,
    isTableLike,
    isForeignTable,
    isMsSqlForeignTable,
    isView,
    isMaterializedView,
    isViewLike,
    postgresTableToEntity,
    getEntityTypeName,
    getEntityOperations,
};
