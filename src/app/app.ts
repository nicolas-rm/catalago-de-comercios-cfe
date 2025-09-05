import { Component, signal, computed, ViewChild, ElementRef, OnInit, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// Interfaces para tipos de datos
interface Comercio {
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

interface FilterState {
    q: string;
    estado: string;
    municipio: string;
    sort: 'top' | 'az' | 'estado';
}

@Component({
    selector: 'app-root',
    imports: [],
    templateUrl: './app.html',
    styleUrl: './app.css'
})
export class App implements OnInit {
    // Señales para el estado reactivo
    protected readonly comercios = signal<Comercio[]>([]);
    protected readonly loading = signal(true);
    protected readonly filterState = signal<FilterState>({
        q: '',
        estado: '',
        municipio: '',
        sort: 'top'
    });

    // ViewChild para acceder al contenedor de tops
    @ViewChild('topsContainer') topsContainer?: ElementRef<HTMLElement>;

    // Computed signals para datos derivados
    protected readonly estados = computed(() => {
        const estadosSet = new Set(this.comercios().map(c => c.estado));
        return Array.from(estadosSet).filter(Boolean).sort();
    });

    protected readonly municipios = computed(() => {
        const municipiosSet = new Set(this.comercios().map(c => c.municipio));
        return Array.from(municipiosSet).filter(Boolean).sort();
    });

    protected readonly topComercios = computed(() => {
        return this.comercios().filter(c => c.top);
    });

    protected readonly filteredComercios = computed(() => {
        const state = this.filterState();
        let filtered = this.comercios();

        // Aplicar filtros
        if (state.estado) {
            filtered = filtered.filter(c => c.estado === state.estado);
        }

        if (state.municipio) {
            filtered = filtered.filter(c =>
                c.municipio.toLowerCase().includes(state.municipio.toLowerCase())
            );
        }

        if (state.q) {
            const query = this.normalize(state.q);
            filtered = filtered.filter(c => {
                const searchText = this.normalize([
                    c.razon_social,
                    c.marca_tienda,
                    c.tienda_ubicacion,
                    c.ubicacion,
                    c.colonia,
                    c.municipio,
                    c.estado,
                    c.rfc
                ].filter(Boolean).join(' '));
                return searchText.includes(query);
            });
        }

        // Aplicar ordenamiento
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

        return filtered;
    });

    protected readonly currentYear = computed(() => new Date().getFullYear());

    constructor(private http: HttpClient) {
        // Effect para debug
        effect(() => {
            console.log('Comercios cargados:', this.comercios().length);
            console.log('Comercios filtrados:', this.filteredComercios().length);
        });
    }

    async ngOnInit() {
        await this.cargarComercios();
    }

    // Métodos públicos para el template
    protected getNombreComercio(comercio: Comercio): string {
        return comercio.marca_tienda || comercio.razon_social;
    }

    protected getUbicacionTexto(comercio: Comercio): string {
        return `${comercio.municipio}, ${comercio.estado}`;
    }

    protected getDireccionCompleta(comercio: Comercio): string {
        return `${comercio.ubicacion}${comercio.colonia ? ', ' + comercio.colonia : ''}`;
    }

    protected getUbicacionCompleta(comercio: Comercio): string {
        return `${comercio.municipio}, ${comercio.estado}`;
    }

    protected verEnMapa(comercio: Comercio): void {
        const nombre = this.getNombreComercio(comercio);
        const direccion = this.getDireccionCompleta(comercio);
        const ubicacion = this.getUbicacionCompleta(comercio);
        const query = encodeURIComponent(`${nombre} ${direccion} ${ubicacion}`);
        const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
        window.open(url, '_blank');
    }

    protected downloadCSV(): void {
        // Implementar descarga de CSV
        const csvContent = this.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'comercios_cfe.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    protected onSearchChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.updateFilterState({ q: target.value });
    }

    protected onEstadoChange(event: Event): void {
        const target = event.target as HTMLSelectElement;
        this.updateFilterState({ estado: target.value });
    }

    protected onMunicipioChange(event: Event): void {
        const target = event.target as HTMLSelectElement;
        this.updateFilterState({ municipio: target.value });
    }

    protected onSortChange(event: Event): void {
        const target = event.target as HTMLSelectElement;
        this.updateFilterState({ sort: target.value as FilterState['sort'] });
    }

    protected resetFilters(): void {
        this.filterState.set({
            q: '',
            estado: '',
            municipio: '',
            sort: 'top'
        });

        // Reset form values
        this.resetFormInputs();
    }

    protected scrollTops(direction: number): void {
        const container = this.topsContainer?.nativeElement;
        if (container) {
            container.scrollBy({
                left: direction * 320,
                behavior: 'smooth'
            });
        }
    }

    // Métodos privados
    private async cargarComercios(): Promise<void> {
        try {
            this.loading.set(true);

            // Simular carga de datos desde JSON
            // En un caso real, aquí haríamos: this.http.get<Comercio[]>('./assets/comercios.json')
            const mockData: Comercio[] = await this.getMockData();

            this.comercios.set(mockData);
        } catch (error) {
            console.error('Error cargando comercios:', error);
            // Manejar error apropiadamente
        } finally {
            this.loading.set(false);
        }
    }

    private async getMockData(): Promise<Comercio[]> {
        // Datos de ejemplo para demostración
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([
                    {
                        id: '1',
                        razon_social: 'Tienda CFE Principal',
                        marca_tienda: 'CFE Servicios',
                        ubicacion: 'Av. Reforma 123',
                        colonia: 'Centro',
                        municipio: 'Ciudad de México',
                        estado: 'CDMX',
                        cp: '06000',
                        rfc: 'CFE123456789',
                        top: true
                    },
                    {
                        id: '2',
                        razon_social: 'Comercial Eléctrica del Norte',
                        marca_tienda: 'ElectroNorte',
                        ubicacion: 'Calle Hidalgo 456',
                        colonia: 'Norte',
                        municipio: 'Monterrey',
                        estado: 'Nuevo León',
                        cp: '64000',
                        rfc: 'CEN987654321',
                        top: true
                    },
                    {
                        id: '3',
                        razon_social: 'Distribuidora Eléctrica Sur',
                        marca_tienda: 'ElectroSur',
                        ubicacion: 'Av. Juárez 789',
                        colonia: 'Sur',
                        municipio: 'Guadalajara',
                        estado: 'Jalisco',
                        cp: '44100',
                        rfc: 'DES456789123'
                    },
                    {
                        id: '4',
                        razon_social: 'Materiales Eléctricos del Oeste',
                        marca_tienda: 'MatElec',
                        ubicacion: 'Blvd. Zapata 321',
                        colonia: 'Oeste',
                        municipio: 'Tijuana',
                        estado: 'Baja California',
                        cp: '22000',
                        rfc: 'MEO789123456'
                    },
                    {
                        id: '5',
                        razon_social: 'CFE Sucursal Este',
                        marca_tienda: 'CFE Este',
                        ubicacion: 'Av. 5 de Mayo 654',
                        colonia: 'Este',
                        municipio: 'Puebla',
                        estado: 'Puebla',
                        cp: '72000',
                        rfc: 'CSE321654987',
                        top: true
                    }
                ]);
            }, 1000); // Simular delay de carga
        });
    }

    private updateFilterState(update: Partial<FilterState>): void {
        this.filterState.update(current => ({ ...current, ...update }));
    }

    private resetFormInputs(): void {
        // Reset inputs using ViewChild references would be better, but for now use signals
        // The filterState reset will trigger the UI to update via the signal binding
        // We don't need to manually reset form values since Angular's signal binding handles it
    }

    private normalize(text: string): string {
        return text.toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    private generateCSV(): string {
        const headers = ['Razón Social', 'Marca/Tienda', 'Dirección', 'Colonia', 'Municipio', 'Estado', 'CP', 'RFC'];
        const rows = this.filteredComercios().map(comercio => [
            comercio.razon_social,
            comercio.marca_tienda || '',
            comercio.ubicacion,
            comercio.colonia || '',
            comercio.municipio,
            comercio.estado,
            comercio.cp || '',
            comercio.rfc || ''
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        return '\ufeff' + csvContent; // BOM para Excel
    }
}
