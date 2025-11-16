import { Routes } from '@angular/router';

export const routes: Routes = [
    // Comercios CFE
    {
        path: '',
        title: 'Comercios CFE',
        data: { description: 'Catálogo de comercios de la CFE - Comisión Federal de Electricidad. Encuentra tiendas y sucursales en todo México.' },
        loadComponent: () => import('./cfe/cfe').then(m => m.Cfe)
    },
    // Comercios Inbal
    // {
    //     path: '',
    //     title: 'Comercios INBAL',
    //     data: { description: 'Catálogo de comercios del INBAL - Instituto Nacional de Bellas Artes y Literatura. Encuentra tiendas y sucursales en todo México.' },
    //     loadComponent: () => import('./inbal/inbal').then(m => m.Inbal)
    // },
    // Default Route
    { path: '**', redirectTo: '' }
];
