#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

// === Normalización ===
const strip = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normText = (v) => (v ? strip(String(v)).toUpperCase().trim().replace(/\s+/g, " ") : "");
const normCP = (v) => {
    if (!v) return "";
    const s = String(v).replace(/\D+/g, "").slice(0, 5);
    return s.padStart(5, "0");
};
const makeKey = (r) => `${r.razon_social}|${r.cp}|${r.ubicacion}`;

// === Buscar la fila que contiene los encabezados ===
function findHeaderRow(ws) {
    const range = xlsx.utils.decode_range(ws["!ref"]);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        let rowText = "";
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = ws[xlsx.utils.encode_cell({ r: R, c: C })];
            if (cell && cell.v) rowText += String(cell.v).toUpperCase() + " ";
        }
        if (
            rowText.includes("NOMBRE") &&
            rowText.includes("DOMICILIO") &&
            (rowText.includes("CP") || rowText.includes("C.P"))
        ) {
            return R;
        }
    }
    return 0; // fallback
}

// === Procesar Excel ===
function processFile(filePath) {
    const wb = xlsx.readFile(filePath);
    const out = [];

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const headerRow = findHeaderRow(ws);
        const data = xlsx.utils.sheet_to_json(ws, {
            defval: "",
            header: 1,
            range: headerRow,
        });

        const headers = data[0].map((h) => normText(h));
        const rows = data.slice(1);

        for (const row of rows) {
            const rec = {};
            for (let i = 0; i < headers.length; i++) rec[headers[i]] = row[i] ?? "";

            const nombre =
                rec["NOMBRE DEL ESTABLECIMIENTO"] ||
                rec["NOMBRE DEL ESTABLECIMIENTO "] ||
                rec["NOMBRE"] ||
                "";
            const domicilio = rec["DOMICILIO OPERATIVO"] || rec["DOMICILIO"] || "";
            const col = rec["COL."] || rec["COL"] || "";
            const cp = rec["CP"] || rec["C.P"] || "";
            const municipio = rec["MUNICIPIO"] || "";
            const estado = rec["ESTADO"] || "";

            if (!nombre && !domicilio && !col && !cp && !municipio && !estado) continue;

            out.push({
                razon_social: normText(nombre),
                marca_tienda: normText(nombre),
                tienda_ubicacion: normText(nombre),
                rfc: null,
                ubicacion: normText(domicilio),
                colonia: normText(col),
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
    const file = path.resolve("./docs/inbal.xlsx");
    const outDir = path.resolve("./out");

    if (!fs.existsSync(file)) {
        console.error("❌ No se encontró ./docs/inbal.xlsx");
        process.exit(1);
    }

    console.log("📘 Procesando:", file);
    const all = processFile(file);

    // Deduplicar y ordenar
    const seen = new Set();
    const unique = [];
    for (const rec of all) {
        const key = makeKey(rec);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(rec);
    }

    unique.sort((a, b) =>
        (a.razon_social || "").localeCompare(b.razon_social || "", "es", { sensitivity: "base" })
    );

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, "inbal.json");
    const txtPath = path.join(outDir, "inbal.txt");

    fs.writeFileSync(jsonPath, JSON.stringify(unique, null, 2), "utf8");
    fs.writeFileSync(
        txtPath,
        [...new Set(unique.map((r) => r.razon_social))].join("\n") + "\n",
        "utf8"
    );

    console.log(`✔ ${jsonPath} (${unique.length} registros únicos)`);
    console.log(`✔ ${txtPath} (${unique.length} nombres únicos)`);
})();
