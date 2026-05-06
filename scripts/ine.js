#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// =========================
// Normalización
// =========================
const strip = (s) =>
    String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const normText = (v) =>
    strip(v)
        .toUpperCase()
        .trim()
        .replace(/\s+/g, ' ');

const normCP = (v) => {
    const s = String(v || '')
        .replace(/\D+/g, '')
        .slice(0, 5);

    return s ? s.padStart(5, '0') : '';
};

// Clave para deduplicar
const makeKey = (r) =>
    [
        r.razon_social,
        r.marca_tienda,
        r.tienda_ubicacion,
        r.ubicacion,
        r.colonia,
        r.municipio,
        r.estado,
        r.cp,
        r.preference.join(','),
    ].join('|');

// =========================
// Utilidades para encabezados
// =========================
function normalizeHeader(header) {
    return normText(header)
        .replace(/["'’`´]/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function makeUniqueHeaders(headers) {
    const seen = new Map();

    return headers.map((header) => {
        const base = normalizeHeader(header);

        if (!base) return '';

        const count = seen.get(base) || 0;
        seen.set(base, count + 1);

        return count === 0 ? base : `${base}_${count + 1}`;
    });
}

function findHeaderRow(ws) {
    if (!ws['!ref']) return 0;

    const range = xlsx.utils.decode_range(ws['!ref']);

    for (let R = range.s.r; R <= range.e.r; ++R) {
        const values = [];

        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = ws[xlsx.utils.encode_cell({ r: R, c: C })];

            if (cell && cell.v !== undefined && cell.v !== null) {
                values.push(normalizeHeader(cell.v));
            }
        }

        const rowText = values.join(' | ');

        // Formato anterior
        const hasOldNombre =
            rowText.includes('NOMBRE DEL ESTABLECIMIENTO') ||
            rowText.includes('NOMBRE');

        const hasOldDomicilio =
            rowText.includes('DOMICILIO OPERATIVO') ||
            rowText.includes('DOMICILIO');

        // Formato nuevo
        const hasNewSucursal =
            rowText.includes('NO SUCURSAL') ||
            rowText.includes('NUMERO SUCURSAL');

        const hasNewNombre =
            rowText.includes('NOMBRE DE SUCURSAL') ||
            rowText.includes('NOMBRE SUCURSAL');

        const hasNewCalle = rowText.includes('CALLE');

        // Campos comunes
        const hasCP =
            rowText.includes('CP') ||
            rowText.includes('C P') ||
            rowText.includes('CODIGO POSTAL');

        const hasMunicipio = rowText.includes('MUNICIPIO');
        const hasEstado = rowText.includes('ESTADO');

        const isOldFormat =
            hasOldNombre &&
            hasOldDomicilio &&
            hasCP &&
            hasMunicipio &&
            hasEstado;

        const isNewFormat =
            hasNewSucursal &&
            hasNewNombre &&
            hasNewCalle &&
            hasCP &&
            hasMunicipio &&
            hasEstado;

        if (isOldFormat || isNewFormat) {
            return R;
        }
    }

    return 0;
}

function getValue(rec, keys) {
    for (const key of keys) {
        if (
            rec[key] !== undefined &&
            rec[key] !== null &&
            String(rec[key]).trim() !== ''
        ) {
            return rec[key];
        }
    }

    return '';
}

function makePreference(values) {
    return [...new Set(values.map((value) => normText(value)).filter(Boolean))];
}

// =========================
// Procesamiento del Excel
// =========================
function processFile(filePath) {
    const wb = xlsx.readFile(filePath, {
        cellDates: true,
    });

    const out = [];
    const allPreferences = new Set();

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];

        if (!ws || !ws['!ref']) continue;

        const headerRow = findHeaderRow(ws);

        const data = xlsx.utils.sheet_to_json(ws, {
            header: 1,
            range: headerRow,
            defval: '',
            raw: false,
        });

        if (!data.length) continue;

        const headers = makeUniqueHeaders(data[0]);
        const rows = data.slice(1);

        for (const row of rows) {
            const rec = {};

            for (let i = 0; i < headers.length; i++) {
                if (!headers[i]) continue;
                rec[headers[i]] = row[i] ?? '';
            }

            // =========================
            // Formato anterior
            // =========================
            const oldNombre = getValue(rec, [
                'NOMBRE DEL ESTABLECIMIENTO',
                'NOMBRE',
            ]);

            const oldDomicilio = getValue(rec, [
                'DOMICILIO OPERATIVO',
                'DOMICILIO',
            ]);

            const oldColonia = getValue(rec, [
                'COL',
                'COLONIA',
            ]);

            const oldCP = getValue(rec, [
                'CP',
                'C P',
                'CODIGO POSTAL',
            ]);

            const oldMunicipio = getValue(rec, [
                'MUNICIPIO',
            ]);

            const oldEstado = getValue(rec, [
                'ESTADO',
            ]);

            // =========================
            // Formato nuevo
            // =========================
            const nombreSucursal = getValue(rec, [
                'NOMBRE DE SUCURSAL',
                'NOMBRE SUCURSAL',
            ]);

            const calle = getValue(rec, [
                'CALLE',
            ]);

            const colonia = getValue(rec, [
                'COLONIA',
                'COL',
            ]);

            const cp = getValue(rec, [
                'CP',
                'C P',
                'CODIGO POSTAL',
            ]);

            const municipio = getValue(rec, [
                'MUNICIPIO',
            ]);

            const estado = getValue(rec, [
                'ESTADO',
            ]);

            const formatoUno = getValue(rec, [
                'FORMATO',
            ]);

            const formatoDos = getValue(rec, [
                'FORMATO_2',
            ]);

            // =========================
            // Resolver valores finales
            // =========================
            const nombreFinal = nombreSucursal || oldNombre;
            const ubicacionFinal = calle || oldDomicilio;
            const coloniaFinal = colonia || oldColonia;
            const cpFinal = cp || oldCP;
            const municipioFinal = municipio || oldMunicipio;
            const estadoFinal = estado || oldEstado;

            const preference = makePreference([formatoUno, formatoDos]);

            for (const item of preference) {
                allPreferences.add(item);
            }

            // Saltar filas vacías
            if (
                !nombreFinal &&
                !ubicacionFinal &&
                !coloniaFinal &&
                !cpFinal &&
                !municipioFinal &&
                !estadoFinal &&
                !preference.length
            ) {
                continue;
            }

            const nombreNorm = normText(nombreFinal);

            out.push({
                razon_social: nombreNorm,
                marca_tienda: nombreNorm,
                tienda_ubicacion: nombreNorm,
                rfc: '',
                ubicacion: normText(ubicacionFinal),
                colonia: normText(coloniaFinal),
                municipio: normText(municipioFinal),
                estado: normText(estadoFinal),
                cp: normCP(cpFinal),
                preference,
            });
        }
    }

    return {
        records: out,
        preferences: [...allPreferences].sort((a, b) =>
            a.localeCompare(b, 'es', {
                sensitivity: 'base',
            })
        ),
    };
}

