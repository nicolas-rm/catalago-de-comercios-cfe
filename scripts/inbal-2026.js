#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

// === Normalización ===
const strip = (s) =>
    String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

const normText = (v) =>
    v
        ? strip(String(v))
            .toUpperCase()
            .trim()
            .replace(/\s+/g, " ")
        : "";

const normHeader = (v) =>
    normText(v)
        .replace(/\./g, "")
        .replace(/:/g, "")
        .trim();

const normCP = (v) => {
    if (!v) return "";
    const s = String(v).replace(/\D+/g, "").slice(0, 5);
    return s ? s.padStart(5, "0") : "";
};

const makeKey = (r) => `${r.razon_social}|${r.cp}|${r.ubicacion}`;

// === Buscar fila de encabezados ===
function findHeaderRow(ws) {
    const ref = ws["!ref"];
    if (!ref) return 0;

    const range = xlsx.utils.decode_range(ref);

    for (let R = range.s.r; R <= range.e.r; R++) {
        let rowText = "";

        for (let C = range.s.c; C <= range.e.c; C++) {
            const cell = ws[xlsx.utils.encode_cell({ r: R, c: C })];
            if (cell && cell.v) rowText += normHeader(cell.v) + " ";
        }

        const hasNombre =
            rowText.includes("NOMBRE DEL ESTABLECIMIENTO") ||
            rowText.includes("NOMBRE");

        const hasDomicilio =
            rowText.includes("DOMICILIO OPERATIVO") ||
            rowText.includes("DOMICILIO");

        const hasCP =
            rowText.includes(" CP ") ||
            rowText.includes("CP ") ||
            rowText.includes("C P");

        const hasEstado = rowText.includes("ESTADO");

        if (hasNombre && hasDomicilio && hasCP && hasEstado) {
            return R;
        }
    }

    return 0;
}

function getValue(rec, names) {
    for (const name of names) {
        const key = normHeader(name);
        if (rec[key] !== undefined && rec[key] !== "") return rec[key];
    }
    return "";
}

// === Procesar Excel ===
function processFile(filePath) {
    const wb = xlsx.readFile(filePath);
    const out = [];

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws["!ref"]) continue;

        const headerRow = findHeaderRow(ws);

        const data = xlsx.utils.sheet_to_json(ws, {
            defval: "",
            header: 1,
            range: headerRow,
            blankrows: false,
        });

        if (!data.length) continue;

        const headers = data[0].map((h) => normHeader(h));
        const rows = data.slice(1);

        for (const row of rows) {
            const rec = {};

            for (let i = 0; i < headers.length; i++) {
                if (!headers[i]) continue;
                rec[headers[i]] = row[i] ?? "";
            }

            const nombre = getValue(rec, [
                "NOMBRE DEL ESTABLECIMIENTO",
                "NOMBRE",
                "ESTABLECIMIENTO",
            ]);

            const domicilio = getValue(rec, [
                "DOMICILIO OPERATIVO",
                "DOMICILIO",
                "DIRECCION",
                "DIRECCIÓN",
            ]);

            const colonia = getValue(rec, [
                "COL",
                "COL.",
                "COLONIA",
            ]);

            const cp = getValue(rec, [
                "CP",
                "C.P",
                "C.P.",
                "CODIGO POSTAL",
                "CÓDIGO POSTAL",
            ]);

            const municipio = getValue(rec, [
                "MUNICIPIO",
                "ALCALDIA",
                "ALCALDÍA",
                "CIUDAD",
            ]);

            const estado = getValue(rec, [
                "ESTADO",
                "ENTIDAD",
                "ENTIDAD FEDERATIVA",
            ]);

            if (!nombre && !domicilio && !colonia && !cp && !municipio && !estado) {
                continue;
            }

            out.push({
                razon_social: normText(nombre),
                marca_tienda: normText(nombre),
                tienda_ubicacion: normText(nombre),
                rfc: null,
                ubicacion: normText(domicilio),
                colonia: normText(colonia),
                municipio: normText(municipio),
                estado: normText(estado),
                cp: normCP(cp),
            });
        }
    }

    return out;
}

// === Principal ===
(function main() {
    const file = path.resolve("./docs/inbal-2026.xlsx");
    const outDir = path.resolve("./out");

    if (!fs.existsSync(file)) {
        console.error("❌ No se encontró ./docs/inbal-2026.xlsx");
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

    fs.mkdirSync(outDir, { recursive: true });

    const jsonPath = path.join(outDir, "inbal-2026.json");
    const txtPath = path.join(outDir, "inbal-2026.txt");

    fs.writeFileSync(jsonPath, JSON.stringify(unique, null, 2), "utf8");

    fs.writeFileSync(
        txtPath,
        [...new Set(unique.map((r) => r.razon_social).filter(Boolean))].join("\n") +
        "\n",
        "utf8"
    );

    console.log(`✔ ${jsonPath} (${unique.length} registros únicos)`);
    console.log(`✔ ${txtPath} (${unique.length} nombres únicos)`);
})();
