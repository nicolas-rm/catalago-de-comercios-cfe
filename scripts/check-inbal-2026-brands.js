#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DEFAULT_COMPONENT_PATH = 'src/app/inbal-2026/inbal-2026.ts';
const DEFAULT_DATA_PATH = 'public/inbal-2026/inbal-2026.json';
const DEFAULT_SAMPLE_LIMIT = 5;

function printHelp() {
    console.log(`Uso:
  node scripts/check-inbal-2026-brands.js
  node scripts/check-inbal-2026-brands.js --all
  node scripts/check-inbal-2026-brands.js --search SORIANA --samples 10

Opciones:
  --component <path>  Archivo TS del catalogo. Default: ${DEFAULT_COMPONENT_PATH}
  --data <path>       JSON de comercios. Default: ${DEFAULT_DATA_PATH}
  --search <term>     Busca un comercio o marca puntual. Se puede repetir.
  --samples <n>       Muestras por busqueda. Default: ${DEFAULT_SAMPLE_LIMIT}
  --all               Imprime conteos por categoria.
  --json              Imprime salida JSON.
  --help              Muestra esta ayuda.
`);
}

function parseArgs(argv) {
    const options = {
        componentPath: DEFAULT_COMPONENT_PATH,
        dataPath: DEFAULT_DATA_PATH,
        searches: [],
        samples: DEFAULT_SAMPLE_LIMIT,
        all: false,
        json: false,
        help: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        switch (arg) {
            case '--component':
                options.componentPath = argv[++i];
                break;
            case '--data':
                options.dataPath = argv[++i];
                break;
            case '--search':
                options.searches.push(argv[++i]);
                break;
            case '--samples':
                options.samples = Number(argv[++i]);
                break;
            case '--all':
                options.all = true;
                break;
            case '--json':
                options.json = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                throw new Error(`Opcion no reconocida: ${arg}`);
        }
    }

    if (!Number.isInteger(options.samples) || options.samples < 0) {
        throw new Error('--samples debe ser un numero entero mayor o igual a 0.');
    }

    return options;
}

function readFile(filePath) {
    return fs.readFileSync(path.resolve(filePath), 'utf8');
}

function readJson(filePath) {
    return JSON.parse(readFile(filePath));
}

