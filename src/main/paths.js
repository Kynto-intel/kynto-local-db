const { app } = require('electron');
const path = require('path');
const fs   = require('fs'); // ← war vergessen

// app.getAppPath() → C:\Users\Felix\Desktop\Kynto\Kynto
// Dort liegt der /data Ordner mit Kynto.ddb und kynto_app.pgdata
const DATA_DIR = path.join(app.getAppPath(), 'data');

// Ordner automatisch anlegen falls nicht vorhanden
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

module.exports = { DATA_DIR };