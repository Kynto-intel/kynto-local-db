/**
 * ForeignRowSelector - Vereinfachte React-Komponente für die Auswahl von Foreign Key Rows
 * Mit Pagination, Suche und Filterung
 */

const ForeignRowSelector = ({
    visible = false,
    foreignKey = null,
    tableName = null,
    columnName = null,
    selectedValue = null,
    onSelect = () => {},
    onClose = () => {}
}) => {
    const [rows, setRows] = React.useState([]);
    const [filterText, setFilterText] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [pageSize] = React.useState(10);
    const [loading, setLoading] = React.useState(false);
    const [displayColumn, setDisplayColumn] = React.useState(null);

    if (!visible || !foreignKey) return null;

    const { table: fkTableName, columns: fkColumns } = foreignKey;

    // ═══════════════════════════════════════════════════════════════════════════
    // Load Foreign Key Rows
    // ═══════════════════════════════════════════════════════════════════════════
    React.useEffect(() => {
        if (!visible || !fkTableName) return;

        setLoading(true);
        (async () => {
            try {
                // Query foreign key table
                const state = window.app?.state || { activeDbId: null, dbMode: 'pglite', serverConnectionString: null };
                const isRemote = state.dbMode === 'remote' && state.serverConnectionString;

                const sql = `SELECT * FROM "${fkTableName}" LIMIT 1000`;

                const result = isRemote
                    ? await window.api.serverQuery(state.serverConnectionString, sql, [])
                    : await window.api.query(sql, state.activeDbId);

                setRows(result || []);

                // Detect display column (first non-ID column)
                if (result && result.length > 0) {
                    const keys = Object.keys(result[0]);
                    const displayCol = keys.find(k => !k.includes('id')) || keys[0];
                    setDisplayColumn(displayCol);
                }
            } catch (e) {
                console.error('[ForeignRowSelector] Load error:', e);
                alert('Fehler beim Laden der Foreign Key Daten: ' + e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [visible, fkTableName]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Filter & Paginate
    // ═══════════════════════════════════════════════════════════════════════════
    const getFilteredRows = () => {
        if (!filterText.trim()) return rows;

        return rows.filter(row => {
            const text = Object.values(row)
                .map(v => String(v || '').toLowerCase())
                .join(' ');
            return text.includes(filterText.toLowerCase());
        });
    };

    const filteredRows = getFilteredRows();
    const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
    const totalPages = Math.ceil(filteredRows.length / pageSize);

    const fkTargetColumn = fkColumns?.[0]?.target || 'id';
    const displayColumnName = displayColumn || (fkColumns?.[0]?.target || (rows.length > 0 ? Object.keys(rows[0])[0] : 'id'));

    // ═══════════════════════════════════════════════════════════════════════════
    // Render: Table
    // ═══════════════════════════════════════════════════════════════════════════
    const renderTable = () => {
        if (loading) {
            return <div style={{ textAlign: 'center', padding: '40px' }}>⏳ Lade Daten...</div>;
        }

        if (rows.length === 0) {
            return <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Keine Daten verfügbar</div>;
        }

        if (paginatedRows.length === 0) {
            return (
                <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#666'
                }}>
                    Keine Ergebnisse für "{filterText}"
                </div>
            );
        }

        const columns = displayColumn ? [displayColumnName, fkTargetColumn].filter((c, i, a) => a.indexOf(c) === i) : [fkTargetColumn];

        return (
            <div style={{ overflowX: 'auto' }}>
                <table style={{
                    width: '100%',
                    fontSize: '13px',
                    borderCollapse: 'collapse'
                }}>
                    <thead>
                        <tr style={{
                            backgroundColor: '#f0f0f0',
                            borderBottom: '2px solid #ddd'
                        }}>
                            <th style={{
                                padding: '8px',
                                textAlign: 'left',
                                fontWeight: 'bold',
                                width: '30px'
                            }}>
                                ✓
                            </th>
                            {columns.map(col => (
                                <th key={col} style={{
                                    padding: '8px',
                                    textAlign: 'left',
                                    fontWeight: 'bold',
                                    maxWidth: '200px'
                                }}>
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.map((row, idx) => {
                            const rowKey = row[fkTargetColumn];
                            const isSelected = selectedValue === rowKey;

                            return (
                                <tr
                                    key={idx}
                                    onClick={() => onSelect(rowKey)}
                                    style={{
                                        backgroundColor: isSelected ? '#e6f2ff' : idx % 2 === 0 ? '#fafafa' : 'white',
                                        borderBottom: '1px solid #eee',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) e.currentTarget.style.backgroundColor = '#f0f0f0';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) e.currentTarget.style.backgroundColor = (idx % 2 === 0 ? '#fafafa' : 'white');
                                    }}
                                >
                                    <td style={{
                                        padding: '8px',
                                        textAlign: 'center',
                                        fontSize: '14px'
                                    }}>
                                        {isSelected ? '✓' : ''}
                                    </td>
                                    {columns.map(col => (
                                        <td key={col} style={{
                                            padding: '8px',
                                            maxWidth: '200px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {row[col] || '-'}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // Render: Pagination
    // ═══════════════════════════════════════════════════════════════════════════
    const renderPagination = () => {
        if (totalPages <= 1) return null;

        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                borderTop: '1px solid #eee',
                fontSize: '12px'
            }}>
                <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    style={{
                        padding: '4px 8px',
                        border: '1px solid #ccc',
                        backgroundColor: page === 1 ? '#f0f0f0' : 'white',
                        cursor: page === 1 ? 'not-allowed' : 'pointer',
                        borderRadius: '3px',
                        fontSize: '11px'
                    }}
                >
                    ← Zurück
                </button>

                <span style={{ padding: '0 8px', fontWeight: 'bold' }}>
                    {page} / {totalPages}
                </span>

                <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    style={{
                        padding: '4px 8px',
                        border: '1px solid #ccc',
                        backgroundColor: page === totalPages ? '#f0f0f0' : 'white',
                        cursor: page === totalPages ? 'not-allowed' : 'pointer',
                        borderRadius: '3px',
                        fontSize: '11px'
                    }}
                >
                    Weiter →
                </button>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // Main Render
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }}>
            {/* Modal */}
            <div style={{
                width: '600px',
                maxHeight: '80vh',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, fontSize: '16px' }}>
                        🔗 Wählen Sie einen Datensatz aus "{fkTableName}"
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            color: '#999'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
                    <input
                        type="text"
                        placeholder="🔍 Suchen..."
                        value={filterText}
                        onChange={(e) => {
                            setFilterText(e.target.value);
                            setPage(1);
                        }}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '13px',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px 16px'
                }}>
                    {renderTable()}
                </div>

                {/* Pagination */}
                {!loading && rows.length > pageSize && renderPagination()}

                {/* Footer */}
                <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #eee',
                    textAlign: 'right'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#f0f0f0',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
};

// Export für global usage
window.ForeignRowSelector = ForeignRowSelector;

// Export für Webpack
export default ForeignRowSelector;
