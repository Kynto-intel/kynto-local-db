/**
 * JSON-Form-Builder & Code-Scanner
 * Ziel: Schluss mit manuellem JSON-Tippen. 
 * Entweder Struktur aus Code extrahieren oder aus vorhandenen Daten bauen.
 */

const JsonFormBuilder = {
  
  /**
   * TEIL 1: Der Datei-Scanner
   * Liest eine .ts oder .js Datei und extrahiert Interface-Strukturen.
   * @param {string} fileContent - Der Inhalt der Datei als Text.
   * @returns {Object|null} - Die gefundene JSON-Struktur oder null.
   */
  parseInterface: function(fileContent) {
    const structure = {};
    // Regex sucht nach: interface Name { key: type; }
    const interfaceRegex = /interface\s+(\w+)\s+{([\s\S]+?)}/g;
    const match = interfaceRegex.exec(fileContent);

    if (!match) {
      console.warn("Kein Interface in der Datei gefunden.");
      return null;
    }

    const body = match[2];
    const lines = body.split('\n');

    lines.forEach(line => {
      if (line.includes(':')) {
        let [key, type] = line.split(':').map(s => s.trim().replace(/[;|,]/g, ''));
        
        // Typen in Standardwerte umwandeln
        if (type.includes('number')) structure[key] = 0;
        else if (type.includes('boolean')) structure[key] = false;
        else if (type.includes('[]')) structure[key] = []; 
        else structure[key] = ""; // Fallback für string oder unbekannt
      }
    });

    return structure;
  },

  /**
   * TEIL 2: Der UI-Generator
   * Erstellt ein HTML-Formular basierend auf einer Struktur.
   * @param {Object} structure - Die Vorlage (aus Parser oder DB).
   * @param {Object} currentData - Die aktuellen Werte aus der Zelle (falls vorhanden).
   * @param {Function} onChange - Callback, der bei jeder Änderung das fertige JSON zurückgibt.
   * @returns {HTMLElement} - Das fertige Formular-Element.
   */
  renderForm: function(structure, currentData = {}, onChange) {
    const container = document.createElement('div');
    container.style.padding = "15px";
    container.style.background = "#f4f4f4";
    container.style.borderRadius = "8px";
    container.style.color = "#333";
    container.style.fontFamily = "sans-serif";

    // Wir mischen Struktur und aktuelle Daten
    const data = { ...structure, ...currentData };

    Object.keys(data).forEach(key => {
      const fieldWrapper = document.createElement('div');
      fieldWrapper.style.marginBottom = "12px";
      fieldWrapper.style.display = "flex";
      fieldWrapper.style.flexDirection = "column";

      const label = document.createElement('label');
      label.innerText = key;
      label.style.fontWeight = "bold";
      label.style.fontSize = "12px";
      label.style.marginBottom = "4px";
      fieldWrapper.appendChild(label);

      let input;
      const val = data[key];

      if (typeof val === 'boolean') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = val;
      } else if (typeof val === 'number') {
        input = document.createElement('input');
        input.type = 'number';
        input.value = val;
        input.style.padding = "4px";
      } else if (Array.isArray(val)) {
        input = document.createElement('input');
        input.type = 'text';
        input.placeholder = "Kommagetrennte Liste...";
        input.value = val.join(', ');
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = val;
        input.style.padding = "4px";
      }

      // Event: Wenn der User etwas ändert
      input.oninput = () => {
        let finalVal;
        if (input.type === 'checkbox') finalVal = input.checked;
        else if (input.type === 'number') finalVal = Number(input.value);
        else if (Array.isArray(val)) finalVal = input.value.split(',').map(s => s.trim());
        else finalVal = input.value;

        data[key] = finalVal;
        onChange(data); // Das komplette JSON-Objekt zurückgeben
      };

      fieldWrapper.appendChild(input);
      container.appendChild(fieldWrapper);
    });

    return container;
  }
};

export default JsonFormBuilder;