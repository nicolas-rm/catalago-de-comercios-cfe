import { Component, ElementRef, ViewChild } from '@angular/core';
import { CatalogBase } from '../shared/components/catalog-base';
import { BrandCategory, FilterState } from '../shared/models/comercio.model';
import { ComercioService } from '../shared/services/comercio.service';

const CFE_INITIAL_FILTER_STATE: FilterState = {
    q: '',
    estado: '',
    municipio: '',
    sort: 'top',
    includeAddress: false,
    partialMatch: false
};

const CFE_BRAND_CATEGORIES: BrandCategory[] = [
    {
        title: 'Botas / Piel Premium',
        icon: '🥾',
        brands: ['BUCKHOUSE', 'CUADRA', 'TIMBERLAND']
    },
    {
        title: 'Calzado (Marcas)',
        icon: '👞',
        brands: [
            'ALDO', 'ALEJANDRA', 'ARANTZA', 'BRANTANO', 'CANDY',
            'COQUETA', 'DIONE', 'DOMIT', 'FLEXI', 'GOSH', 'INCOGNITA',
            'JESSICA', 'JOYA', 'KARELE', 'KELDER', 'MARCELA', 'MICHEL',
            'MUZZA', 'NINE WEST', 'PARUNO', 'RIBERA', 'ROCKPORT', 'STYLO',
            'VAZZA', 'VEROCHI', 'VIA UNO', 'ZOE'
        ]
    },
    {
        title: 'Catálogo / Mayorista',
        icon: '📦',
        brands: ['ANDREA', 'CKLASS', 'IMPULS', 'MUNDO TERRA', 'PAKAR', 'PRICE SHOES']
    },
    {
        title: 'Deportivo (Marcas)',
        icon: '👟',
        brands: ['CHARLY', 'CONVERSE', 'CROCS', 'NIKE', 'PANAM', 'PIRMA', 'PUMA', 'SKECHERS', 'VANS']
    },
    {
        title: 'Industrial / Seguridad',
        icon: '🦺',
        brands: ['BERRENDO', 'CATERPILLAR', 'DESTROYER']
    },
    {
        title: 'Moda / Fast Fashion',
        icon: '👕',
        brands: ['GUESS', 'H&M', 'HUGO', 'LEE', 'LOB', 'MASSIMO DUTTI', 'STRADIVARIUS', 'ZARA']
    },
    {
        title: 'Retail Multimarca',
        icon: '🏪',
        brands: ['CALZAPATO', 'DOROTHY GAYNOR', 'DPORTENIS', 'TAF', '3 HERMANOS']
    },
    {
        title: 'Departamental',
        icon: '🏬',
        brands: ['LIVERPOOL', 'PALACIO DE HIERRO', 'SEARS', 'COPPEL']
    }
];

@Component({
    selector: 'app-cfe',
    imports: [],
    templateUrl: './cfe.html'
})
export class Cfe extends CatalogBase {
    @ViewChild('brandsContainer') override brandsContainer: ElementRef<HTMLElement> | undefined = undefined;

    constructor(comercioService: ComercioService) {
        super(comercioService, {
            jsonPath: 'cfe/cfe.json',
            excludedComercios: ['CHEDRAUI', 'SEXSHOP'],
            initialFilterState: CFE_INITIAL_FILTER_STATE,
            brandCategories: CFE_BRAND_CATEGORIES
        });
    }
}
