import { Route, Routes } from '@angular/router';

type CatalogPath = 'comercio-cfe' | 'comercio-inbal' | 'comercio-ine';

interface CatalogRouteConfig {
    path: CatalogPath;
    title: string;
    description: string;
    loadComponent: NonNullable<Route['loadComponent']>;
}

const CATALOG_ROUTES: CatalogRouteConfig[] = [
    {
        path: 'comercio-cfe',
        title: 'Comercios CFE',
        description: 'Catálogo de comercios de la CFE - Comisión Federal de Electricidad. Encuentra tiendas y sucursales en todo México.',
        loadComponent: () => import('./cfe/cfe').then(m => m.Cfe)
    },
    {
        path: 'comercio-inbal',
        title: 'Comercios INBAL',
        description: 'Catálogo de comercios del INBAL - Instituto Nacional de Bellas Artes y Literatura. Encuentra tiendas y sucursales en todo México.',
        loadComponent: () => import('./inbal/inbal').then(m => m.Inbal)
    },
    {
        path: 'comercio-ine',
        title: 'Comercios INE',
        description: 'Catálogo de comercios del INE - Instituto Nacional Electoral. Encuentra tiendas y sucursales en todo México.',
        loadComponent: () => import('./ine/ine').then(m => m.Ine)
    }
];

function resolveDefaultCatalog(): CatalogPath {
    const baseHref = typeof document !== 'undefined'
        ? (document.querySelector('base')?.getAttribute('href') ?? '/')
        : '/';

    const normalizedBase = baseHref.replace(/^\/+|\/+$/g, '');
    if (normalizedBase === 'comercio-cfe' || normalizedBase === 'comercio-inbal' || normalizedBase === 'comercio-ine') {
        return normalizedBase;
    }

    return 'comercio-inbal';
}

const defaultCatalogPath = resolveDefaultCatalog();
const defaultCatalog = CATALOG_ROUTES.find(route => route.path === defaultCatalogPath) ?? CATALOG_ROUTES[1];

export const routes: Routes = [
    {
        path: '',
        title: defaultCatalog.title,
        data: { description: defaultCatalog.description },
        loadComponent: defaultCatalog.loadComponent
    },
    ...CATALOG_ROUTES.map(route => ({
        path: route.path,
        title: route.title,
        data: { description: route.description },
        loadComponent: route.loadComponent
    })),
    { path: '**', redirectTo: '' }
];
