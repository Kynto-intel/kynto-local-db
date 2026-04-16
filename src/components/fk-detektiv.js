class FKManager {
  constructor(db) {
    this.db = db; // Deine PGlite Instanz
  }

  /**
   * SCHRITT 1: Findet heraus, ob eine Spalte ein Foreign Key ist.
   * Gibt Ziel-Tabelle und Ziel-Spalte zurück oder null.
   */
  async getFKTarget(tableName, columnName) {
    const sql = `
      SELECT
          ccu.table_name AS target_table,
          ccu.column_name AS target_column
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = $1
        AND kcu.column_name = $2;
    `;
    
    const res = await this.db.query(sql, [tableName, columnName]);
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * SCHRITT 2: Sucht in der Ziel-Tabelle nach Werten.
   * Bewältigt die 100.000 Einträge durch schnelles Filtering & Limit.
   */
  async searchInTarget(targetTable, targetColumn, searchTerm) {
    // Wir finden erst eine Spalte, die für Menschen lesbar ist (z.B. 'name')
    const displayCol = await this._getDisplayColumn(targetTable);

    const sql = `
      SELECT ${targetColumn} AS id, ${displayCol} AS label
      FROM ${targetTable}
      WHERE ${displayCol}::text ILIKE $1 
         OR ${targetColumn}::text ILIKE $1
      ORDER BY 
        CASE WHEN ${displayCol}::text ILIKE $2 THEN 0 ELSE 1 END, -- Exakte Treffer zuerst
        ${displayCol} ASC
      LIMIT 20;
    `;

    const res = await this.db.query(sql, [`%${searchTerm}%`, searchTerm]);
    return res.rows;
  }

  // Hilfsfunktion: Findet eine "schöne" Spalte zum Anzeigen
  async _getDisplayColumn(table) {
    const res = await this.db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1`, [table]);
    
    const cols = res.rows.map(r => r.column_name.toLowerCase());
    const candidates = ['name', 'username', 'email', 'title', 'label', 'last_name', 'beschreibung'];
    
    return candidates.find(c => cols.includes(c)) || cols[0];
  }
}