/**
 * @typedef {Object} PolicyFormField
 * @property {number} [id]
 * @property {string} name
 * @property {string} schema
 * @property {string} table
 * @property {number} [table_id]
 * @property {'SELECT'|'INSERT'|'UPDATE'|'DELETE'|'ALL'|null} command
 * @property {string|null} check
 * @property {string|null} definition
 * @property {string[]} roles
 */

/**
 * @typedef {Object} PolicyForReview
 * @property {string} [description]
 * @property {string} [statement]
 */

/**
 * @typedef {Object} PostgresPolicyCreatePayload
 * @property {string} name
 * @property {string} table
 * @property {string} [schema]
 * @property {string} [definition]
 * @property {string} [check]
 * @property {'PERMISSIVE'|'RESTRICTIVE'} [action]
 * @property {'SELECT'|'INSERT'|'UPDATE'|'DELETE'|'ALL'} [command]
 * @property {string[]} [roles]
 */

/**
 * @typedef {Object} PostgresPolicyUpdatePayload
 * @property {number} id
 * @property {string} [name]
 * @property {string} [definition]
 * @property {string} [check]
 * @property {string[]} [roles]
 */

/**
 * @typedef {Object} GeneratedPolicy
 * @property {string} name
 * @property {string} table
 * @property {string} schema
 * @property {'PERMISSIVE'|'RESTRICTIVE'} action
 * @property {string[]} roles
 * @property {'SELECT'|'INSERT'|'UPDATE'|'DELETE'|'ALL'} [command]
 * @property {string} [definition]
 * @property {string} [check]
 * @property {string} sql
 */

/**
 * @typedef {Object} PolicyTemplate
 * @property {string} id
 * @property {boolean} preview
 * @property {string} templateName
 * @property {string} description
 * @property {string} name
 * @property {string} statement
 * @property {string} definition
 * @property {string} check
 * @property {'SELECT'|'INSERT'|'UPDATE'|'DELETE'|'ALL'} command
 * @property {string[]} roles
 */

module.exports = {
  // Types nur für JSDoc-Dokumentation exportieren
};