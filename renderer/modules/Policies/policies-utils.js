const { POLICY_TEMPLATES } = require('./policies-constants');

/**
 * Normalisiert Whitespace in SQL-Expressions
 */
function normalizeExpression(expr) {
  if (!expr) return expr;
  return expr.replace(/\s+/g, ' ').trim();
}

/**
 * Prüft ob zwei Objekte gleich sind (tiefe Vergleichung)
 */
function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
      if (
        obj1[key].length !== obj2[key].length ||
        !obj1[key].every((val, idx) => val === obj2[key][idx])
      ) {
        return false;
      }
    } else if (obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Prüft ob Objekt leer ist
 */
function isEmpty(obj) {
  return !obj || Object.keys(obj).length === 0;
}

/**
 * Erstellt SQL für CREATE POLICY
 * @param {PolicyFormField} policyFormFields
 * @returns {PolicyForReview}
 */
function createSQLStatementForCreatePolicy(policyFormFields) {
  const { name, definition, check, command, schema, table } = policyFormFields;
  const roles =
    policyFormFields.roles.length === 0 ? ['public'] : policyFormFields.roles;
  const description = `Add policy for the ${command} operation under the policy "${name}"`;

  const statement = [
    `CREATE POLICY "${name}" ON "${schema}"."${table}"`,
    `AS PERMISSIVE FOR ${command}`,
    `TO ${roles.join(', ')}`,
    definition ? `USING (${definition})` : '',
    check ? `WITH CHECK (${check})` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { description, statement };
}

/**
 * Erstellt SQL für ALTER POLICY (Updates)
 * @param {PolicyFormField} policyFormFields
 * @param {Object} fieldsToUpdate
 * @returns {PolicyForReview}
 */
function createSQLStatementForUpdatePolicy(policyFormFields, fieldsToUpdate) {
  const { name, schema, table } = policyFormFields;

  const definitionChanged = fieldsToUpdate.hasOwnProperty('definition');
  const checkChanged = fieldsToUpdate.hasOwnProperty('check');
  const nameChanged = fieldsToUpdate.hasOwnProperty('name');
  const rolesChanged = fieldsToUpdate.hasOwnProperty('roles');

  const parameters = Object.keys(fieldsToUpdate);
  const description =
    parameters.length === 1
      ? `Update policy's ${parameters[0]}`
      : `Update policy's ${parameters.slice(0, -1).join(', ')} and ${parameters[parameters.length - 1]}`;

  const roles =
    (fieldsToUpdate.roles || []).length === 0
      ? ['public']
      : fieldsToUpdate.roles;

  const alterStatement = `ALTER POLICY "${name}" ON "${schema}"."${table}"`;

  const statements = [
    'BEGIN;',
    ...(definitionChanged
      ? [`  ${alterStatement} USING (${fieldsToUpdate.definition});`]
      : []),
    ...(checkChanged
      ? [`  ${alterStatement} WITH CHECK (${fieldsToUpdate.check});`]
      : []),
    ...(rolesChanged ? [`  ${alterStatement} TO ${roles.join(', ')};`] : []),
    ...(nameChanged
      ? [`  ${alterStatement} RENAME TO "${fieldsToUpdate.name}";`]
      : []),
    'COMMIT;',
  ];

  return { description, statement: statements.join('\n') };
}

/**
 * Generiert SQL für Policy-Erstellung oder -Aktualisierung
 * @param {PolicyFormField} policyFormFields
 * @param {PolicyFormField} [originalPolicyFormFields]
 * @returns {PolicyForReview}
 */
function createSQLPolicy(policyFormFields, originalPolicyFormFields) {
  const { definition, check } = policyFormFields;
  const formattedPolicyFormFields = {
    ...policyFormFields,
    definition: definition
      ? normalizeExpression(definition)
      : definition === undefined
        ? null
        : definition,
    check: check
      ? normalizeExpression(check)
      : check === undefined
        ? null
        : check,
  };

  if (!originalPolicyFormFields || isEmpty(originalPolicyFormFields)) {
    return createSQLStatementForCreatePolicy(formattedPolicyFormFields);
  }

  if (deepEqual(policyFormFields, originalPolicyFormFields)) {
    return {};
  }

  const fieldsToUpdate = {};
  if (!deepEqual(formattedPolicyFormFields.name, originalPolicyFormFields.name)) {
    fieldsToUpdate.name = formattedPolicyFormFields.name;
  }
  if (
    !deepEqual(
      formattedPolicyFormFields.definition,
      originalPolicyFormFields.definition
    )
  ) {
    fieldsToUpdate.definition = formattedPolicyFormFields.definition;
  }
  if (!deepEqual(formattedPolicyFormFields.check, originalPolicyFormFields.check)) {
    fieldsToUpdate.check = formattedPolicyFormFields.check;
  }
  if (!deepEqual(formattedPolicyFormFields.roles, originalPolicyFormFields.roles)) {
    fieldsToUpdate.roles = formattedPolicyFormFields.roles;
  }

  if (!isEmpty(fieldsToUpdate)) {
    return createSQLStatementForUpdatePolicy(
      formattedPolicyFormFields,
      fieldsToUpdate
    );
  }

  return {};
}

/**
 * Erstellt Payload für CREATE POLICY API
 * @param {PolicyFormField} policyFormFields
 * @returns {PostgresPolicyCreatePayload}
 */
function createPayloadForCreatePolicy(policyFormFields) {
  const { command, definition, check, roles } = policyFormFields;
  return {
    ...policyFormFields,
    action: 'PERMISSIVE',
    command: command || undefined,
    definition: definition || undefined,
    check: check || undefined,
    roles: roles.length > 0 ? roles : undefined,
  };
}

/**
 * Erstellt Payload für UPDATE POLICY API
 * @param {PolicyFormField} policyFormFields
 * @param {PolicyFormField} originalPolicyFormFields
 * @returns {PostgresPolicyUpdatePayload}
 */
function createPayloadForUpdatePolicy(
  policyFormFields,
  originalPolicyFormFields
) {
  const { definition, check } = policyFormFields;
  const formattedPolicyFormFields = {
    ...policyFormFields,
    definition: definition ? normalizeExpression(definition) : definition,
    check: check ? normalizeExpression(check) : check,
  };

  const payload = { id: originalPolicyFormFields.id };

  if (!deepEqual(formattedPolicyFormFields.name, originalPolicyFormFields.name)) {
    payload.name = formattedPolicyFormFields.name;
  }
  if (
    !deepEqual(
      formattedPolicyFormFields.definition,
      originalPolicyFormFields.definition
    )
  ) {
    payload.definition = formattedPolicyFormFields.definition || undefined;
  }
  if (!deepEqual(formattedPolicyFormFields.check, originalPolicyFormFields.check)) {
    payload.check = formattedPolicyFormFields.check || undefined;
  }
  if (!deepEqual(formattedPolicyFormFields.roles, originalPolicyFormFields.roles)) {
    if (formattedPolicyFormFields.roles.length === 0) {
      payload.roles = ['public'];
    } else {
      payload.roles = formattedPolicyFormFields.roles || undefined;
    }
  }

  return payload;
}

/**
 * Validiert eine Policy
 * @param {PolicyFormField} policy
 * @returns {{valid: boolean, errors: string[]}}
 */
function validatePolicy(policy) {
  const errors = [];

  if (!policy.name || policy.name.trim().length === 0) {
    errors.push('Policy-Name ist erforderlich');
  }

  if (policy.name && policy.name.length > 63) {
    errors.push('Policy-Name darf max. 63 Zeichen lang sein');
  }

  if (!policy.table || policy.table.trim().length === 0) {
    errors.push('Tabellenname ist erforderlich');
  }

  if (!policy.schema || policy.schema.trim().length === 0) {
    errors.push('Schema ist erforderlich');
  }

  if (!policy.command || policy.command.trim().length === 0) {
    errors.push('SQL-Operation (SELECT, INSERT, etc.) ist erforderlich');
  }

  if (policy.roles.length === 0) {
    errors.push('Mindestens eine Rolle muss zugewiesen sein');
  }

  const command = policy.command?.toUpperCase();
  if (['SELECT', 'UPDATE', 'DELETE'].includes(command)) {
    if (!policy.definition || policy.definition.trim().length === 0) {
      errors.push(
        `USING-Expression ist erforderlich für ${command}-Operation`
      );
    }
  }

  if (['INSERT', 'UPDATE'].includes(command)) {
    if (!policy.check || policy.check.trim().length === 0) {
      errors.push(
        `WITH CHECK-Expression ist erforderlich für ${command}-Operation`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generiert SQL für DROP POLICY
 * @param {string} policyName
 * @param {string} schema
 * @param {string} table
 * @returns {string}
 */
function createSQLStatementForDropPolicy(policyName, schema, table) {
  return `DROP POLICY IF EXISTS "${policyName}" ON "${schema}"."${table}";`;
}

/**
 * Aktiviert RLS auf einer Tabelle
 * @param {string} schema
 * @param {string} table
 * @returns {string}
 */
function createSQLStatementToEnableRLS(schema, table) {
  return `ALTER TABLE "${schema}"."${table}" ENABLE ROW LEVEL SECURITY;`;
}

/**
 * Deaktiviert RLS auf einer Tabelle
 * @param {string} schema
 * @param {string} table
 * @returns {string}
 */
function createSQLStatementToDisableRLS(schema, table) {
  return `ALTER TABLE "${schema}"."${table}" DISABLE ROW LEVEL SECURITY;`;
}

module.exports = {
  createSQLPolicy,
  createPayloadForCreatePolicy,
  createPayloadForUpdatePolicy,
  createSQLStatementForCreatePolicy,
  createSQLStatementForUpdatePolicy,
  createSQLStatementForDropPolicy,
  createSQLStatementToEnableRLS,
  createSQLStatementToDisableRLS,
  validatePolicy,
  normalizeExpression,
  deepEqual,
  isEmpty,
};