// =========================
// Principal
// =========================
(function main() {
    const file = path.resolve('./docs/ine.xlsx');
    const outDir = path.resolve('./out');

    if (!fs.existsSync(file)) {
        console.error('❌ No se encontró ./docs/ine.xlsx');
        process.exit(1);
    }

    console.log('📘 Procesando:', file);

    const { records, preferences } = processFile(file);

    const seen = new Set();
    const unique = [];

    for (const rec of records) {
        const key = makeKey(rec);

        if (seen.has(key)) continue;

        seen.add(key);
        unique.push(rec);
    }

    unique.sort((a, b) =>
        (a.razon_social || '').localeCompare(b.razon_social || '', 'es', {
            sensitivity: 'base',
        })
    );

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const jsonPath = path.join(outDir, 'ine.json');
    const txtPath = path.join(outDir, 'ine.txt');
    const preferencesJsonPath = path.join(outDir, 'preferences.json');
    const preferencesTxtPath = path.join(outDir, 'preferences.txt');

    fs.writeFileSync(jsonPath, JSON.stringify(unique, null, 2), 'utf8');

    fs.writeFileSync(
        txtPath,
        [...new Set(unique.map((r) => r.razon_social))]
            .filter(Boolean)
            .join('\n') + '\n',
        'utf8'
    );

    fs.writeFileSync(
        preferencesJsonPath,
        JSON.stringify(preferences, null, 2),
        'utf8'
    );

    fs.writeFileSync(
        preferencesTxtPath,
        preferences.join('\n') + '\n',
        'utf8'
    );

    console.log(`✔ ${jsonPath} (${unique.length} registros únicos)`);
    console.log(`✔ ${txtPath} (${unique.length} nombres únicos)`);
    console.log(
        `✔ ${preferencesJsonPath} (${preferences.length} preferences únicas)`
    );
    console.log(
        `✔ ${preferencesTxtPath} (${preferences.length} preferences únicas)`
    );
})();
