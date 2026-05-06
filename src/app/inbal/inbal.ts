import { Component, ElementRef, ViewChild } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { CatalogBase } from '../shared/components/catalog-base';
import { BrandCategory, FilterState } from '../shared/models/comercio.model';
import { ComercioService } from '../shared/services/comercio.service';

const INBAL_INITIAL_FILTER_STATE: FilterState = {
    q: '',
    municipio: '',
    sort: 'top',
    includeAddress: false,
    partialMatch: false
};

const INBAL_EXCLUDED_COMERCIOS = ['CHEDRAUI', 'SEXSHOP', 'SEX SHOP'];

const INBAL_BRAND_CATEGORIES: BrandCategory[] = [
    {
        title: 'Moda / Fast Fashion',
        icon: '👕',
        brands: ['ZARA', 'BERSHKA', 'PULL & BEAR', 'MASSIMO DUTTI', 'STRADIVARIUS', 'GUESS', 'BENETTON']
    },
    {
        title: 'Departamental',
        icon: '🏬',
        brands: ['COPPEL']
    },
    {
        title: 'Calzado (Marcas)',
        icon: '👞',
        brands: ['ALDO CONTI', 'ANDREA', 'CKLASS', 'CONVERSE']
    },
    {
        title: 'Moda Premium',
        icon: '👔',
        brands: ['CALVIN KLEIN', 'LACOSTE', 'TOMMY HILFIGER', 'ARMANI', 'DOCKERS']
    },
    {
        title: 'Accesorios / Lujo',
        icon: '👜',
        brands: ['COACH']
    },
    {
        title: 'Deportivo (Marcas)',
        icon: '👟',
        brands: ['ADIDAS']
    }
];

@Component({
    selector: 'app-inbal',
    imports: [],
    templateUrl: './inbal.html'
})
export class Inbal extends CatalogBase {
    @ViewChild('brandsContainer') override brandsContainer: ElementRef<HTMLElement> | undefined = undefined;

    constructor(
        private readonly metaDatos: Meta,
        comercioService: ComercioService
    ) {
        super(comercioService, {
            jsonPath: 'inbal/inbal.json',
            excludedComercios: INBAL_EXCLUDED_COMERCIOS,
            initialFilterState: INBAL_INITIAL_FILTER_STATE,
            brandCategories: INBAL_BRAND_CATEGORIES
        });
    }

    protected override beforeInitialLoad(): void {
        this.metaDatos.updateTag({
            name: 'description',
            content: 'Catálogo de comercios del INBAL - Instituto Nacional de Bellas Artes y Literatura. Encuentra tiendas y sucursales en todo México.'
        });
    }
}
