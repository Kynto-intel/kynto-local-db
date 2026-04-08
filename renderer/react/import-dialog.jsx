import React, { useState, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import { toast } from 'sonner';

/**
 * Import Dialog - Vereinfachte Version basierend auf echten SpreadsheetImport Komponenten
 * 
 * Funktionalität:
 * - CSV/Excel Upload
 * - Text Input (Paste-Daten)
 * - Header Selection
 * - Preview der Daten
 * - Behandlung leerer Felder als NULL
 */
export function ImportDialog({ 
  visible = false, 
  selectedTable = null, 
  onSave = null, 
  onClose = null 
}) {
  const [tab, setTab] = useState('upload');
  const [file, setFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedHeaders, setSelectedHeaders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [treatEmptyAsNull, setTreatEmptyAsNull] = useState(true);
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!visible) return null;

  // CSV parsing mit PapaParse
  const parseCSVData = useCallback((csvContent) => {
    setIsLoading(true);
    try {
      Papa.parse(csvContent, {
        header: false,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const headerRow = results.data[0];
            const dataRows = results.data.slice(1);
            
            setHeaders(headerRow);
            setRows(dataRows);
            setSelectedHeaders([...headerRow]);

            if (results.errors.length > 0) {
              toast.error(`${results.errors.length} CSV Parse-Fehler erkannt`);
            }
          } else {
            toast.error('Datei ist leer');
          }
        },
        error: (error) => {
          toast.error('CSV Parse-Fehler: ' + error.message);
        }
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFileUpload = useCallback((uploadedFile) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setTab('upload');

    const reader = new FileReader();
    reader.onload = (e) => parseCSVData(e.target.result);
    reader.onerror = () => toast.error('Fehler beim Lesen der Datei');
    reader.readAsText(uploadedFile);
  }, [parseCSVData]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleTextInput = (text) => {
    setCsvText(text);
    if (text.trim().length > 0) {
      parseCSVData(text);
    }
  };

  const toggleHeader = (header) => {
    setSelectedHeaders(prev =>
      prev.includes(header)
        ? prev.filter(h => h !== header)
        : [...prev, header]
    );
  };

  const handleSave = () => {
    if (!selectedTable) {
      toast.error('Keine Tabelle ausgewählt');
      return;
    }

    if (selectedHeaders.length === 0) {
      toast.error('Bitte wähle mindestens eine Spalte');
      return;
    }

    if (rows.length === 0) {
      toast.error('Keine Daten zu importieren');
      return;
    }

    // Konvertiere Array-Reihen zu Objekten
    const rowObjects = rows.map(row => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] || '';
      });
      return obj;
    });

    if (onSave) {
      onSave({
        file: file?.name || 'paste',
        headers,
        rows: rowObjects,
        selectedHeaders,
        treatEmptyAsNull,
        rowCount: rowObjects.length,
        columnTypeMap: {}
      });
    }

    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setCsvText('');
    setHeaders([]);
    setRows([]);
    setSelectedHeaders([]);
    setTab('upload');
    if (onClose) onClose();
  };

  return (
    <div className="import-modal-overlay" onClick={handleClose}>
      <div className="import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="import-modal-header">
          <h2>📥 Daten importieren → "{selectedTable?.name || 'Tabelle'}"</h2>
          <button className="import-modal-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="import-modal-content">
          {/* Tabs */}
          <div className="import-tabs">
            <button
              className={`import-tab ${tab === 'upload' ? 'active' : ''}`}
              onClick={() => setTab('upload')}
            >
              📤 Datei hochladen
            </button>
            <button
              className={`import-tab ${tab === 'paste' ? 'active' : ''}`}
              onClick={() => setTab('paste')}
            >
              📋 Text einfügen
            </button>
          </div>

          {/* Tab Content */}
          <div className="import-tab-content">
            {tab === 'upload' ? (
              <div
                className={`import-dropzone ${isDragOver ? 'dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <p>📁 CSV oder Excel-Datei hier ablegen</p>
                <small>oder klicken zum Auswählen</small>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.tsv"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e.target.files?.[0])}
                />
                {file && <div style={{ marginTop: '10px', fontSize: '12px' }}>📄 {file.name}</div>}
              </div>
            ) : (
              <textarea
                className="import-textarea"
                placeholder="CSV/TSV-Daten hier einfügen&#10;Header in erster Zeile"
                value={csvText}
                onChange={(e) => handleTextInput(e.target.value)}
              />
            )}

            {/* Header Selection */}
            {headers.length > 0 && (
              <div className="import-headers">
                <h3>✓ Spalten auswählen ({selectedHeaders.length}/{headers.length}):</h3>
                <div className="import-checkbox-grid">
                  {headers.map((header, idx) => (
                    <label key={idx} className="import-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedHeaders.includes(header)}
                        onChange={() => toggleHeader(header)}
                      />
                      <span>{header}</span>
                    </label>
                  ))}
                </div>

                {/* Preview Table */}
                {rows.length > 0 && (
                  <div className="import-preview">
                    <h4>📊 Vorschau (erste {Math.min(5, rows.length)} Zeilen):</h4>
                    <div className="import-preview-wrapper">
                      <table className="import-preview-table">
                        <thead>
                          <tr>
                            {selectedHeaders.map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 5).map((row, ridx) => (
                            <tr key={ridx}>
                              {selectedHeaders.map((h) => {
                                const colIdx = headers.indexOf(h);
                                return <td key={h}>{row[colIdx] || '—'}</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Options */}
                <label className="import-option-label">
                  <input
                    type="checkbox"
                    checked={treatEmptyAsNull}
                    onChange={(e) => setTreatEmptyAsNull(e.target.checked)}
                  />
                  <span>Leere Felder als NULL behandeln</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="import-modal-footer">
          <button className="btn btn-secondary" onClick={handleClose}>
            Abbrechen
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={headers.length === 0 || selectedHeaders.length === 0 || isLoading}
          >
            {isLoading ? '⏳ Verarbeitet...' : `✓ Importieren (${rows.length} Zeilen)`}
          </button>
        </div>
      </div>

      <style>{`
        .import-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
        }

        .import-modal {
          background: var(--surface1, #1e1e2e);
          border: 1px solid var(--border, #333);
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
          width: 90%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          color: var(--text, #e0e0e0);
        }

        .import-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border, #333);
          background: var(--surface2, #2a2a3e);
        }

        .import-modal-header h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .import-modal-close {
          background: none;
          border: none;
          color: var(--text, #e0e0e0);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          border-radius: 4px;
        }

        .import-modal-close:hover {
          background: rgba(255,107,107,0.1);
          color: #ff6b6b;
        }

        .import-modal-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .import-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border, #333);
        }

        .import-tab {
          padding: 8px 16px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted, #999);
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
          font-weight: 500;
        }

        .import-tab:hover {
          color: var(--text, #e0e0e0);
        }

        .import-tab.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }

        .import-tab-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .import-dropzone {
          border: 2px dashed var(--border, #333);
          border-radius: 6px;
          padding: 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--surface2, #2a2a3e);
          user-select: none;
        }

        .import-dropzone:hover,
        .import-dropzone.dragover {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.05);
        }

        .import-dropzone p {
          margin: 0;
          font-weight: 600;
        }

        .import-dropzone small {
          opacity: 0.7;
        }

        .import-textarea {
          width: 100%;
          height: 150px;
          padding: 12px;
          border: 1px solid var(--border, #333);
          border-radius: 6px;
          background: var(--surface2, #2a2a3e);
          color: var(--text, #e0e0e0);
          font-family: 'Courier New', monospace;
          resize: vertical;
          font-size: 12px;
        }

        .import-headers {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .import-headers h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .import-checkbox-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 8px;
        }

        .import-checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          transition: background 0.2s;
          user-select: none;
        }

        .import-checkbox-label:hover {
          background: var(--surface3, #35354f);
        }

        .import-checkbox-label input {
          cursor: pointer;
        }

        .import-preview {
          margin-top: 12px;
          padding: 12px;
          border: 1px solid var(--border, #333);
          border-radius: 6px;
          background: var(--surface2, #2a2a3e);
        }

        .import-preview h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
        }

        .import-preview-wrapper {
          overflow-x: auto;
        }

        .import-preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        .import-preview-table th,
        .import-preview-table td {
          padding: 6px;
          border: 1px solid var(--border, #333);
          text-align: left;
        }

        .import-preview-table th {
          background: var(--surface3, #35354f);
          font-weight: 600;
          white-space: nowrap;
        }

        .import-preview-table td {
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .import-option-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          user-select: none;
        }

        .import-option-label:hover {
          background: var(--surface3, #35354f);
        }

        .import-option-label input {
          cursor: pointer;
        }

        .import-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px;
          border-top: 1px solid var(--border, #333);
          background: var(--surface2, #2a2a3e);
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: var(--surface3, #35354f);
          color: var(--text, #e0e0e0);
        }

        .btn-secondary:hover {
          background: var(--border, #444);
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default ImportDialog;
