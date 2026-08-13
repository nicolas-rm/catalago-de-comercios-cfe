import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Comercio, FilterState, LoadingState } from '../models/comercio.model';

@Injectable({
    providedIn: 'root'
})
export class ComercioService {
    private readonly ITEMS_PER_PAGE = 50;
    private readonly CHUNK_SIZE = 1000;

    constructor(private http: HttpClient) { }

    /**
     * Carga comercios desde un archivo JSON
     */
    async loadComercios(
        jsonPath: string,
        updateLoadingState: (state: Partial<LoadingState>) => void,
        excludeFilter?: (comercio: Comercio) => boolean
    ): Promise<Comercio[]> {
        try {
            updateLoadingState({
                isLoading: true,
                progress: 0,
                message: 'Iniciando carga de datos...'
            });

            const data = await firstValueFrom(this.http.get<Comercio[]>(jsonPath));

            updateLoadingState({
                isLoading: true,
                progress: 50,
                message: `Procesando ${data.length} comercios...`
            });

            const processedData = await this.processDataInChunks(
                data,
                updateLoadingState,
                excludeFilter
            );

            updateLoadingState({
                isLoading: true,
                progress: 100,
                message: 'Finalizando...'
            });

            return processedData;
        } catch (error) {
            console.error('Error cargando comercios:', error);
            updateLoadingState({
                isLoading: false,
                progress: 0,
                message: '',
                error: 'Error al cargar los datos. Por favor, intenta de nuevo.'
            });
            throw error;
        } finally {
            updateLoadingState({
                isLoading: false,
                progress: 100,
                message: 'Datos cargados correctamente'
            });
        }
    }

    /**
     * Carga comercios desde multiples archivos JSON
     */
    async loadComerciosMultiple(
        jsonPaths: string[],
        updateLoadingState: (state: Partial<LoadingState>) => void,
        excludeFilter?: (comercio: Comercio) => boolean
    ): Promise<Comercio[]> {
        if (jsonPaths.length === 0) {
            updateLoadingState({
                isLoading: false,
                progress: 0,
                message: '',
                error: 'No se proporcionaron rutas de datos.'
            });
            return [];
        }

        try {
            updateLoadingState({
                isLoading: true,
                progress: 0,
                message: 'Iniciando carga de datos...'
            });

            const datasets: Comercio[][] = [];
            for (let i = 0; i < jsonPaths.length; i++) {
                const jsonPath = jsonPaths[i];
                updateLoadingState({
                    isLoading: true,
                    progress: Math.round((i / jsonPaths.length) * 25),
                    message: `Cargando datos (${i + 1}/${jsonPaths.length})...`
                });

                const data = await firstValueFrom(this.http.get<Comercio[]>(jsonPath));
                datasets.push(data);
            }

            const merged = datasets.flat();

            updateLoadingState({
                isLoading: true,
                progress: 50,
                message: `Procesando ${merged.length} comercios...`
            });

            const processedData = await this.processDataInChunks(
                merged,
                updateLoadingState,
                excludeFilter
            );

            updateLoadingState({
                isLoading: true,
                progress: 100,
                message: 'Finalizando...'
            });

            return processedData;
        } catch (error) {
            console.error('Error cargando comercios:', error);
            updateLoadingState({
                isLoading: false,
                progress: 0,
                message: '',
                error: 'Error al cargar los datos. Por favor, intenta de nuevo.'
            });
            throw error;
        } finally {
            updateLoadingState({
                isLoading: false,
                progress: 100,
                message: 'Datos cargados correctamente'
            });
        }
    }

    /**
     * Procesa datos en chunks para no bloquear la UI
     */
    private async processDataInChunks(
        data: Comercio[],
        updateLoadingState: (state: Partial<LoadingState>) => void,
        excludeFilter?: (comercio: Comercio) => boolean
    ): Promise<Comercio[]> {
        const chunks = this.chunkArray(data, this.CHUNK_SIZE);
        const processedData: Comercio[] = [];
        let idCounter = 0;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            await new Promise(resolve => {
                setTimeout(() => {
                    const filteredChunk = excludeFilter
                        ? chunk.filter(excludeFilter)
                        : chunk;

                    // Agregar ID único a cada comercio
                    const chunkWithIds = filteredChunk.map(comercio => ({
                        ...comercio,
                        id: comercio.id || `comercio-${++idCounter}`
                    }));

                    processedData.push(...chunkWithIds);

                    const progress = ((i + 1) / chunks.length) * 50 + 50;
                    updateLoadingState({
                        isLoading: true,
                        progress,
                        message: `Procesando ${processedData.length} de ${data.length} comercios...`
                    });

                    resolve(void 0);
                }, 0);
            });
        }

