// Interfaces compartidas entre CFE e Inbal

export interface Comercio {
    id?: string;
    razon_social: string;
    marca_tienda?: string;
    ubicacion: string;
    colonia?: string;
    municipio: string;
    estado: string;
    cp?: string;
    rfc?: string;
    tienda_ubicacion?: string;
    top?: boolean;
}

export interface FilterState {
    q: string;
    estado?: string;
    cp?: string;
    municipio: string;
    sort: 'top' | 'az' | 'estado';
    includeAddress: boolean;
    partialMatch: boolean;
}

export interface LoadingState {
    isLoading: boolean;
    progress: number;
    message: string;
    error?: string;
}

export interface BrandCategory {
    title: string;
    brands: string[];
    icon: string;
}