function parseStringArray(source, constName) {
    const pattern = new RegExp(`(?:export\\s+)?const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
    const match = source.match(pattern);
    if (!match) return [];
    return parseQuotedStrings(match[1]);
}

function parseBrandCategories(source) {
    const blockMatch = source.match(/const\s+INBAL_BRAND_CATEGORIES:\s*BrandCategory\[\]\s*=\s*\[([\s\S]*?)\];/);
    if (!blockMatch) {
        throw new Error('No se encontro INBAL_BRAND_CATEGORIES.');
    }

    const categories = [];
    const categoryPattern = /\{\s*title:\s*(['"])(.*?)\1,[\s\S]*?brands:\s*\[([\s\S]*?)\]\s*,?\s*\}/g;
    let match;

    while ((match = categoryPattern.exec(blockMatch[1])) !== null) {
        categories.push({
            title: match[2],
            brands: parseQuotedStrings(match[3]),
        });
    }

    if (categories.length === 0) {
        throw new Error('No se pudieron leer categorias de INBAL_BRAND_CATEGORIES.');
    }

    return categories;
}

function parseQuotedStrings(value) {
    const strings = [];
    const stringPattern = /'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)"/g;
    let match;

    while ((match = stringPattern.exec(value)) !== null) {
        strings.push((match[1] ?? match[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }

    return strings;
}

function normalize(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function getDisplayName(comercio) {
    return comercio.marca_tienda || comercio.razon_social || '';
}

function getSearchableName(comercio) {
    return `${getDisplayName(comercio)} ${comercio.razon_social || ''}`.toUpperCase();
}

function createVisibleRows(data, excludedTerms, includedTerms) {
    return data.filter((comercio) => {
        const searchableName = getSearchableName(comercio);

        if (includedTerms.some((included) => searchableName.includes(included.toUpperCase()))) {
            return true;
        }

        return !excludedTerms.some((excluded) => searchableName.includes(excluded.toUpperCase()));
    });
}

function matchesCatalogSearch(comercio, query) {
    const trimmedQuery = query.trim();
    const isPostalCode = /^\d{4,5}$/.test(trimmedQuery);

    if (isPostalCode && comercio.cp) {
        return String(comercio.cp).includes(trimmedQuery);
    }

    const fields = [
        comercio.razon_social,
        comercio.marca_tienda,
        comercio.rfc,
        comercio.cp,
        ...(comercio.preference ?? []),
    ];
    const words = normalize(fields.filter(Boolean).join(' ')).split(/\s+/).filter(Boolean);
    const queryWords = normalize(trimmedQuery).split(/\s+/).filter(Boolean);

    return queryWords.every((queryWord) => words.some((word) => word === queryWord));
}

function countMatches(rows, query) {
    return rows.filter((row) => matchesCatalogSearch(row, query)).length;
}

function getSamples(rows, query, limit) {
    return rows
        .filter((row) => matchesCatalogSearch(row, query))
        .slice(0, limit)
        .map((row) => ({
            nombre: getDisplayName(row),
            municipio: row.municipio || '',
            estado: row.estado || '',
            cp: row.cp || '',
        }));
}

function buildCategoryReport(categories, visibleRows) {
    return categories.map((category) => ({
        title: category.title,
        brands: category.brands.map((brand) => ({
            brand,
            count: countMatches(visibleRows, brand),
        })),
    }));
}

function flattenUniqueBrands(categories) {
    return [...new Set(categories.flatMap((category) => category.brands))];
}

function printTextReport(report, options) {
    console.log(`Archivo categorias: ${report.componentPath}`);
    console.log(`Archivo datos: ${report.dataPath}`);
    console.log(`Registros JSON: ${report.totalRows}`);
    console.log(`Registros visibles: ${report.visibleRows}`);

    if (report.searches.length > 0) {
        console.log('\nBusquedas');
        for (const search of report.searches) {
            console.log(`${search.term}: ${search.count}`);
            for (const sample of search.samples) {
                console.log(`  - ${sample.nombre} | ${sample.municipio}, ${sample.estado} | CP ${sample.cp}`);
            }
        }
    }

    console.log(`\nMarcas unicas en categorias: ${report.totalBrands}`);
    console.log(`Marcas sin coincidencias visibles: ${report.missingBrands.length}`);

    if (report.missingBrands.length > 0) {
        for (const missing of report.missingBrands) {
            console.log(`  - ${missing.brand}`);
        }
    }

    if (options.all) {
        console.log('\nConteos por categoria');
        for (const category of report.categories) {
            console.log(`[${category.title}]`);
            for (const brand of category.brands) {
                console.log(`  ${brand.brand}: ${brand.count}`);
            }
        }
    }
}

function main() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return 0;
    }

    const source = readFile(options.componentPath);
    const data = readJson(options.dataPath);
    const categories = parseBrandCategories(source);
    const excludedTerms = parseStringArray(source, 'INBAL_EXCLUDED_COMERCIOS');
    const includedTerms = parseStringArray(source, 'INBAL_INCLUDED_COMERCIOS');
    const visibleRows = createVisibleRows(data, excludedTerms, includedTerms);
    const uniqueBrands = flattenUniqueBrands(categories);
    const categoryReport = buildCategoryReport(categories, visibleRows);
    const missingBrands = uniqueBrands
        .map((brand) => ({ brand, count: countMatches(visibleRows, brand) }))
        .filter((item) => item.count === 0);

    const searches = options.searches.map((term) => ({
        term,
        count: countMatches(visibleRows, term),
        samples: getSamples(visibleRows, term, options.samples),
    }));

    const report = {
        componentPath: options.componentPath,
        dataPath: options.dataPath,
        totalRows: data.length,
        visibleRows: visibleRows.length,
        totalBrands: uniqueBrands.length,
        missingBrands,
        searches,
        categories: categoryReport,
    };

    if (options.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        printTextReport(report, options);
    }

    return missingBrands.length > 0 || searches.some((search) => search.count === 0) ? 1 : 0;
}

try {
    process.exitCode = main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
