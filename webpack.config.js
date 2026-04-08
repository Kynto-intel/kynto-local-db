const path = require('path');

module.exports = [
  // ═════════════════════════════════════════════════════════════════════
  // Entry 1: SpreadsheetImportSidebar Component → window.SpreadsheetImport
  // ═════════════════════════════════════════════════════════════════════
  {
    mode: 'development',
    entry: './renderer/react/SpreadsheetImportSidebar.tsx',
    output: {
      filename: 'spreadsheet-import.js',
      path: path.resolve(__dirname, 'renderer/dist'),
      library: 'SpreadsheetImport',
      libraryTarget: 'window',
      libraryExport: 'default',
      globalObject: 'window'
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.(jsx?|js)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'classic' }]
              ]
            }
          }
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js']
    },
    externals: {
      'react': 'React',
      'react-dom': 'ReactDOM',
      'react-dom/client': 'ReactDOM'
    },
    devtool: 'source-map'
  },

  // ═════════════════════════════════════════════════════════════════════
  // Entry 2: ForeignRowSelector Component → window.ForeignRowSelector
  // ═════════════════════════════════════════════════════════════════════
  {
    mode: 'development',
    entry: './renderer/react/ForeignRowSelector.jsx',
    output: {
      filename: 'foreign-row-selector.js',
      path: path.resolve(__dirname, 'renderer/dist'),
      library: 'ForeignRowSelector',
      libraryTarget: 'window',
      globalObject: 'window'
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.(jsx?|js)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'classic' }]
              ]
            }
          }
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js']
    },
    externals: {
      'react': 'React',
      'react-dom': 'ReactDOM',
      'react-dom/client': 'ReactDOM'
    },
    devtool: 'source-map'
  },

  // ═════════════════════════════════════════════════════════════════════
  // Entry 3: DialogManager → window.DialogManager (SIDE-EFFECT ONLY!)
  // ═════════════════════════════════════════════════════════════════════
  {
    mode: 'development',
    entry: './renderer/react/index.jsx',
    output: {
      filename: 'import-dialog.js',
      path: path.resolve(__dirname, 'renderer/dist')
      // KEIN library/libraryTarget - dies ist nur ein side-effect script!
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.(jsx?|js)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'classic' }]
              ]
            }
          }
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js']
    },
    externals: {
      'react': 'React',
      'react-dom': 'ReactDOM',
      'react-dom/client': 'ReactDOM'
    },
    devtool: 'source-map'
  }
];
