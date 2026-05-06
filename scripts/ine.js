#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

// =========================
// Normalización
// =========================
const strip = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normText = (v) => strip(v).toUpperCase().trim().replace(/\s+/g, " ");
const normCP = (v) => {
    const s = String(v || "").replace(/\D+/g, "").slice(0, 5);
    return s ? s.padStart(5, "0") : "";
};

// Clave para deduplicar
const makeKey = (r) =>
    [
        r.razon_social,
        r.ubicacion,
        r.colonia,
        r.municipio,
        r.estado,
        r.cp,
    ].join("|");

// =========================
// Utilidades para encabezados
// =========================
function normalizeHeader(header) {
    return normText(header)
        .replace(/\./g, "")
        .replace(/,/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function findHeaderRow(ws) {
    if (!ws["!ref"]) return 0;

    const range = xlsx.utils.decode_range(ws["!ref"]);

    for (let R = range.s.r; R <= range.e.r; ++R) {
        const values = [];

        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = ws[xlsx.utils.encode_cell({ r: R, c: C })];
            if (cell && cell.v !== undefined && cell.v !== null) {
                values.push(normalizeHeader(cell.v));
            }
        }

        const rowText = values.join(" | ");

        const hasNombre =
            rowText.includes("NOMBRE DEL ESTABLECIMIENTO") ||
            rowText.includes("NOMBRE");
        const hasDomicilio =
            rowText.includes("DOMICILIO OPERATIVO") ||
            rowText.includes("DOMICILIO");
        const hasCP = rowText.includes("CP") || rowText.includes("C P");
        const hasMunicipio = rowText.includes("MUNICIPIO");
        const hasEstado = rowText.includes("ESTADO");

        if (hasNombre && hasDomicilio && hasCP && hasMunicipio && hasEstado) {
            return R;
        }
    }

    return 0;
}

function getValue(rec, keys) {
    for (const key of keys) {
        if (rec[key] !== undefined && rec[key] !== null && String(rec[key]).trim() !== "") {
            return rec[key];
        }
    }
    return "";
}

// =========================
// Procesamiento del Excel
// =========================
function processFile(filePath) {
    const wb = xlsx.readFile(filePath);
    const out = [];

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws || !ws["!ref"]) continue;

        const headerRow = findHeaderRow(ws);

        const data = xlsx.utils.sheet_to_json(ws, {
            header: 1,
            range: headerRow,
            defval: "",
            raw: false,
        });

        if (!data.length) continue;

        const headers = data[0].map((h) => normalizeHeader(h));
        const rows = data.slice(1);

        for (const row of rows) {
            const rec = {};
            for (let i = 0; i < headers.length; i++) {
                rec[headers[i]] = row[i] ?? "";
            }

            const nombre = getValue(rec, [
                "NOMBRE DEL ESTABLECIMIENTO",
                "NOMBRE DEL ESTABLECIMIENTO ",
                "NOMBRE",
            ]);

            const domicilio = getValue(rec, [
                "DOMICILIO OPERATIVO",
                "DOMICILIO",
            ]);

            const colonia = getValue(rec, [
                "COL",
                "COLONIA",
            ]);

            const cp = getValue(rec, [
                "CP",
                "C P",
            ]);

            const municipio = getValue(rec, [
                "MUNICIPIO",
            ]);

            const estado = getValue(rec, [
                "ESTADO",
            ]);

            // Saltar filas vacías
            if (!nombre && !domicilio && !colonia && !cp && !municipio && !estado) {
                continue;
            }

            const nombreNorm = normText(nombre);
            const domicilioNorm = normText(domicilio);
            const coloniaNorm = normText(colonia);
            const municipioNorm = normText(municipio);
            const estadoNorm = normText(estado);
            const cpNorm = normCP(cp);

            out.push({
                razon_social: nombreNorm,
                marca_tienda: nombreNorm,
                tienda_ubicacion: nombreNorm,
                rfc: null,
                ubicacion: domicilioNorm,
                colonia: coloniaNorm,
                municipio: municipioNorm,
                estado: estadoNorm,
                cp: cpNorm,
                hoja: sheetName,
            });
        }
    }

    return out;
}

// =========================
// Principal
// =========================
(function main() {
    const file = path.resolve("./docs/ine.xlsx");
    const outDir = path.resolve("./out");

    if (!fs.existsSync(file)) {
        console.error("❌ No se encontró ./docs/ine.xlsx");
        process.exit(1);
    }

    console.log("📘 Procesando:", file);

    const all = processFile(file);

    const seen = new Set();
    const unique = [];

    for (const rec of all) {
        const key = makeKey(rec);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(rec);
    }

    unique.sort((a, b) =>
        (a.razon_social || "").localeCompare(b.razon_social || "", "es", {
            sensitivity: "base",
        })
    );

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const jsonPath = path.join(outDir, "ine.json");
    const txtPath = path.join(outDir, "ine.txt");

    fs.writeFileSync(jsonPath, JSON.stringify(unique, null, 2), "utf8");
    fs.writeFileSync(
        txtPath,
        [...new Set(unique.map((r) => r.razon_social))].join("\n") + "\n",
        "utf8"
    );

    console.log(`✔ ${jsonPath} (${unique.length} registros únicos)`);
    console.log(`✔ ${txtPath} (${unique.length} nombres únicos)`);
})();
