import { Component, ElementRef, ViewChild } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { CatalogBase } from '../shared/components/catalog-base';
import { BrandCategory, FilterState } from '../shared/models/comercio.model';
import { ComercioService } from '../shared/services/comercio.service';

const INE_INITIAL_FILTER_STATE: FilterState = {
    q: '',
    municipio: '',
    sort: 'top',
    includeAddress: false,
    partialMatch: false,
};

const INE_EXCLUDED_COMERCIOS = ['SEXSHOP', 'SEX SHOP'];

const INE_PREFERRED_BRANDS = [
    'CHEDRAUI',
    'SUPER CHEDRAUI',
    'SUPER CHE',
    'SUPERCITO',
    'SELECTO CHEDRAUI',
    'SELECTO SUPER CHEDRAUI',
];

const INE_BRAND_CATEGORIES: BrandCategory[] = [
    {
        title: 'Autoservicio / Retail',
        icon: '🛒',
        brands: [
            'CHEDRAUI',
            'SUPER CHEDRAUI',
            'SUPER CHE',
            'SUPERCITO',
            'SELECTO CHEDRAUI',
            'SELECTO SUPER CHEDRAUI',
            'ARTELI',
            'SORIANA',
            'ARAMBURO',
        ],
    },
    {
        title: 'Moda y Fast Fashion',
        icon: '👕',
        brands: ['ZARA', 'BERSHKA', 'PULL & BEAR', 'STRADIVARIUS', 'MILANO', 'C&A', 'GUESS', 'BENETTON'],
    },
    {
        title: 'Zapaterías y Calzado',
        icon: '👞',
        brands: ['FLEXI', 'ANDREA', 'LA RIBERA', 'PRICE SHOES'],
    },
    {
        title: 'Moda Hombre',
        icon: '👔',
        brands: ['ALDO CONTI', 'VEROCHI', 'MARSEL', "MEN S FACTORY", 'CAPA DE OZONO'],
    },
    {
        title: 'Tiendas Departamentales',
        icon: '🏬',
        brands: ['COPPEL'],
    },
    {
        title: 'Deportivo y Casual',
        icon: '👟',
        brands: ['ADIDAS', 'CONVERSE'],
    },
];

@Component({
    selector: 'app-ine',
    imports: [],
    templateUrl: './ine.html',
})
export class Ine extends CatalogBase {
    @ViewChild('brandsContainer') override brandsContainer: ElementRef<HTMLElement> | undefined = undefined;

    constructor(
        private readonly metaDatos: Meta,
        comercioService: ComercioService,
    ) {
        super(comercioService, {
            jsonPaths: ['ine/ine.json', 'ine/ine2.json'],
            excludedComercios: INE_EXCLUDED_COMERCIOS,
            initialFilterState: INE_INITIAL_FILTER_STATE,
            brandCategories: INE_BRAND_CATEGORIES,
            preferredBrands: INE_PREFERRED_BRANDS,
        });
    }

    protected override beforeInitialLoad(): void {
        this.metaDatos.updateTag({
            name: 'description',
            content: 'Catálogo de comercios del INE - Instituto Nacional Electoral. Encuentra tiendas y sucursales en todo México.',
        });
    }
}

