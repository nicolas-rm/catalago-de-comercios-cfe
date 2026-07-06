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
    partialMatch: false,
};

export const INBAL_EXCLUDED_COMERCIOS = ['WALMART', 'BODEGA AURRERA', 'MI BODEGA AURRERA', 'SAMS CLUB', "SAM'S CLUB", 'COSTCO', 'CITY CLUB', 'CASA LEY', 'CALIMAX', 'ALSUPER', 'SEXSHOP', 'SEX SHOP'];

const INBAL_BRAND_CATEGORIES: BrandCategory[] = [
    {
        title: '👕 Moda',
        icon: '👕',
        brands: ['ZARA', 'BERSHKA', 'PULL & BEAR', 'STRADIVARIUS', 'MASSIMO DUTTI', 'OYSHO', 'ZARA HOME', 'LEFTIES', 'BENETTON', 'C&A', 'CKLASS', 'BOBOIS', 'CAPA DE OZONO', 'C&A'],
    },
    {
        title: '👞 Calzado',
        icon: '👞',
        brands: ['FLEXI', 'CHARLY', 'ANDREA', 'PORTENIS', 'CONVERSE', 'ADIDAS', 'BRANTANO', 'CALZAPATO', 'CALZZAPATO', 'CALZADO FLEXI', 'CUADRA', 'BATA'],
    },
    {
        title: '👔 Caballero',
        icon: '🤵',
        brands: ['ALDO CONTI', 'BRUNO CORZA', 'CARLO ROSSETTI', 'DOCKERS', 'FERRIONI', 'CAVALIER', 'ALFILO'],
    },
    {
        title: '👗 Dama',
        icon: '👗',
        brands: ['IVONNE', 'COQUETA', 'ANN MILLER', 'D LUO', 'STUDIO F', 'SCANDALO', 'CASA VOGUE', 'AGACY', 'ANGELA'],
    },
    {
        title: '👶 Infantil',
        icon: '🧸',
        brands: ['BABY OUTLET', 'CARTERS', 'OSHKOSH', 'CHEEKY', 'CREYSI', 'BOBOIS', 'CHICCO', 'BABY MINK', 'CAMPANITA'],
    },
    {
        title: '👜 Bolsas y Accesorios',
        icon: '👜',
        brands: ['COACH', 'BOLSAS', 'ACCESORIOS', 'BISUTERIA', 'BISU', 'BISSU', 'BOLSOMANIA'],
    },
    {
        title: '💍 Joyería',
        icon: '💍',
        brands: ['SWAROVSKI', 'BIZZARRO', 'AGATHA', 'TOUS'],
    },
    {
        title: '🏪 Departamentales',
        icon: '🏬',
        brands: ['COPPEL', 'CHEDRAUI', 'CITY CLUB', 'COSTCO', 'CASA LEY', 'BODEGA AURRERA', 'CALIMAX', 'CIMACO'],
    },
    {
        title: '🏄 Deportivo',
        icon: '🏃',
        brands: ['ADIDAS', 'CONVERSE', 'PORTENIS', 'ATHLETES FOOT', 'CHARLY', 'CROCS'],
    },
    {
        title: '⭐ Premium',
        icon: '✨',
        brands: ['CALVIN KLEIN', 'LACOSTE', 'ARMANI', 'COACH', 'BIMBA Y LOLA', 'CAROLINA HERRERA', 'BROOKS BROTHERS', 'BURBERRY'],
    },
];

@Component({
    selector: 'app-inbal-2026',
    imports: [],
    templateUrl: './inbal-2026.html',
})
export class Inbal2026 extends CatalogBase {
    @ViewChild('brandsContainer') override brandsContainer: ElementRef<HTMLElement> | undefined = undefined;

    constructor(
        private readonly metaDatos: Meta,
        comercioService: ComercioService,
    ) {
        super(comercioService, {
            jsonPath: 'inbal-2026/inbal-2026.json',
            excludedComercios: INBAL_EXCLUDED_COMERCIOS,
            initialFilterState: INBAL_INITIAL_FILTER_STATE,
            brandCategories: INBAL_BRAND_CATEGORIES,
        });
    }

    protected override beforeInitialLoad(): void {
        this.metaDatos.updateTag({
            name: 'description',
            content: 'Catálogo de comercios del INBAL - Instituto Nacional de Bellas Artes y Literatura. Encuentra tiendas y sucursales en todo México.',
        });
    }
}
