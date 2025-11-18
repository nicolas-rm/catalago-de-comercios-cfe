import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Comercio, FilterState, LoadingState } from '../models/comercio.model';

@Injectable({
    providedIn: 'root'
})
export class ComercioService {
    private readonly ITEMS_PER_PAGE = 50;
    private readonly CHUNK_SIZE = 1000;

    constructor(private http: HttpClient) {}

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

            const response = await this.http.get<Comercio[]>(jsonPath).toPromise();
            const data = response || [];

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
     * Procesa datos en chunks para no bloquear la UI
     */
    private async processDataInChunks(
        data: Comercio[],
        updateLoadingState: (state: Partial<LoadingState>) => void,
        excludeFilter?: (comercio: Comercio) => boolean
    ): Promise<Comercio[]> {
        const chunks = this.chunkArray(data, this.CHUNK_SIZE);
        let processedData: Comercio[] = [];
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

                    processedData = [...processedData, ...chunkWithIds];

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
        currentPage: number
    ): Promise<{ filtered: Comercio[]; hasMore: boolean }> {
        return new Promise(resolve => {
            setTimeout(() => {
                let filtered = [...comercios];

                // Filtro por estado
                if (state.estado) {
                    filtered = filtered.filter(c => c.estado === state.estado);
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
                        // Si "Búsqueda flexible" está activado: buscar con coincidencia parcial
                        // en campos principales o direcciones (según la opción seleccionada)
                        if (state.partialMatch) {
                            const fieldsToSearch = state.includeAddress
                                ? [
                                    c.tienda_ubicacion,
                                    c.ubicacion,
                                    c.colonia,
                                    c.municipio,
                                    c.estado
                                ]
                                : [
                                    c.razon_social,
                                    c.marca_tienda,
                                    c.rfc
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
                                c.estado
                            ];
                            const searchText = addressFields.filter(Boolean).join(' ');
                            return this.matchesSearch(searchText, query, false);
                        } else {
                            // Buscar SOLO en campos principales (nombre, marca, RFC)
                            const mainFields = [
                                c.razon_social,
                                c.marca_tienda,
                                c.rfc
                            ];
                            const searchText = mainFields.filter(Boolean).join(' ');
                            return this.matchesSearch(searchText, query, false);
                        }
                    });
                }

                // Ordenamiento
                switch (state.sort) {
                    case 'az':
                        filtered.sort((a, b) =>
                            this.getNombreComercio(a).localeCompare(this.getNombreComercio(b))
                        );
                        break;
                    case 'estado':
                        filtered.sort((a, b) => a.estado.localeCompare(b.estado));
                        break;
                    default: // 'top'
                        filtered.sort((a, b) => {
                            if (a.top !== b.top) return b.top ? 1 : -1;
                            return this.getNombreComercio(a).localeCompare(this.getNombreComercio(b));
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