        return processedData;
    }

    /**
     * Aplica filtros a los comercios
     */
    async applyFilters(
        comercios: Comercio[],
        state: FilterState,
        currentPage: number,
        preferredBrands: string[] = []
    ): Promise<{ filtered: Comercio[]; hasMore: boolean }> {
        return new Promise(resolve => {
            setTimeout(() => {
                let filtered = [...comercios];
                const shouldUsePreferredBrands = !state.q && preferredBrands.length > 0;

                // Filtro por estado (usado por CFE)
                if (state.estado) {
                    filtered = filtered.filter(c => c.estado === state.estado);
                }

                // Filtro por código postal (usado por INBAL)
                if (state.cp) {
                    filtered = filtered.filter(c => c.cp === state.cp);
                }

                // Filtro por municipio
                if (state.municipio) {
                    filtered = filtered.filter(c =>
                        c.municipio.toLowerCase().includes(state.municipio.toLowerCase())
                    );
                }

                // Filtro por búsqueda
                if (state.q) {
                    const query = state.q;
                    filtered = filtered.filter(c => {
                        // Detectar si la búsqueda es un código postal (solo números de 4-5 dígitos)
                        const isPostalCode = /^\d{4,5}$/.test(query.trim());

                        // Si es un código postal, buscar directamente en el campo CP
                        if (isPostalCode && c.cp) {
                            return c.cp.includes(query.trim());
                        }

                        // Si "Búsqueda flexible" está activado: buscar con coincidencia parcial
                        // en campos principales o direcciones (según la opción seleccionada)
                        if (state.partialMatch) {
                            const fieldsToSearch = state.includeAddress
                                ? [
                                    c.tienda_ubicacion,
                                    c.ubicacion,
                                    c.colonia,
                                    c.municipio,
                                    c.estado,
                                    c.cp,
                                    ...(c.preference ?? [])
                                ]
                                : [
                                    c.razon_social,
                                    c.marca_tienda,
                                    c.rfc,
                                    c.cp,
                                    ...(c.preference ?? [])
                                ];

                            const searchText = fieldsToSearch.filter(Boolean).join(' ');
                            return this.matchesSearch(searchText, query, true);
                        }

                        // Si "Búsqueda flexible" NO está activado:
                        // - Si "Incluir direcciones" está activado: buscar SOLO en direcciones
                        // - Si "Incluir direcciones" NO está activado: buscar SOLO en campos principales
                        if (state.includeAddress) {
                            // Buscar SOLO en direcciones
                            const addressFields = [
                                c.tienda_ubicacion,
                                c.ubicacion,
                                c.colonia,
                                c.municipio,
                                c.estado,
                                c.cp,
                                ...(c.preference ?? [])
                            ];
                            const searchText = addressFields.filter(Boolean).join(' ');
                            return this.matchesSearch(searchText, query, false);
                        } else {
                            // Buscar SOLO en campos principales (nombre, marca, RFC, CP)
                            const mainFields = [
                                c.razon_social,
                                c.marca_tienda,
                                c.rfc,
                                c.cp,
                                ...(c.preference ?? [])
                            ];
                            const searchText = mainFields.filter(Boolean).join(' ');
                            return this.matchesSearch(searchText, query, false);
                        }
                    });
                }

                // Ordenamiento
                switch (state.sort) {
                    case 'az':
                        filtered.sort((a, b) => {
                            const nameOrder = this.getNombreComercio(a).localeCompare(this.getNombreComercio(b));
                            if (state.q) {
                                return this.compareWithPreferenceAndMatch(a, b, state.q, preferredBrands, nameOrder);
                            }
                            if (shouldUsePreferredBrands) {
                                return this.compareWithPreferredBrandPriority(a, b, preferredBrands, nameOrder);
                            }
                            return this.compareWithPreferencePriority(a, b, nameOrder);
                        });
                        break;
                    case 'estado':
                        filtered.sort((a, b) => {
                            const stateOrder = a.estado.localeCompare(b.estado);
                            if (state.q) {
                                return this.compareWithPreferenceAndMatch(a, b, state.q, preferredBrands, stateOrder);
                            }
                            if (shouldUsePreferredBrands) {
                                return this.compareWithPreferredBrandPriority(a, b, preferredBrands, stateOrder);
                            }
                            return this.compareWithPreferencePriority(a, b, stateOrder);
                        });
                        break;
                    default: // 'top'
                        filtered.sort((a, b) => {
                            const topOrder = a.top !== b.top ? (b.top ? 1 : -1) : 0;
                            const nameOrder = this.getNombreComercio(a).localeCompare(this.getNombreComercio(b));
                            const fallback = topOrder || nameOrder;
                            if (state.q) {
                                return this.compareWithPreferenceAndMatch(a, b, state.q, preferredBrands, fallback);
                            }
                            if (shouldUsePreferredBrands) {
                                return this.compareWithPreferredBrandPriority(a, b, preferredBrands, fallback);
                            }
                            return this.compareWithPreferencePriority(a, b, fallback);
                        });
                }

                // Paginación
                const startIndex = currentPage * this.ITEMS_PER_PAGE;
                const endIndex = startIndex + this.ITEMS_PER_PAGE;
                const paginatedResults = filtered.slice(0, endIndex);
                const hasMore = filtered.length > endIndex;

                resolve({ filtered: paginatedResults, hasMore });
            }, 0);
        });
    }

    /**
     * Obtiene el nombre del comercio
     */
    getNombreComercio(comercio: Comercio): string {
        return comercio.marca_tienda || comercio.razon_social;
    }

    /**
     * Obtiene ubicación completa
     */
    getUbicacionCompleta(comercio: Comercio): string {
        return `${comercio.municipio}, ${comercio.estado}`;
    }

    /**
     * Obtiene dirección completa
     */
    getDireccionCompleta(comercio: Comercio): string {
        return `${comercio.ubicacion}${comercio.colonia ? ', ' + comercio.colonia : ''}`;
    }

    /**
     * Normaliza texto para búsqueda (sin acentos, minúsculas)
     */
    normalize(text: string): string {
        return text.toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    /**
     * Verifica si el texto coincide con la búsqueda
     */
    private matchesSearch(searchText: string, query: string, partialMatch: boolean): boolean {
        const normalizedText = this.normalize(searchText);
        const normalizedQuery = this.normalize(query);

        if (partialMatch) {
            // Búsqueda parcial: coincide si contiene la cadena en cualquier parte
            return normalizedText.includes(normalizedQuery);
        } else {
            // Búsqueda exacta: solo palabras completas
            const words = normalizedText.split(/\s+/);
            const queryWords = normalizedQuery.split(/\s+/);

            // Cada palabra de la búsqueda debe coincidir EXACTAMENTE con alguna palabra del texto
            return queryWords.every(queryWord =>
                words.some(word => word === queryWord)
            );
        }
    }

    private compareWithPreferencePriority(a: Comercio, b: Comercio, fallback: number): number {
        const aHasPreference = (a.preference?.length ?? 0) > 0;
        const bHasPreference = (b.preference?.length ?? 0) > 0;
        if (aHasPreference !== bHasPreference) return aHasPreference ? -1 : 1;
        return fallback;
    }

    private compareWithPreferredBrandPriority(
        a: Comercio,
        b: Comercio,
        preferredBrands: string[],
        fallback: number
    ): number {
        const preferredOrder = this.comparePreferredBrands(a, b, preferredBrands);
        if (preferredOrder !== 0) return preferredOrder;
        return this.compareWithPreferencePriority(a, b, fallback);
    }

    private comparePreferredBrands(
        a: Comercio,
        b: Comercio,
        preferredBrands: string[]
    ): number {
        const aRank = this.getPreferredBrandRank(a, preferredBrands);
        const bRank = this.getPreferredBrandRank(b, preferredBrands);
        const aMatches = aRank !== -1;
        const bMatches = bRank !== -1;
        if (aMatches !== bMatches) return aMatches ? -1 : 1;
        if (aMatches && bMatches && aRank !== bRank) return aRank - bRank;
        return 0;
    }

    private matchesPreferredBrands(comercio: Comercio, preferredBrands: string[]): boolean {
        return this.getPreferredBrandRank(comercio, preferredBrands) !== -1;
    }

    private getPreferredBrandRank(comercio: Comercio, preferredBrands: string[]): number {
        const normalizedName = this.normalize(this.getNombreComercio(comercio));

        return preferredBrands.findIndex(brand => {
            const normalizedBrand = this.normalize(brand);
            if (!normalizedBrand) return false;
            return normalizedName.includes(normalizedBrand);
        });
    }

    private compareWithPreferenceAndMatch(
        a: Comercio,
        b: Comercio,
        query: string,
        preferredBrands: string[],
        fallback: number
    ): number {
        const aScore = this.getNombreMatchScore(a, query);
        const bScore = this.getNombreMatchScore(b, query);
        if (aScore !== bScore) return bScore - aScore;

        const preferredOrder = this.comparePreferredBrands(a, b, preferredBrands);
        if (preferredOrder !== 0) return preferredOrder;

        if (aScore > 0) return fallback;

        const preferenceOrder = this.compareWithPreferencePriority(a, b, 0);
        if (preferenceOrder !== 0) return preferenceOrder;

        return fallback;
    }

    private getNombreMatchScore(comercio: Comercio, query: string): number {
        const nombre = this.normalize(this.getNombreComercio(comercio));
        const normalizedQuery = this.normalize(query).trim();
        if (!normalizedQuery) return 0;

        if (nombre === normalizedQuery) return 3;
        if (nombre.startsWith(normalizedQuery)) return 2;
        if (nombre.includes(normalizedQuery)) return 1;
        return 0;
    }

    /**
     * Divide array en chunks
     */
    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Genera URL de Google Maps
     */
    getMapUrl(comercio: Comercio): string {
        const nombre = this.getNombreComercio(comercio);
        const direccion = this.getDireccionCompleta(comercio);
        const ubicacion = this.getUbicacionCompleta(comercio);
        const query = encodeURIComponent(`${nombre} ${direccion} ${ubicacion}`);
        return `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
}
