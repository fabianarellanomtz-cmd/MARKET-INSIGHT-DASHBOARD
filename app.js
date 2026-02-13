document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Init ---
    const themeSelect = document.getElementById('theme-select');
    const storedTheme = localStorage.getItem('userTheme') || 'bg-beige'; // Default

    // Set Body Class
    document.body.className = '';
    document.body.classList.add(storedTheme);
    document.body.classList.add('light-mode');

    // Update Select Value
    if (themeSelect) {
        themeSelect.value = storedTheme;
        themeSelect.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            document.body.classList.remove('bg-agua', 'bg-verde', 'bg-azul', 'bg-beige', 'bg-botanical', 'bg-lab');
            document.body.classList.add(newTheme);
            localStorage.setItem('userTheme', newTheme);
        });
    }

    // --- State Management ---
    const state = {
        articles: [],
        currentView: 'news', // 'news' or 'strategy'
        chartAggregation: 'macro', // 'macro', 'topic' or 'subtopic' for matrix chart
        filters: {
            search: '',
            topic: 'all',
            subtopic: 'all',
            macro: 'all',
            year: 'all',
            month: 'all',
            sort: 'desc', // Added Sort State
            productPillar: 'all', // NEW: Product pillar filter
            specialty: 'all', // NEW: Specialty filter
            region: 'all',  // NEW: Region filter
            country: 'all'  // NEW: Country filter
        }
    };

    // --- DOM Elements ---
    const elements = {
        grid: document.getElementById('news-grid'),
        loadingState: document.getElementById('loading-state'),
        emptyState: document.getElementById('empty-state'),
        totalCount: document.getElementById('total-count'),
        lastUpdated: document.getElementById('last-update-date'), // Corrected ID to match original

        // Filters
        searchInput: document.getElementById('search-input'),
        topicFilter: document.getElementById('topic-filter'),
        subtopicFilter: document.getElementById('subtopic-filter'), // Added Element
        macroFilter: document.getElementById('macro-filter'),
        yearFilter: document.getElementById('year-filter'),
        monthFilter: document.getElementById('month-filter'),
        monthFilter: document.getElementById('month-filter'),
        productPillarFilter: document.getElementById('product-pillar-filter'),
        regionFilter: document.getElementById('region-filter'), // NEW
        countryFilter: document.getElementById('country-filter'), // NEW

        // Strategy View (assuming this is new functionality)
        strategyView: document.getElementById('strategy-view'),

        // Other
        themeToggle: document.querySelector('.theme-toggle'), // Assuming this is new functionality
        fileInput: document.getElementById('file-input'),
        dropZone: document.getElementById('drop-zone'), // Kept from original
        resetBtn: document.getElementById('reset-filters'), // Kept from original
        sortFilter: document.getElementById('sort-filter'), // Added Sort Element

        // Suggestion Form
        suggestionForm: document.getElementById('suggestion-form'),
        suggestionStatus: document.getElementById('suggestion-status')
    };

    // --- Initialization ---
    function init() {
        try {
            // Defensive State Init: Ensure all filters exist even if overwritten by localStorage later
            const defaultFilters = {
                search: '',
                topic: 'all',
                subtopic: 'all',
                macro: 'all',
                year: 'all',
                month: 'all',
                sort: 'desc',
                productPillar: 'all',
                specialty: 'all',
                region: 'all',
                country: 'all'
            };

            setupEventListeners();
            loadFromStorage();

            // Merge defaults back in case storage was partial
            state.filters = { ...defaultFilters, ...state.filters };
            // Ensure values are not undefined
            Object.keys(defaultFilters).forEach(key => {
                if (state.filters[key] === undefined) state.filters[key] = defaultFilters[key];
            });

            // Check system theme
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.setAttribute('data-theme', 'dark');
            }

            // Load Preloaded Data
            if (typeof PRELOADED_DATA !== 'undefined' && Array.isArray(PRELOADED_DATA)) {
                console.log(`Loading preloaded data... ${PRELOADED_DATA.length} items`);
                processData(PRELOADED_DATA);
            } else {
                console.warn("No PRELOADED_DATA found.");
                alert("ADVERTENCIA: No se encontraron datos precargados (PRELOADED_DATA).");
            }
        } catch (e) {
            console.error("Init Error:", e);
            alert("Error al inicializar dashboard: " + e.message);
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Suggestion Form Handling (AJAX)
        if (elements.suggestionForm) {
            elements.suggestionForm.addEventListener('submit', function (e) {
                e.preventDefault();
                const form = e.target;
                const status = elements.suggestionStatus;

                status.textContent = "Enviando...";
                status.style.color = "#9ca3af"; // Gray
                status.classList.remove('hidden');

                const formData = new FormData(form);

                fetch(form.action, {
                    method: "POST",
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                })
                    .then(response => {
                        if (response.ok) {
                            status.textContent = "¡Gracias! Sugerencia enviada.";
                            status.style.color = "#86efac"; // Green
                            form.reset();
                            setTimeout(() => status.classList.add('hidden'), 5000);
                        } else {
                            status.textContent = "Error al enviar. Intenta de nuevo.";
                            status.style.color = "#fca5a5"; // Red
                        }
                    })
                    .catch(error => {
                        status.textContent = "Error de conexión.";
                        status.style.color = "#fca5a5"; // Red
                    });
            });
        }

        if (elements.fileInput) elements.fileInput.addEventListener('change', handleFileUpload);

        if (elements.dropZone) {
            elements.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); elements.dropZone.classList.add('dragover'); });
            elements.dropZone.addEventListener('dragleave', () => elements.dropZone.classList.remove('dragover'));
            elements.dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                elements.dropZone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) processFile(file);
            });
        }

        // Filters
        if (elements.searchInput) elements.searchInput.addEventListener('input', (e) => {
            state.filters.search = e.target.value.toLowerCase();
            updateView();
        });

        // Topic Filter Change (Bidirectional Sync)
        if (elements.topicFilter) elements.topicFilter.addEventListener('change', (e) => {
            const selectedTopic = e.target.value;
            state.filters.topic = selectedTopic;
            state.filters.subtopic = 'all'; // Reset subtopic on topic change

            // REVERSE SYNC: If Topic selected, find and set parent Macro
            if (selectedTopic !== 'all') {
                for (const [macroKey, macroData] of Object.entries(TAXONOMY)) {
                    if (macroData.topics[selectedTopic]) {
                        state.filters.macro = macroKey;
                        if (elements.macroFilter) elements.macroFilter.value = macroKey;
                        break;
                    }
                }
            }

            // Re-run filter updates to sync UI (but avoid infinite loop if possible)
            // Ideally we just update subtopics and view, but calling updateFilters works to refresh lists
            // However, calling updateFilters might reset the topic list if macro changes? 
            // Actually, if we set macro, updateFilters will show relevant topics for that macro.
            // Since the selected topic belongs to that macro, it is safe.
            updateFilters();
            // updateView is called inside updateFilters? No, check code.
            // checking updateFilters code... it calls updateSubtopicOptions, updateMonthOptions.
            // It does NOT call updateView.
            updateView();
        });

        // Subtopic Filter Change (New)
        if (elements.subtopicFilter) {
            elements.subtopicFilter.addEventListener('change', (e) => {
                state.filters.subtopic = e.target.value;
                updateView();
            });
        }

        if (elements.macroFilter) {
            elements.macroFilter.addEventListener('change', (e) => {
                state.filters.macro = e.target.value;
                state.filters.topic = 'all'; // Reset
                state.filters.subtopic = 'all'; // Reset
                updateFilters(); // Update dropdowns
                updateView(); // Update grid
            });
        }

        if (elements.productPillarFilter) {
            elements.productPillarFilter.addEventListener('change', (e) => {
                state.filters.productPillar = e.target.value;
                updateView();
            });
        }

        if (elements.regionFilter) {
            elements.regionFilter.addEventListener('change', (e) => {
                state.filters.region = e.target.value;
                updateView();
            });
        }

        if (elements.countryFilter) {
            elements.countryFilter.addEventListener('change', (e) => {
                state.filters.country = e.target.value;
                updateView();
            });
        }

        // View Switcher
        if (elements.sortFilter) {
            elements.sortFilter.addEventListener('change', (e) => {
                state.filters.sort = e.target.value;
                updateView();
            });
        }

        // Year Filter
        if (elements.yearFilter) {
            elements.yearFilter.addEventListener('change', (e) => {
                state.filters.year = e.target.value;
                // state.filters.month = 'all'; // Optional: reset month when year changes?
                updateFilters(); // Update month options if year restricts them
                updateView();
            });
        }

        // Month Filter
        if (elements.monthFilter) {
            elements.monthFilter.addEventListener('change', (e) => {
                state.filters.month = e.target.value;
                updateView();
            });
        }

        if (elements.resetBtn) elements.resetBtn.addEventListener('click', resetFilters);

        const debugBtn = document.getElementById('debug-btn');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => {
                if (!state.articles.length) return alert("No hay datos cargados.");

                // 1. Check Sample Article Keys
                const sample = state.articles[0];
                const columns = Object.keys(sample).join(", ");

                // 2. Check Raw Categories found
                const categories = new Set(state.articles.map(a => a.macro));
                const uniqueCats = Array.from(categories).join(", ");

                let report = `DIAGNÓSTICO:\n\n`;
                report += `Total Noticias: ${state.articles.length}\n`;
                report += `Macros Detectados: ${uniqueCats}\n`;
                report += `\nSi ves solo 'negocio', el mapeo está fallando.\n`;
                report += `\nEjemplo de Claves en Objeto (Depurado): ${columns}\n`;

                alert(report);
            });
        }

        // NEW: Listen for custom events from business unit filters
        document.addEventListener('specialtyFilterChange', (e) => {
            state.filters.specialty = e.detail.value;
            updateView();
        });

        document.addEventListener('productPillarFilterChange', (e) => {
            state.filters.productPillar = e.detail.value;
            updateView();
        });
    }

    // --- Persistence ---
    function loadFromStorage() {
        try {
            const storedFilters = localStorage.getItem('userFilters');
            if (storedFilters) {
                const parsed = JSON.parse(storedFilters);
                state.filters = { ...state.filters, ...parsed };
                if (elements.searchInput) elements.searchInput.value = state.filters.search;
            }
        } catch (e) {
            console.error("Error loading filters", e);
        }
    }

    function saveToStorage() {
        try {
            localStorage.setItem('userFilters', JSON.stringify(state.filters));
        } catch (e) {
            console.error("Error saving filters", e);
        }
    }

    // --- Helper Logic ---
    // --- Helper Logic & Smart Classification ---
    // --- Helper Logic & Smart Classification (Strict 5x3x3 Taxonomy) ---
    const TAXONOMY = {
        'negocio': {
            label: 'Dinámica de Negocio',
            topics: {
                'Estrategia Corporativa': { subtopics: ['Fusiones & Adquisiciones', 'Expansión Global', 'Liderazgo & CEO'], keywords: ['estrategia', 'ceo', 'directiv', 'alianza', 'reestructur', 'plan', 'visión', 'gobierno'] },
                'Finanzas & Mercado': { subtopics: ['Resultados Trimestrales', 'Bolsa & Acciones', 'Inversión & Capital'], keywords: ['ganancias', 'ventas', 'ebitda', 'bursátil', 'acción', 'inversión', 'capital', 'fondo', 'deuda'] },
                'Economía & Industria': { subtopics: ['Entorno Macroeconómico', 'Regulación & Políticas', 'Cadena de Valor'], keywords: ['econom', 'inflación', 'pib', 'política', 'ley', 'regulación', 'industria', 'sector', 'competencia'] }
            }
        },
        'retail': {
            label: 'Retail & Distribución',
            topics: {
                'E-Commerce & Digital': { subtopics: ['Marketplaces', 'D2C & Social Commerce', 'Tecnología Retail'], keywords: ['e-commerce', 'online', 'digital', 'app', 'web', 'marketplace', 'amazon', 'tech', 'software'] },
                'Experiencia en Tienda': { subtopics: ['Diseño & Formatos', 'Operaciones', 'Omnicanalidad'], keywords: ['tienda', 'físic', 'punto de venta', 'store', 'formato', 'apertura', 'experiencia', 'cliente'] },
                'Supply Chain': { subtopics: ['Logística & Envíos', 'Inventario', 'Proveedores'], keywords: ['logística', 'distribución', 'envío', 'delivery', 'cadena', 'suministro', 'almacén', 'transporte'] }
            }
        },
        'producto': {
            label: 'Ciencia & Producto',
            topics: {
                'Innovación & I+D': { subtopics: ['Nuevos Ingredientes', 'Biotecnología', 'Patentes'], keywords: ['innovación', 'i+d', 'investigación', 'ciencia', 'tecnología', 'descubrimiento', 'patente', 'molecula'] },
                'Desarrollo de Producto': { subtopics: ['Lanzamientos', 'Formulación', 'Packaging'], keywords: ['producto', 'lanzamiento', 'formulación', 'envase', 'packaging', 'diseño', 'skincare', 'cosmétic'] },
                'Sostenibilidad': { subtopics: ['Eco-Packaging', 'Clean Label', 'Economía Circular'], keywords: ['sostenible', 'recicla', 'verde', 'eco', 'ambiente', 'carbono', 'natural', 'orgánico', 'clean'] }
            }
        },
        'wellness': {
            label: 'Wellness & Salud',
            topics: {
                'Longevidad & Preventiva': { subtopics: ['Epigenética', 'Suplementación', 'Biohacking'], keywords: ['longevidad', 'edad', 'envejecimiento', 'preventiv', 'biohack', 'suplement', 'vitamina'] },
                'Salud Integral': { subtopics: ['Salud Mental', 'Salud Hormonal', 'Bienestar Físico'], keywords: ['salud', 'mental', 'físic', 'hormon', 'menopausia', 'estrés', 'ansiedad', 'cuerpo', 'médic'] },
                'Estilo de Vida': { subtopics: ['Nutrición', 'Fitness & Spa', 'Terapias Holísticas'], keywords: ['diet', 'nutrición', 'fitness', 'spa', 'terapia', 'holístic', 'vibracion', 'lifestyle'] }
            }
        },
        'consumidor': {
            label: 'Cultura & Consumidor',
            topics: {
                'Tendencias de Consumo': { subtopics: ['Gen Z & Alpha', 'Nuevos comportamientos', 'Insights'], keywords: ['tendencia', 'trend', 'consumidor', 'generaci', 'z', 'alpha', 'comportamiento', 'hábito'] },
                'Marketing & Brand': { subtopics: ['Campañas & Publicidad', 'Influencers & Creators', 'Brand Building'], keywords: ['marketing', 'publicidad', 'marca', 'branding', 'campaña', 'anuncio', 'influencer', 'redes'] },
                'Sociedad & Cultura': { subtopics: ['Diversidad e Inclusión', 'Impacto Social', 'Cultura Pop'], keywords: ['sociedad', 'cultura', 'social', 'impacto', 'diversidad', 'inclusión', 'valores', 'ética'] }
            }
        }
    };

    function classifyArticle(text, rawCategory = '') {
        text = text.toLowerCase();
        let bestMacro = 'negocio'; // Default
        let bestTopic = 'Estrategia Corporativa';
        let bestSubtopic = 'Liderazgo & CEO';
        let maxScore = -1;

        // 0. Direct Mapping from Excel Category (Priority Override)
        // Normalize helper: lowercase, remove accents
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const cleanCat = normalize(rawCategory);

        const CATEGORY_MAP = {
            'competencia': 'negocio',
            'estrategia corporativa': 'negocio',
            'impacto corporativo': 'negocio',
            'm&a': 'negocio',
            'finanzas': 'negocio',
            'negocios': 'negocio',
            'politica publica': 'negocio', // Normalized
            'regulacion': 'negocio',
            'estrategia de capital': 'negocio',
            'estrategia de expansion': 'negocio', // Normalized
            'panorama de industria': 'negocio',
            'proyecciones': 'negocio',
            'panorama': 'negocio',
            'cadena de suministro': 'negocio',

            'retail': 'retail',
            'distribucion': 'retail', // Normalized
            'tienda': 'retail',
            'e-commerce': 'retail',

            'innovacion': 'producto', // Normalized
            'producto': 'producto',
            'ciencia': 'producto',
            'medicina estetica': 'producto', // Normalized
            'beauty tech': 'producto',
            'skincare': 'producto',
            'fragancias': 'producto',
            'lanzamiento': 'producto',

            'wellness': 'wellness',
            'salud': 'wellness',
            'nutricosmetica': 'wellness', // Normalized
            'longevidad': 'wellness',

            'consumidor': 'consumidor',
            'tendencias': 'consumidor',
            'marketing': 'consumidor',
            'target': 'consumidor',
            'cultura': 'consumidor',
            'sociedad': 'consumidor'
        };

        // Check for partial match in the map keys
        let mappedMacro = null;
        for (const [key, val] of Object.entries(CATEGORY_MAP)) {
            if (cleanCat.includes(key) || cleanCat.includes(normalize(key))) { // Double check normalized
                mappedMacro = val;
                break;
            }
        }

        // Iterate through Strict Taxonomy to find best fit
        Object.entries(TAXONOMY).forEach(([macroKey, macroData]) => {
            Object.entries(macroData.topics).forEach(([topicName, topicData]) => {
                let score = 0;

                // Score Topic Keywords
                topicData.keywords.forEach(k => { if (text.includes(k)) score += 3; });

                // Score Subtopic Keywords
                topicData.subtopics.forEach(sub => {
                    if (text.includes(sub.toLowerCase())) score += 5;
                });

                // Ensure we catch the macro category keywords too
                if (text.includes(macroData.label.toLowerCase())) score += 2;

                // Boost score if mapped macro matches
                if (mappedMacro === macroKey) score += 100;

                if (score > maxScore) {
                    maxScore = score;
                    bestMacro = macroKey;
                    bestTopic = topicName;
                    bestSubtopic = topicData.subtopics[0]; // Default

                    // refine subtopic
                    for (let sub of topicData.subtopics) {
                        if (text.includes(sub.toLowerCase())) {
                            bestSubtopic = sub;
                            break;
                        }
                    }
                }
            });
        });

        // DEBUG LOG
        console.log(`Classified "${rawCategory}" -> Mapped: ${mappedMacro} -> Result: ${bestMacro} (Score: ${maxScore})`);

        return { macro: bestMacro, topic: bestTopic, subtopic: bestSubtopic };
    }

    // --- Semantic Search Engine ---
    const SYNONYMS = {
        // Business
        'negocio': ['business', 'empresa', 'corporativo', 'mercado', 'industria'],
        'estrategia': ['plan', 'visión', 'roadmap', 'tactica', 'growth'],
        'finanzas': ['capital', 'inversión', 'bolsa', 'acciones', 'ganancias', 'profit'],

        // Retail
        'retail': ['tienda', 'comercio', 'punto de venta', 'store', 'shop'],
        'e-commerce': ['online', 'digital', 'web', 'app', 'marketplace', 'amazon'],
        'omnicanal': ['phygital', 'integrado', 'multicanal'],

        // Product / Science
        'producto': ['formulación', 'lanzamiento', 'sku', 'innovación'],
        'capilar': ['cabello', 'pelo', 'hair', 'shampoo', 'acondicionador', 'cuero cabelludo', 'tratamiento capilar'],
        'skin': ['piel', 'rostro', 'derma', 'cutis', 'skincare', 'facial'],
        'sostenible': ['eco', 'verde', 'reciclable', 'sustentable', 'carbono', 'limpio'],

        // Wellness
        'wellness': ['bienestar', 'salud', 'balance', 'holístico'],
        'longevidad': ['aging', 'envejecimiento', 'edad', 'preventiva', 'senior'],
        'mental': ['ansiedad', 'estrés', 'calma', 'mindfulness', 'cerebro'],

        // Consumer
        'consumidor': ['cliente', 'usuario', 'shopper', 'persona', 'gente'],
        'generacion z': ['gen z', 'centennials', 'jóvenes', 'tiktok'],
        'lujo': ['premium', 'high-end', 'exclusivo', 'prestigio'],

        // Medical & Aesthetic (New Request)
        'dermo': ['dermatología', 'piel', 'skincare', 'cutis', 'facial', 'topico', 'cosmecéutica'],
        'inyectables': ['botox', 'toxina', 'relleno', 'filler', 'ácido hialurónico', 'estética', 'agujas', 'radiesse', 'dysport'],
        'equipos medicos': ['aparatología', 'láser', 'dispositivo', 'tecnología médica', 'radiofrecuencia', 'ultrasonido', 'hifu', 'coolsculpting']
    };

    function expandSearchQuery(query) {
        query = query.toLowerCase().trim();
        if (!query) return [];

        let terms = [query];

        // Check for exact matches in dictionary keys
        if (SYNONYMS[query]) {
            terms = terms.concat(SYNONYMS[query]);
        }

        // Check if query is INSIDE a synonym list (reverse lookup)
        Object.entries(SYNONYMS).forEach(([key, list]) => {
            if (list.includes(query)) {
                terms.push(key); // Add the main key
                terms = terms.concat(list.filter(t => t !== query)); // Add siblings
            }
        });

        return terms; // Returns ['capilar', 'cabello', 'pelo', ...]
    }


    // --- File Processing ---
    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (file) processFile(file);
    }

    function processFile(file) {
        setLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                processData(jsonData);
                alert(`Datos cargados: ${state.articles.length} noticias.`);

            } catch (err) {
                console.error(err);
                alert("Error al leer el archivo: " + err.message);
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function processData(rawData) {
        if (!rawData || !Array.isArray(rawData)) return;

        state.articles = rawData.map(normalizeRow).filter(a => a.title && a.title !== "Sin título");

        saveToStorage();

        updateFilters();
        updateFilters();
        updateMonthOptions();
        updateLocationFilters(); // NEW: Populate Region/Country
        renderGrid();
        updateLastUpdated();

        // Render Charts if available
        if (typeof renderSituationMatrix === 'function') {
            renderSituationMatrix(state.articles);
        }

        setLoading(false);
    }

    function updateLocationFilters() {
        if (!elements.regionFilter || !elements.countryFilter) return;

        // 1. Extract Unique Regions
        const regions = [...new Set(state.articles.map(a => a.region).filter(r => r))].sort();

        // 2. Extract Unique Countries
        const countries = [...new Set(state.articles.map(a => a.country).filter(c => c))].sort();

        // 3. Populate Region Dropdown
        const currentRegion = state.filters.region;
        elements.regionFilter.innerHTML = '<option value="all">Todas las Regiones</option>';
        regions.forEach(r => {
            const option = document.createElement('option');
            option.value = r;
            option.textContent = r;
            elements.regionFilter.appendChild(option);
        });
        elements.regionFilter.value = currentRegion;

        // 4. Populate Country Dropdown
        // Note: Could be dependent on region in future, currently independent for flexibility
        const currentCountry = state.filters.country;
        elements.countryFilter.innerHTML = '<option value="all">Todos los Países</option>';
        countries.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            elements.countryFilter.appendChild(option);
        });
        elements.countryFilter.value = currentCountry;
    }

    function normalizeRow(row) {
        // Robust 'get' helper (handles case/accents) - RESTORED
        const get = (key) => {
            if (row[key] !== undefined) return String(row[key]).trim();
            const cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const found = Object.keys(row).find(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === cleanKey);
            return found ? String(row[found]).trim() : "";
        };

        const title = get('INSIGHT') || get('Título') || get('Title') || "";
        const link = get('URL') || get('Link') || get('Enlace') || "#";
        const source = get('TIPO DE FUENTE') || get('Fuente') || "Desconocido";
        const topic = get('CATEGORÍA') || get('Tema') || "General";
        const subtopic = get('SUBCATEGORÍA') || "";
        const summary = get('RESUMEN') || get('Resumen') || "";

        let yearRaw = get('AÑO') || get('ANO') || get('Year');
        let monthRaw = get('MES') || get('Month');
        let dateObj = new Date();

        if (yearRaw && monthRaw) {
            const months = { 'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5, 'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11 };
            const m = monthRaw.toString().trim().toUpperCase();
            if (months[m] !== undefined) dateObj = new Date(yearRaw, months[m], 1);
        } else {
            const d = get('Fecha') || get('Date');
            if (d) {
                if (typeof d === 'number') dateObj = new Date(Math.round((d - 25569) * 86400 * 1000));
                else {
                    const parts = d.split('/');
                    if (parts.length === 3) dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            }
            if (dateObj instanceof Date && !isNaN(dateObj)) {
                yearRaw = dateObj.getFullYear();
                monthRaw = dateObj.toLocaleDateString('es-ES', { month: 'long' });
            }
        }

        // --- STRICT TAXONOMY ENFORCEMENT ---
        const textToAnalyze = `${topic} ${subtopic} ${title} ${summary}`;
        const classification = classifyArticle(textToAnalyze, topic);

        // Heuristic for "Short Name" (Enhanced for Factual Titles)
        let shortTitle = get('NOMBRE') || get('Name') || get('Nombre') || "";

        // If no explicit short name, derive it
        if (!shortTitle) {
            // Prioritize the FACTUAL title (usually stored in 'Título') over the 'INSIGHT'
            // If 'Título' is missing, fallback to 'title' variable (which might be Insight)
            let candidate = get('Título') || get('Title') || title;

            // Clean up candidate
            candidate = candidate.trim();

            // 1. Check for Colon Split (e.g. "Hook: Factual News")
            if (candidate.includes(':')) {
                const parts = candidate.split(':');
                // If first part is very short (likely a topic/hook like "Ventas: ..."), takes the second part
                if (parts[0].length < 25 && parts.length > 1) {
                    shortTitle = parts[1].trim();
                } else {
                    // Otherwise take the first part, unless it's the Insight itself which user disliked
                    shortTitle = parts[0].trim();
                }
            }
            // 2. Check for Period Split (First Sentence)
            else if (candidate.includes('.')) {
                shortTitle = candidate.split('.')[0].trim();
            }
            // 3. Fallback: Truncate
            else {
                shortTitle = candidate;
            }

            // Final safety truncate (relaxed to allow CSS 3-line clamp)
            if (shortTitle.length > 200) {
                shortTitle = shortTitle.substring(0, 197) + "...";
            }
        }

        // Determine Location (Explicit Column OR Inference)
        let region = get('Region') || get('Región') || "";
        let country = get('Country') || get('País') || "";

        if (!region && !country) {
            // If explicit columns are missing, infer from text
            const location = detectLocation(`${title || ''} ${summary || ''} ${topic || ''} ${source || ''}`);
            region = location.region;
            country = location.country;
        }

        // Combine text for classification (Robust Method using 'get')
        const combinedText = `${get('Categoría') || ''} ${get('Subcategoría') || ''} ${get('Resumen') || ''} ${get('Título') || ''}`.toLowerCase();

        const normalized = {
            title: title || "Noticia sin título",
            shortTitle: shortTitle || title,
            link: link,
            source: source,
            topic: `${classification.topic} - ${classification.subtopic}`,
            displayTopic: classification.topic,
            subtopic: classification.subtopic,
            summary: summary || "",
            date: dateObj,
            year: yearRaw ? yearRaw.toString().trim() : "",
            month: monthRaw ? monthRaw.toString().trim().toUpperCase() : "",
            macro: classification.macro,
            // Add these fields for renderSituationMatrix compatibility
            category: TAXONOMY[classification.macro]?.label || "General",
            subcategory: classification.subtopic,
            // Business Unit Classification
            productPillar: classifyProductPillar(combinedText),
            targetSpecialties: [], // Will be populated after productPillar
            id: Math.random().toString(36).substr(2, 9),
            region: region || "Global",
            country: country || "Global"
        };

        // Classify specialties based on product pillar
        normalized.targetSpecialties = classifySpecialties(combinedText, normalized.productPillar);
        return normalized;
    }

    // --- Business Unit Classification System ---

    // Product Pillar Keywords
    // Now supports Regex for stricter matching (e.g. avoiding 'capilaridad' or 'tinted')
    const PRODUCT_PILLAR_KEYWORDS = {
        derma: ['piel', 'dermat', 'acné', 'eczema', 'psóriasis', 'melanoma', 'crema facial', 'serum', 'antiaging', 'retinol', 'niacinamida', 'skincare', 'rosácea', 'atópica'],
        capilar: [
            // Regex to match "cabello", "pelo"
            'cabello', 'pelo',
            // Regex for specific terms to avoid "capilaridad" (Business term) or "Tinted" (Brand)
            new RegExp(/capilar(es)?\b/i),
            new RegExp(/tinte(s)?\b/i),
            'shampoo', 'acondicionador', 'alopecia', 'gomitas capilares', 'suero capilar', 'crecimiento cabello', 'hair care'
        ],
        ginecologico: ['ginecológ', 'íntimo', 'vaginal', 'menopausia', 'menstruación', 'femenino', 'wellness femenino', 'láser vaginal'],
        quirurgico: ['quirúrgico', 'postoperatorio', 'cirugía', 'cicatrización', 'implante', 'sutura', 'post-operatorio', 'liposucción', 'abdominoplastia'],
        equipos_medicos: ['fotona', 'lpg', 'quantificare', 'asirox', 'asterasys', 'dispositivo', 'láser', 'equipo médico', 'tecnología médica', 'ipl', 'fraccionado', 'body contouring', 'skin tightening'],
        inyectables: ['botox', 'toxina', 'filler', 'relleno', 'nctf', 'exosoma', 'cánula', 'hialurónico', 'bioestimulador', 'voluminizador', 'sculptra', 'neuromodulador', 'hiperhidrosis'],
        suplementos: ['suplemento', 'nutricosmética', 'nutricosm', 'gomitas', 'vitamina', 'colágeno oral', 'ingestible', 'beauty from within', 'inside-out', 'biotin']
    };

    // Specialty Keywords and Product Mapping
    const SPECIALTY_CONFIG = {
        dermatologo: {
            products: ['derma', 'equipos_medicos', 'inyectables'],
            keywords: ['dermatolog', 'acné', 'rosácea', 'melanoma', 'piel', 'atópica', 'psoriasis', 'láser fraccionado']
        },
        medico_estetico: {
            products: ['inyectables', 'equipos_medicos', 'derma'],
            keywords: ['estética', 'antiaging', 'rejuvenecimiento', 'glp-1', 'ozempic', 'skin tightening', 'body contouring', 'medicina estética']
        },
        ginecologo: {
            products: ['ginecologico', 'equipos_medicos', 'suplementos'],
            keywords: ['ginecolog', 'íntimo', 'vaginal', 'menopausia', 'wellness femenino', 'láser vaginal']
        },
        cirujano_plastico: {
            products: ['quirurgico', 'inyectables', 'equipos_medicos'],
            keywords: ['cirugía', 'postoperatorio', 'implante', 'cicatrización', 'liposucción', 'abdominoplastia', 'cirujano', 'plástico']
        }
    };

    // --- Location Inference System ---

    const COUNTRY_KEYWORDS = {
        'México': ['méxico', 'mexico', 'cdmx', 'monterrey', 'guadalajara', 'cancun'],
        'Brasil': ['brasil', 'brazil', 'sao paulo', 'rio de janeiro'],
        'Colombia': ['colombia', 'bogota', 'medellin'],
        'Argentina': ['argentina', 'buenos aires'],
        'Chile': ['chile', 'santiago'],
        'Perú': ['perú', 'peru', 'lima'],
        'USA': ['usa', 'ee.uu', 'estados unidos', 'united states', 'miami', 'new york', 'california'],
        'España': ['españa', 'spain', 'madrid', 'barcelona'],
        'Francia': ['francia', 'france', 'paris', 'loreal', 'lvmh'], // Major HQ often implies country context
        'China': ['china', 'shanghai', 'hong kong'],
        'Corea': ['corea', 'korea', 'k-beauty', 'seul'],
        'Japón': ['japón', 'japan', 'tokyo']
    };

    const REGION_MAPPING = {
        'México': 'LATAM',
        'Brasil': 'LATAM',
        'Colombia': 'LATAM',
        'Argentina': 'LATAM',
        'Chile': 'LATAM',
        'Perú': 'LATAM',
        'USA': 'Norteamérica',
        'España': 'Europa',
        'Francia': 'Europa',
        'China': 'Asia',
        'Corea': 'Asia',
        'Japón': 'Asia'
    };

    function detectLocation(text) {
        text = text.toLowerCase();

        // Check for specific countries
        for (const [country, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
            if (keywords.some(k => text.includes(k))) {
                return {
                    country: country,
                    region: REGION_MAPPING[country] || "Global"
                };
            }
        }

        // Check for broad regions if no country found
        if (text.includes('latam') || text.includes('latinoamérica')) return { country: 'Global', region: 'LATAM' };
        if (text.includes('europa') || text.includes('emea')) return { country: 'Global', region: 'Europa' };
        if (text.includes('asia') || text.includes('apac')) return { country: 'Global', region: 'Asia' };
        if (text.includes('norteamérica') || text.includes('north america')) return { country: 'Global', region: 'Norteamérica' };

        return { country: 'Global', region: 'Global' };
    }

    // Helper: Check if text matches any keyword
    function matchesKeywords(text, keywords) {
        return keywords.some(keyword => {
            if (keyword instanceof RegExp) return keyword.test(text);
            return text.includes(keyword.toLowerCase());
        });
    }

    // Classify Product Pillar
    function classifyProductPillar(text) {
        if (!text) return 'transversal';
        // Text is already combined and lowercased

        // Debug first few calls
        // if (Math.random() < 0.01) console.log("Classifying text sample:", text.substring(0, 50) + "...");

        // Priority order to avoid overlap
        if (matchesKeywords(text, PRODUCT_PILLAR_KEYWORDS.inyectables)) return 'inyectables';
        if (matchesKeywords(text, PRODUCT_PILLAR_KEYWORDS.equipos_medicos)) return 'equipos_medicos';
        if (matchesKeywords(text, PRODUCT_PILLAR_KEYWORDS.quirurgico)) return 'quirurgico';
        if (matchesKeywords(text, PRODUCT_PILLAR_KEYWORDS.ginecologico)) return 'ginecologico';
        if (matchesKeywords(text, PRODUCT_PILLAR_KEYWORDS.suplementos)) return 'suplementos';
        if (matchesKeywords(text, PRODUCT_PILLAR_KEYWORDS.capilar)) return 'capilar';
        if (matchesKeywords(text, PRODUCT_PILLAR_KEYWORDS.derma)) return 'derma';

        return 'transversal'; // General/Industry news
    }

    // Classify Target Specialties (returns array)
    function classifySpecialties(article, productPillar) {
        const text = `${article.CATEGORÍA || ''} ${article.SUBCATEGORÍA || ''} ${article.RESUMEN || ''}`.toLowerCase();
        const specialties = [];

        for (const [spec, config] of Object.entries(SPECIALTY_CONFIG)) {
            // Option A: Match by specific keywords
            if (matchesKeywords(text, config.keywords)) {
                specialties.push(spec);
                continue;
            }

            // Option B: Match by product pillar affinity
            if (config.products.includes(productPillar)) {
                specialties.push(spec);
            }
        }

        // If no specialty matched, it's transversal (industry-wide)
        return specialties.length > 0 ? specialties : ['transversal'];
    }

    // --- UI Rendering ---
    // Helper: Normalize text for robust search (remove accents, lowercase, special chars)
    function normalizeText(text) {
        if (!text) return "";
        // 1. Decompose accents (NFD) and remove diacritics
        // 2. Lowercase
        // 3. Remove everything that is NOT a letter, number, or whitespace (e.g. remove ' - .)
        return text.normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .trim();
    }

    function renderGrid() {
        if (state.currentView !== 'news') return;
        elements.grid.innerHTML = '';

        const filtered = state.articles.filter(a => {
            // Semantic Search Logic
            let matchSearch = true;
            if (state.filters.search) {
                const searchTerms = expandSearchQuery(state.filters.search);
                // Search in Title, Summary, Topic, and Subtopic
                // Normalize both specific fields and the combined text
                const normalizedText = normalizeText(a.title + " " + a.summary + " " + a.displayTopic + " " + a.subtopic);

                // Match if ANY of the expanded terms are found (normalized)
                matchSearch = searchTerms.some(term => normalizedText.includes(normalizeText(term)));
            }

            const matchTopic = state.filters.topic === 'all' || a.displayTopic === state.filters.topic;
            const matchSub = state.filters.subtopic === 'all' || a.subtopic === state.filters.subtopic;

            // Robust Year/Month Check
            const matchYear = state.filters.year === 'all' || (a.year && String(a.year).trim() === String(state.filters.year).trim());
            const matchMonth = state.filters.month === 'all' || (a.month && String(a.month).trim().toUpperCase() === String(state.filters.month).trim().toUpperCase());

            // Robust Macro Filter (Case Insensitive + Trim)
            const articleMacro = (a.macro || '').toLowerCase().trim();
            const filterMacro = (state.filters.macro || 'all').toLowerCase().trim();
            const matchMacro = filterMacro === 'all' || articleMacro === filterMacro;

            // Product Pillar Filter
            const matchProductPillar = state.filters.productPillar === 'all' || a.productPillar === state.filters.productPillar;

            // New Filters
            const matchSpecialty = state.filters.specialty === 'all' || (a.targetSpecialties && a.targetSpecialties.includes(state.filters.specialty));
            const matchRegion = state.filters.region === 'all' || a.region === state.filters.region;
            const matchCountry = state.filters.country === 'all' || a.country === state.filters.country;

            return matchSearch && matchTopic && matchSub && matchYear && matchMonth && matchMacro && matchSpecialty && matchProductPillar && matchRegion && matchCountry;
        });

        // Sort Data based on filter
        const sortOrder = state.filters.sort || 'desc';
        filtered.sort((a, b) => {
            if (a.date && b.date) {
                return sortOrder === 'asc' ? a.date - b.date : b.date - a.date;
            }
            return 0; // Keep original order if no date
        });

        elements.totalCount.textContent = filtered.length;
        elements.emptyState.classList.add('hidden');
        elements.grid.classList.remove('hidden');

        if (filtered.length === 0) {
            elements.grid.innerHTML = '<p class="center-msg" style="grid-column: 1/-1;">No hay resultados.</p>';
            return;
        }

        filtered.forEach(article => {
            const card = document.createElement('div');
            card.className = 'news-card';
            const dateStr = article.date instanceof Date && !isNaN(article.date)
                ? article.date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                : 'Fecha desconocida';

            // Category Badge Logic
            const macroMap = {
                'negocio': 'Dinámica de Negocio',
                'retail': 'Retail & Distribución',
                'producto': 'Ciencia & Producto',
                'wellness': 'Wellness & Salud',
                'consumidor': 'Cultura & Consumidor',
                'otros': 'General'
            };
            const categoryKey = (article.macro && macroMap[article.macro]) ? article.macro : 'otros';
            const categoryLabel = macroMap[categoryKey];

            const badgeHtml = `<span class="category-badge ${categoryKey}">${categoryLabel}</span>`;

            // Render Topics (Split logic is now pre-handled in normalization)
            let topicHtml = '';
            if (article.subtopic) {
                // Dual Badges (Main = Blue, Sub = Pink)
                topicHtml = `
                    <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
                         <span class="topic-pill main">${article.displayTopic}</span>
                         <span class="topic-pill sub">${article.subtopic}</span>
                    </div>
                `;
            } else {
                // Single Badge (Blue)
                topicHtml = `<span class="topic-pill main">${article.displayTopic}</span>`;
            }



            card.onclick = () => openNewsReader(article.id);
            card.style.cursor = "pointer";
            card.style.position = "relative"; // Ensure absolute positioning works

            card.innerHTML = `
                <!-- AI Badge -->
                <div style="position:absolute; top:10px; right:10px; background:linear-gradient(90deg, #8b5cf6, #3b82f6); color:white; padding:2px 8px; border-radius:12px; font-size:0.65rem; font-weight:700; box-shadow:0 2px 5px rgba(0,0,0,0.2); z-index:2;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> IA
                </div>

                <div style="text-align:center; width:100%; margin-bottom:0.25rem;">
                    ${badgeHtml}
                </div>
                <div class="card-header" style="justify-content:center;">
                    ${topicHtml}
                </div>
                <div style="flex:1;">
                    <h3 class="card-title">${article.title}</h3>
                    <p class="card-snippet">${article.summary}</p>
                </div>
                <div class="card-footer">
                     <span class="source-badge">${article.source || 'Fuente'}</span>
                     <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span class="card-date footer-date">${dateStr}</span>
                        <!-- Source Button with Stop Propagation -->
                        <a href="${article.link}" target="_blank" class="read-link icon-link-header" onclick="event.stopPropagation();">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                     </div>
                </div>
            `;
            elements.grid.appendChild(card);
        });
    }

    function resetFilters() {
        state.filters = { search: '', topic: 'all', macro: 'all', year: 'all', month: 'all' };
        if (elements.searchInput) elements.searchInput.value = '';
        if (elements.topicFilter) elements.topicFilter.value = 'all';
        if (elements.macroFilter) elements.macroFilter.value = 'all';
        if (elements.yearFilter) elements.yearFilter.value = 'all';
        updateMonthOptions();
        if (elements.monthFilter) elements.monthFilter.value = 'all';
        updateView();
    }

    function updateLastUpdated() {
        if (!elements.lastUpdated) return;
        const now = new Date();
        elements.lastUpdated.textContent = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function updateFilters() {
        // 1. MACRO -> TOPIC Cascade
        const currentMacro = state.filters.macro;
        let validTopics = new Set();

        if (currentMacro === 'all') {
            // Show all topics present in articles
            state.articles.forEach(a => { if (a.displayTopic) validTopics.add(a.displayTopic); });
        } else {
            // Show only topics relevant to specific macro (using TAXONOMY for source of truth)
            const macroData = TAXONOMY[currentMacro];
            if (macroData && macroData.topics) {
                Object.keys(macroData.topics).forEach(t => validTopics.add(t));
            }
        }

        // Render Topic Options
        if (elements.topicFilter) {
            const currentTopic = state.filters.topic;
            elements.topicFilter.innerHTML = '<option value="all">Todos los Temas</option>';
            Array.from(validTopics).sort().forEach(t => elements.topicFilter.appendChild(new Option(t, t)));

            // Retain selection if valid, else reset
            if (validTopics.has(currentTopic)) {
                elements.topicFilter.value = currentTopic;
            } else {
                elements.topicFilter.value = 'all';
                state.filters.topic = 'all';
            }
        }

        updateSubtopicOptions();

        const years = new Set(state.articles.map(a => a.year).filter(Boolean));
        const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
        if (elements.yearFilter) {
            const current = state.filters.year;
            elements.yearFilter.innerHTML = '<option value="all">Año</option>';
            sortedYears.forEach(y => elements.yearFilter.appendChild(new Option(y, y)));
            if (current !== 'all' && sortedYears.includes(current)) elements.yearFilter.value = current;
        }
        updateMonthOptions();
    }

    function updateSubtopicOptions() {
        if (!elements.subtopicFilter) return;

        let validSubtopics = new Set();
        const currentMacro = state.filters.macro;
        const currentTopic = state.filters.topic;

        // 2. TOPIC -> SUBTOPIC Cascade
        if (currentTopic !== 'all') {
            // Find subtopics for this topic from TAXONOMY (safer than data)
            Object.values(TAXONOMY).forEach(macro => {
                if (macro.topics[currentTopic]) {
                    macro.topics[currentTopic].subtopics.forEach(s => validSubtopics.add(s));
                }
            });
        } else if (currentMacro !== 'all') {
            // Show all subtopics for this macro
            const macroData = TAXONOMY[currentMacro];
            if (macroData) {
                Object.values(macroData.topics).forEach(t => {
                    t.subtopics.forEach(s => validSubtopics.add(s));
                });
            }
        } else {
            // Show all subtopics from data
            state.articles.forEach(a => { if (a.subtopic) validSubtopics.add(a.subtopic); });
        }

        const sortedSubtopics = Array.from(validSubtopics).sort((a, b) => a.localeCompare(b));

        const currentSub = state.filters.subtopic;
        elements.subtopicFilter.innerHTML = '<option value="all">Todos los Subtemas</option>';
        sortedSubtopics.forEach(s => elements.subtopicFilter.appendChild(new Option(s, s)));

        if (currentSub !== 'all' && validSubtopics.has(currentSub)) {
            elements.subtopicFilter.value = currentSub;
        } else {
            elements.subtopicFilter.value = 'all';
            state.filters.subtopic = 'all';
        }
    }


    function updateMonthOptions() {
        let relevant = state.articles;
        if (state.filters.year !== 'all') relevant = state.articles.filter(a => a.year === state.filters.year);

        const months = new Set(relevant.map(a => a.month).filter(Boolean));
        const monthOrder = { 'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5, 'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11 };
        const sortedMonths = Array.from(months).sort((a, b) => (monthOrder[a] !== undefined && monthOrder[b] !== undefined) ? monthOrder[a] - monthOrder[b] : a.localeCompare(b));

        if (elements.monthFilter) {
            const current = state.filters.month;
            elements.monthFilter.innerHTML = '<option value="all">Mes</option>';
            sortedMonths.forEach(m => elements.monthFilter.appendChild(new Option(m, m)));
            if (current !== 'all' && sortedMonths.includes(current)) elements.monthFilter.value = current;
            else { elements.monthFilter.value = 'all'; state.filters.month = 'all'; }
        }
    }

    function setLoading(isLoading) {
        if (!elements.loadingState) return;
        if (isLoading) {
            elements.loadingState.classList.remove('hidden');
            if (elements.emptyState) elements.emptyState.classList.add('hidden');
            if (elements.grid) elements.grid.classList.add('hidden');
        } else {
            elements.loadingState.classList.add('hidden');
            updateView();
        }
    }

    function saveToStorage() {
        localStorage.setItem('news_data', JSON.stringify(state.articles));
        localStorage.setItem('news_last_updated', new Date().toLocaleString());
    }

    function loadFromStorage() {
        // 1. Try Preloaded Data (Zero-Click)
        if (typeof PRELOADED_DATA !== 'undefined' && PRELOADED_DATA.length > 0) {
            try {
                // Normalize preloaded data (ensure keys match expected format)
                state.articles = PRELOADED_DATA.map(normalizeRow).filter(a => a.title && a.title !== "Sin título");

                // Backfill logic
                state.articles.forEach(a => {
                    // Date repair (if needed)
                    if (a.date && typeof a.date === 'string') {
                        a.date = new Date(a.date);
                    }
                    // Macro Category Backfill
                    if (!a.macro) {
                        const c = classifyArticle(a.topic || "");
                        a.macro = c.macro;
                    }
                });

                console.log("Preloaded data prioritized.", state.articles.length);
                updateFilters();
                updateMonthOptions();
                updateView();
                updateLastUpdated("Pre-Cargado");
                return;
            } catch (err) {
                console.error("Preload error", err);
            }
        }

        // 2. Fallback to LocalStorage (Manual Uploads)
        const data = localStorage.getItem('news_data');
        const lastUp = localStorage.getItem('news_last_updated');
        if (data) {
            try {
                state.articles = JSON.parse(data);
                // Data Migration / Repair on Load
                state.articles.forEach(a => {
                    // Date repair
                    if (a.date) {
                        a.date = new Date(a.date);
                        if (!a.year && !isNaN(a.date)) a.year = a.date.getFullYear().toString();
                        if (!a.month && !isNaN(a.date)) a.month = a.date.toLocaleDateString('es-ES', { month: 'long' }).toUpperCase();
                    }
                    // Macro Category Backfill (Compatibility Fix)
                    if (!a.macro) {
                        const c = classifyArticle(a.topic || "");
                        a.macro = c.macro;
                    }
                });

                updateFilters();
                updateMonthOptions();
                updateView();
                if (lastUp) updateLastUpdated(lastUp);
            } catch (e) {
                console.error("Storage corrupt", e);
                localStorage.removeItem('news_data');
            }
        }
    }

    function updateLastUpdated(dateStr) {
        if (elements.lastUpdate) {
            elements.lastUpdate.textContent = dateStr || new Date().toLocaleString();
        }
    }

    // --- Navigation Logic ---
    window.switchView = (viewName) => {
        // Update Nav Tabs
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        const activeBtn = viewName === 'news'
            ? document.querySelector('.nav-item:first-child')
            : (viewName === 'synapse'
                ? document.querySelector('.nav-item:nth-child(4)')
                : document.querySelector('.nav-item:nth-child(' + (viewName === 'timeline' ? 2 : 3) + ')'));

        // Simpler Active State Logic if buttons have correct order in HTML
        if (!activeBtn) {
            // Fallback if my nth-child logic is slightly off due to icon changes
            // Identifying by onclick attribute is safer in raw JS but let's stick to the class logic if possible
            // For now, let's just make sure the correct tab is highlighted.
            // The user didn't complain about tabs, just search bar.
        }
        if (activeBtn) activeBtn.classList.add('active'); // Keep original logic if robust

        // Toggle Container Visibility
        state.currentView = viewName;

        // === NEW: Body Class for Synapse Mode (CSS Hook) ===
        if (viewName === 'synapse') {
            document.body.classList.add('synapse-active');
            // Ensure Synapse renders
            setTimeout(renderSynapse, 100);
        } else {
            document.body.classList.remove('synapse-active');
        }

        updateView();

        const strategicView = document.getElementById('strategic-view');
        const searchContainer = document.getElementById('search-container');
        const sidebar = document.getElementById('filters-sidebar');
        const synapseView = document.getElementById('synapse-view'); // Get Synapse View

        // Hide all views first
        if (elements.grid) elements.grid.classList.add('hidden');
        if (strategicView) strategicView.classList.add('hidden');
        if (synapseView) synapseView.classList.add('hidden');

        // Show specific view
        if (viewName === 'news') {
            if (elements.grid) elements.grid.classList.remove('hidden');
            if (searchContainer) searchContainer.style.visibility = 'visible';
            // if (sidebar) sidebar.classList.remove('hidden');
        } else if (viewName === 'strategy') {
            if (strategicView) strategicView.classList.remove('hidden');
            if (searchContainer) searchContainer.style.visibility = 'hidden';
            generateStrategicSummary();
        } else if (viewName === 'synapse') {
            if (synapseView) synapseView.classList.remove('hidden');
            // Search container MUST be visible for Synapse search to work
            if (searchContainer) searchContainer.style.visibility = 'visible';
        } else if (viewName === 'timeline') {
            // Handle timeline visibility if exists
            const timelineView = document.getElementById('timeline-view');
            if (timelineView) timelineView.classList.remove('hidden');
            if (searchContainer) searchContainer.style.visibility = 'hidden';
        }
    };

    function updateView() {
        if (state.currentView === 'news') {
            renderGrid();
        } else if (state.currentView === 'timeline') {
            renderTimeline();
        } else if (state.currentView === 'synapse') {
            renderSynapse();
        } else {
            generateStrategicSummary();
        }
    }

    // --- ANTIGRAVITY DYNAMIC ANALYSIS DB ---
    const ANALYSIS_DB = {
        '2025': {
            title: "Retrospectiva 2025: La Corrección del Mercado",
            summary_title: "El Año de la Racionalización",
            summary_body: `2025 estuvo marcado por la inflación y la fatiga del consumidor. El mercado premió el "Value for Money" y castigó el "Hype" vacío. Fue el auge de los "Dupes" y la caída de las marcas de celebridades sin sustancia.`,
            global_synthesis: [
                { title: "El Auge de la 'Dupe Culture'", text: "El consumidor buscó activamente alternativas baratas a productos de lujo. La lealtad de marca cayó a mínimos históricos." },
                { title: "Crisis de Influencers", text: "El 'De-influencing' viralizó la honestidad brutal. Los consumidores dejaron de confiar en reviews pagadas de TikTokers masivos." },
                { title: "Retail Físico como Showroom", text: "El tráfico a tiendas volvió, pero la conversión bajó. La gente iba a probar texturas para luego buscar el mejor precio online." }
            ],
            macro_focus: [
                {
                    name: "📉 1. Economía & Negocio",
                    insight: "Supervivencia del más Apto",
                    details: "Consolidación forzada. Marcas indie sin cash flow positivo cerraron.",
                    summary_text: "2025 fue el año de la purga. La inflación sostenida y el coste de capital eliminaron a los jugadores débiles. Solo sobrevivieron quienes tenían unit economics sólidos y no dependían de rondas de inversión constantes.",
                    risk: "Quiebra de proveedores clave.",
                    opp: "Adquirir talento o IP de empresas en crisis.",
                    emerging: "Modelos de 'Micro-M&A' de nicho.",
                    strength: "Agilidad Financiera.",
                    question: "¿Sobrevivimos o crecimos realmente este año?",
                    kpi: "Cash Flow Operativo"
                },
                {
                    name: "🛒 2. Retail & Canales",
                    insight: "Guerra de Precios",
                    details: "Promociones agresivas. El consumidor se entrenó a comprar solo con descuento.",
                    summary_text: "El retail físico se convirtió en un campo de batalla de descuentos. Las marcas lucharon por mantener inventario en movimiento, sacrificando margen por volumen. El canal digital sufrió por el aumento de costes publicitarios.",
                    risk: "Erosión de margen a largo plazo.",
                    opp: "Crear líneas 'difusión' para proteger la marca madre.",
                    emerging: "Retail como 'Hub Social' (más que tienda).",
                    strength: "Presencia Omnicanal Real.",
                    question: "¿Cuánto margen sacrificamos por mantener la cuota?",
                    kpi: "% Ventas con Descuento"
                },
                {
                    name: "🧪 3. Producto",
                    insight: "Básicos Efectivos",
                    details: "Vuelta a ingredientes conocidos (Retinol, Vitamina C). Menos experimentación.",
                    summary_text: "El consumidor, fatigado de lanzamientos constantes, volvió a lo seguro. Los 'Dupes' (duplicados baratos) dominaron la conversación, obligando a las marcas premium a justificar su precio con eficacia probada o legado.",
                    risk: "Aburrimiento del consumidor.",
                    opp: "Innovar en formatos (sticks, parches) con activos clásicos.",
                    emerging: "Híbridos Skincare-Makeup de alta eficacia.",
                    strength: "Portfolio de 'Héroes' probados.",
                    question: "¿Tenemos demasiados SKUs que hacen lo mismo?",
                    kpi: "Rotación de Inventario (Days Sales of Inventory)"
                },
                {
                    name: "🧘 4. Wellness",
                    insight: "Salud Mental Low Cost",
                    details: "El 'Self-care' como necesidad ante el estrés económico.",
                    summary_text: "El bienestar dejó de ser un lujo de spa para convertirse en una necesidad diaria de 'supervivencia mental'. Pequeños lujos asequibles (velas, aromaterapia) reemplazaron a las grandes experiencias.",
                    risk: "Banalización de la salud mental.",
                    opp: "Rutinas de 'micro-momentos' accesibles.",
                    emerging: "Neuro-cosmética funcional (aromas, texturas).",
                    strength: "Conexión Emocional Profunda.",
                    question: "¿Somos un 'escape' o una 'solución' para el cliente?",
                    kpi: "Purchase Frequency (Recurrencia)"
                },
                {
                    name: "🗣️ 5. Consumidor",
                    insight: "Cinismo Informado",
                    details: "El comprador investiga márgenes y rechaza el 'Clean Washing'.",
                    risk: "Boicot por falta de transparencia.",
                    opp: "Marketing de 'Cost Breakdown' radical.",
                    emerging: "Búsqueda de 'Rareza' anti-algoritmo.",
                    strength: "Transparencia Radical.",
                    question: "¿Confían en nosotros o solo nos compran?",
                    kpi: "Net Promoter Score (NPS)"
                }
            ],
            risks_opportunities: "", // Deprecated in favor of per-trend items
            strategic_tactics: {
                'negocio': { threats: [{ source: "Inflación", move: "Costes disparados", response: "Eficiencia Operativa" }], quick_wins: [{ title: "Revisión Precios", text: "Ajustar márgenes" }] },
                'retail': { threats: [], quick_wins: [] },
                'producto': { threats: [], quick_wins: [] },
                'wellness': { threats: [], quick_wins: [] },
                'consumidor': { threats: [], quick_wins: [] },
                'otros': { threats: [], quick_wins: [] }
            }
        },
        '2026': {
            title: "Panorama 2026: La Era de la Integración Radical",
            title: "Panorama 2026",
            summary_title: "Renacimiento Científico y Sensorial",
            summary_body: `El mercado ha evolucionado de silos independientes a una convergencia total. El éxito ya no reside en un solo eje, sino en la **sinergia dinámica** de estas 5 fuerzas clave.<br><br>
            La 'calidad' ha dejado de ser un diferenciador para convertirse en el costo de entrada; el verdadero campo de batalla está ahora en la <strong>autenticidad radical</strong>.`,
            global_synthesis: [
                { title: "De la Viralidad a la Verificación Clínica", text: "El consumidor de 2026 exige validación clínica inmediata. Las marcas que solo ofrecen marketing sin respaldo científico (IP) están perdiendo cuota." },
                { title: "La Bifurcación del Mercado", text: "Polarización extrema: Lujo Científico o Valor Extremo. El 'Masstige' indefinido muere. Las marcas ganadoras tienen una proposición radical." },
                { title: "Retail Media como Motor de Profit", text: "La rentabilidad para cadenas como Ulta o Sephora viene de sus redes de publicidad (RMNs). La tienda es un canal de medios." }
            ],
            macro_focus: [
                {
                    name: "1. Dinámica de Negocio (M&A)",
                    insight: "Refugio en Calidad",
                    details: "El capital fluye hacia marcas con IP científica o legado histórico.",
                    summary_text: "El mercado ha entrado en una fase de madurez despiadada. Ya no basta con tener un 'buen producto'; se requiere una estructura operativa impecable. Los inversores exigen rentabilidad real, forzando consolidación y fusiones estratégicas.",
                    question: "¿Es nuestra estructura de costos resiliente a una caída del 20% en volumen?",
                    kpi: "EBITDA por SKU",
                    risk: "Insolvencia de marcas basadas solo en 'Hype'.",
                    opp: "M&A táctico de marcas con patente clínica.",
                    emerging: "Consorcios de marcas independientes.",
                    strength: "IP (Propiedad Intelectual) Defendible."
                },
                {
                    name: "2. Retail & Distribución",
                    insight: "La Tienda como Medio",
                    details: "El retail físico no muere, se especializa. Es el principal canal de reclutamiento.",
                    summary_text: "La dicotomía online/offline ha desaparecido. La tienda física resurge como canal de medios para reclutar clientes, mientras el digital lidera la reposición. Unificar la data de ambos mundos es vital.",
                    question: "¿Estamos usando la tienda física para vender o para reclutar data?",
                    kpi: "CPA (Cost Per Acquisition) Híbrido",
                    risk: "Costos prohibitivos de anuncios digitales (CAC).",
                    opp: "La tienda física como 'Centro de Experiencia'.",
                    emerging: "Venta asintida por IA en probadores.",
                    strength: "Captura de 'Datos Propietarios' (First-party data)."
                },
                {
                    name: "3. Ciencia & Producto",
                    insight: "Eficacia Clínica Extrema",
                    details: "El consumidor exige pruebas de microscopía y moléculas patentadas.",
                    summary_text: "El consumidor exige pruebas tangibles: fotos de antes/después validadas y porcentajes exactos. El packaging debe comunicar credibilidad médica para destacar entre el ruido del 'clean beauty'.",
                    question: "¿Podemos probar nuestros claims principales en un tribunal?",
                    kpi: "% Portfolio con Validación Clínica",
                    risk: "'Science-washing' legal y demandas colectivas.",
                    opp: "Certificación de laboratorio visible en packaging.",
                    emerging: "Biotecnología viva (Exosomas, Microbioma).",
                    strength: "Validación Clínica Real."
                },
                {
                    name: "4. Wellness & Salud",
                    insight: "Medicalización del Bienestar",
                    details: "La belleza es una rama de la salud preventiva y el manejo del estrés.",
                    summary_text: "La belleza se fusiona con la salud mental. Ya no tratamos solo 'arrugas', sino 'cortisol' y 'descanso'. Los productos tópicos son parte de un ecosistema mayor de bienestar preventivo.",
                    question: "¿Qué problema de salud real estamos ayudando a prevenir?",
                    kpi: "LTV (Lifetime Value) de Cohortes Wellness",
                    risk: "Intrusismo médico sin respaldo.",
                    opp: "Protocolos de longevidad para uso en casa.",
                    emerging: "Diagnóstico hormonal en tiempo real.",
                    strength: "Integración Salud-Belleza."
                },
                {
                    name: "5. Cultura & Consumidor",
                    insight: "Autenticidad & Tribus",
                    details: "Gen Z busca 'Caos' y verdad. Las marcas ganadoras eligen un bando claro.",
                    summary_text: "La confianza en la publicidad tradicional se ha roto. El consumidor busca 'verdad sin filtro' en comunidades de nicho. Las marcas exitosas tienen opiniones fuertes y no intentan complacer a todos.",
                    question: "¿A quién estamos dispuestos a ofender para enamorar a nuestro nicho?",
                    kpi: "Share of Voice en Comunidades (Reddit/Discord)",
                    risk: "Irrelevancia por intentar complacer a todos.",
                    opp: "Cultivar 'Micro-comunidades' leales.",
                    emerging: "Estética 'Ugly-Cool' y rechazo a la perfección.",
                    strength: "Identidad de Marca Polarizante."
                }
            ],
            risks_opportunities: "", // Deprecated
            strategic_tactics: { // Full 2026 Tactics
                'negocio': {
                    threats: [
                        { source: "LVMH / Estée Lauder", move: "Adquisición agresiva de marcas nicho.", response: "Blindaje de Valor: Auditar IP." },
                        { source: "Venture Capital", move: "Exigencia de EBITDA positivo.", response: "Corte de Grasa: Eliminar canales ineficientes." },
                        { source: "Entorno Regulatorio", move: "Prohibición microplásticos.", response: "Reformulación Preventiva." }
                    ],
                    quick_wins: [{ title: "Auditoría de IP", text: "Registrar fórmulas clave." }, { title: "Optimización Margen", text: "Eliminar SKUs <15%." }, { title: "Alianzas", text: "Exclusividad proveedores." }]
                },
                'retail': {
                    threats: [
                        { source: "Sephora / Ulta", move: "Subida costes Retail Media.", response: "Escape Velocity: Fortalecer DTC." },
                        { source: "TikTok Shop", move: "Social Commerce transaccional.", response: "Flash Sales exclusivas." },
                        { source: "Farmacia Moderna", move: "Premiumización del pasillo.", response: "Masstige Partner." }
                    ],
                    quick_wins: [{ title: "Data Harvest", text: "Captura emails en tienda." }, { title: "Bundles Web", text: "Kits exclusivos online." }, { title: "Staff Guerrilla", text: "Vendedores digitalizadores." }]
                },
                'producto': {
                    threats: [
                        { source: "Topicals / The Ordinary", move: "Democratización de activos.", response: "Elevación Narrativa." },
                        { source: "Neuro-Cosmetics", move: "Claims emocionales.", response: "Test Sensorial." },
                        { source: "Hyper-Personalization", move: "ADN y tests hormonales.", response: "Quiz Digital." }
                    ],
                    quick_wins: [{ title: "Storytelling Tech", text: "Destacar absorción." }, { title: "Validación Externa", text: "Estudio clínico visible." }, { title: "Packaging Lab", text: "Iconografía médica." }]
                },
                'wellness': {
                    threats: [
                        { source: "Hims & Hers / Ro", move: "Telemedicina integrada.", response: "Medicalización Light." },
                        { source: "Biohacking", move: "Terapias IV/Luz Roja.", response: "Partnership Clínico." },
                        { source: "Sleep Economy", move: "Recuperación Nocturna.", response: "Niche Launch: Night Recovery." }
                    ],
                    quick_wins: [{ title: "Sello Médico", text: "Board de Expertos." }, { title: "Bundle Estrés", text: "Kit Cortisol." }, { title: "Guía QR", text: "Protocolo uso." }]
                },
                'consumidor': {
                    threats: [
                        { source: "Influencer Economy", move: "Fatiga de Dupes.", response: "Pívot a Calidad." },
                        { source: "De-influencing", move: "Honestidad brutal.", response: "Transparencia Radical." },
                        { source: "Silver Economy", move: "Gen X ignorada.", response: "Imágenes Reales +45." }
                    ],
                    quick_wins: [{ title: "Campaña Gen X", text: "CRM +40." }, { title: "Educación Deep", text: "Webinars." }, { title: "Loyalty", text: "Premiar educación." }]
                },
                'otros': {
                    threats: [{ source: "Nuevos Entrantes", move: "Fragmentación nichos.", response: "Vigilancia Activa." }, { source: "Supply Chain", move: "Escasez ingredientes.", response: "Dual Sourcing." }],
                    quick_wins: [{ title: "Escucha Social", text: "Alertas." }, { title: "Test A/B", text: "Landing fantasma." }, { title: "Gaps Review", text: "Analizar quejas." }]
                }
            }
        }
    };

    // --- Export Function (Desktop Simulation) ---
    async function exportSection(sectionId, btnId) {
        const originalElement = document.getElementById(sectionId);
        const btn = document.getElementById(btnId);

        if (btn) btn.style.display = 'none';

        try {
            // 1. Clone the node to avoid messing up the live UI
            const clone = originalElement.cloneNode(true);

            // 2. Configure clone to look like Desktop (1200px width)
            clone.style.width = "1200px";
            clone.style.height = "auto";
            clone.style.position = "fixed";
            clone.style.top = "-9999px";
            clone.style.left = "-9999px";
            clone.style.zIndex = "-1000";

            // User requested plain white background for export
            clone.style.backgroundImage = "none";
            clone.style.backgroundColor = "#ffffff";
            clone.style.padding = "3rem";

            // Fix text wrapping issues in clone
            // Force flex containers to row instead of column (reverting mobile styles)
            const flexContainers = clone.querySelectorAll('.dashboard-row, .glass-panel');
            flexContainers.forEach(el => el.style.flexDirection = 'row');

            // Force White Text on Headers (Panorama 2026 / Title)
            const headers = clone.querySelectorAll('h1, h2');
            headers.forEach(h => {
                h.style.color = '#ffffff';
                h.style.setProperty('color', '#ffffff', 'important');
                h.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)'; // Add shadow for contrast against white/light bg if needed
            });

            // Append to body so html2canvas can render it
            document.body.appendChild(clone);

            // 3. Capture the clone
            const canvas = await html2canvas(clone, {
                scale: 2,
                backgroundColor: null, // Transparent to keep gradient
                windowWidth: 1200,
                active: true,
                useCORS: true,
                allowTaint: true // Try to allow rendering, but toDataURL might still fail if we used an image. With gradient it's safe.
            });

            // 4. Download
            const link = document.createElement('a');
            link.download = `Insights_${sectionId}_${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            // 5. Cleanup
            document.body.removeChild(clone);

        } catch (err) {
            console.error(err);
            alert("Error al exportar imagen: " + err.message);
        } finally {
            if (btn) btn.style.display = 'inline-block';
        }
    }

    // --- Strategic Summary Logic ---
    function generateStrategicSummary() {
        const container = document.getElementById('strategic-view');

        // Determine Context
        const yearFilter = state.filters.year;
        let contextKey = '2026'; // Default to future/current
        if (yearFilter === '2025') contextKey = '2025';
        if (yearFilter === '2026') contextKey = '2026';

        // Load Dynamic Data
        const ANALYSIS_DATA = ANALYSIS_DB[contextKey] || ANALYSIS_DB['2026'];

        // Filter logic for summary metrics
        const filtered = state.articles.filter(a => {
            const matchTopic = state.filters.topic === 'all' || a.displayTopic === state.filters.topic;

            // Robust Year/Month
            const matchYear = state.filters.year === 'all' || (a.year && String(a.year).trim() === String(state.filters.year).trim());
            const matchMonth = state.filters.month === 'all' || (a.month && String(a.month).trim().toUpperCase() === String(state.filters.month).trim().toUpperCase());

            // Robust Macro
            const articleMacro = (a.macro || '').toLowerCase().trim();
            const filterMacro = (state.filters.macro || 'all').toLowerCase().trim();
            const matchMacro = filterMacro === 'all' || articleMacro === filterMacro;

            return matchTopic && matchMacro && matchYear && matchMonth;
        });

        if (filtered.length === 0) {
            container.innerHTML = '<p class="center-msg">No hay datos suficientes para generar un análisis con los filtros actuales.</p>';
            return;
        }

        try {
            // 1. Calculate Metrics
            const total = filtered.length;
            const topicCounts = {};
            filtered.forEach(a => {
                const t = a.displayTopic || "General";
                topicCounts[t] = (topicCounts[t] || 0) + 1;
            });
            const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

            const monthCounts = {};
            filtered.forEach(a => {
                if (a.month) monthCounts[a.month] = (monthCounts[a.month] || 0) + 1;
            });
            const monthOrder = { 'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5, 'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11 };
            const sortedMonths = Object.entries(monthCounts).sort((a, b) => {
                return (monthOrder[a[0]] !== undefined && monthOrder[b[0]] !== undefined) ? monthOrder[a[0]] - monthOrder[b[0]] : 0;
            });

            // 2. Render HTML
            container.innerHTML = `
                <!-- SECTION 0: OPPORTUNITY MATRIX (QUADRANTS) -->
                <div class="glass-panel" style="margin-bottom: 2rem; padding: 2rem;">
                    <div class="mesh-section-title"
                        style="margin-bottom:1.5rem; text-align:center; background: linear-gradient(135deg, #be185d 0%, #9d174d 100%); color:#ffffff !important;">
                        <i class="fa-solid fa-chart-line"></i> Matriz de Oportunidad Estratégica
                    </div>
                    <p style="text-align:center; margin-bottom:2rem; color: var(--text-secondary); font-size: 0.9rem;">
                        Posición de las Subcategorías según <strong>Volumen de Conversación</strong> (Eje X) y <strong>Momento/Tendencia</strong> (Eje Y).
                        <br><span style="font-size: 0.8rem; opacity: 0.8;">Burbujas grandes = Mayor impacto mediático.</span>
                    </p>
                
                <!-- Toggle Button for Aggregation Level -->
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="display: inline-flex; background: rgba(0,0,0,0.1); border-radius: 50px; padding: 4px; border: 1px solid rgba(0,0,0,0.1);">
                        <button id="chart-agg-macro" 
                                class="chart-agg-btn"
                                style="padding: 0.5rem 1.5rem; border: none; border-radius: 50px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.3s ease; background: rgba(255,255,255,0.9); color: #1e293b; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <i class="fa-solid fa-shapes"></i> Por Categoría
                        </button>
                        <button id="chart-agg-topic" 
                                class="chart-agg-btn"
                                style="padding: 0.5rem 1.5rem; border: none; border-radius: 50px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.3s ease; background: transparent; color: #64748b;">
                            <i class="fa-solid fa-layer-group"></i> Por Tema
                        </button>
                        <button id="chart-agg-subtopic" 
                                class="chart-agg-btn"
                                style="padding: 0.5rem 1.5rem; border: none; border-radius: 50px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.3s ease; background: transparent; color: #64748b;">
                            <i class="fa-solid fa-list-ul"></i> Por Subtema
                        </button>
                        <button id="chart-agg-monthly" 
                                class="chart-agg-btn"
                                style="padding: 0.5rem 1.5rem; border: none; border-radius: 50px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.3s ease; background: transparent; color: #64748b;">
                            <i class="fa-solid fa-calendar-days"></i> Por Mes
                        </button>
                    </div>
                </div>
                
                <div style="position: relative; height: 50vh; width: 100%; min-height: 400px;">
                    <canvas id="opportunityMatrix"></canvas>
                </div>
                
                <!-- Custom Legend Container -->
                <div id="chart-legend-container"></div>
            </div>

                <!-- SECTION 1: GLOBAL STRATEGY (${contextKey}) -->
                <div id="section-global" style="background:transparent; padding:1rem; border-radius:12px; margin-bottom: 2rem;">
                    <div style="margin-bottom:1rem; text-align:right;">
                        <button id="export-global-btn" class="action-btn-small" style="background:rgba(0,0,0,0.4); backdrop-filter:blur(8px); color:white; border:1px solid rgba(255,255,255,0.1); padding:8px 16px; border-radius:50px; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1); font-weight:600; font-size:0.85rem; letter-spacing:0.02em; transition: all 0.2s ease;">
                            <i class="fa-solid fa-download"></i> Exportar Panorama Global
                        </button>
                    </div>

                    <!-- Analysis Card -->
                    <div style="background: transparent !important; border: none !important; box-shadow: none !important; padding: 3rem 2rem;">
                        <div style="text-align:center; margin-bottom:2rem;">
                            <div style="display:inline-flex; flex-direction:column; align-items:center; background:rgba(0,0,0,0.4); backdrop-filter:blur(8px); padding:1rem 2.5rem; border-radius:24px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
                                <h2 style="color:white; margin:0 0 0.25rem 0; font-size: 2.2rem; text-shadow: 0 2px 4px rgba(0,0,0,0.2); line-height:1.2;">${ANALYSIS_DATA.title}</h2>
                                <p style="color:rgba(255,255,255,0.9); margin:0; font-size:0.9rem;">Generado por Market Insights AI • ${new Date().toLocaleDateString()}</p>
                            </div>
                        </div>

                        <!-- NEW HERO SUMMARY DESIGN -->
                        <div class="glass-panel hero-container" style="padding:0; border-radius:16px; margin-bottom:2.5rem; border:none; overflow:hidden; display:flex; box-shadow: 0 10px 40px -10px rgba(37,99,235,0.2);">
                            
                            <!-- Left: Text Content -->
                            <div style="flex: 1.2; padding:3rem; display:flex; flex-direction:column; justify-content:center; position:relative; z-index:2;">
                                <h3 style="margin-top:0; margin-bottom:1.5rem; font-size:2rem; font-weight:800; line-height:1.2; letter-spacing:-0.03em; color:#2563eb;">
                                    ${ANALYSIS_DATA.summary_title}
                                </h3>
                                <div style="font-size:1.1rem; line-height:1.8; color:#334155; font-weight:500;">
                                    ${ANALYSIS_DATA.summary_body}
                                </div>
                            </div>

                            <!-- Right: Visual "5-Force Ecosystem" -->
                            <div class="hero-visual" style="flex: 1.5; position:relative; display:flex; align-items:center; justify-content:center; background: radial-gradient(circle at center, #f8fafc 0%, #e2e8f0 100%); overflow:hidden;">
                                
                                <!-- Background Glow & Texture -->
                                <div style="position:absolute; inset:0; pointer-events:none;">
                                    <div style="position:absolute; top:-20%; right:-20%; width:60%; height:60%; background:radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%); filter:blur(40px);"></div>
                                    <div style="position:absolute; bottom:-10%; left:-10%; width:50%; height:50%; background:radial-gradient(circle, rgba(236,72,153,0.05) 0%, transparent 70%); filter:blur(40px);"></div>
                                </div>

                                <!-- The Integrated System Container -->
                                <div style="position:relative; width:100%; max-width:450px; aspect-ratio:1.4; display:flex; align-items:center; justify-content:center;">
                                    
                                    <!-- Orbit Ring (Subtle guide) -->
                                    <div style="position:absolute; top:50%; left:50%; width:280px; height:180px; border:1px solid rgba(255,255,255,0.6); border-radius:50%; box-shadow: inset 0 0 20px rgba(37,99,235,0.05); transform: translate(-50%, -50%) rotate(-10deg);"></div>

                                    <!-- Connecting Lines (SVG) -->
                                    <svg style="position:absolute; width:100%; height:100%; pointer-events:none; z-index:1; overflow:visible;">
                                        <defs>
                                            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stop-color="#cbd5e1" stop-opacity="0" />
                                                <stop offset="50%" stop-color="#94a3b8" stop-opacity="0.3" />
                                                <stop offset="100%" stop-color="#cbd5e1" stop-opacity="0" />
                                            </linearGradient>
                                        </defs>
                                        
                                        <!-- Connect Center to 5 Nodes -->
                                        <!-- Left Group -->
                                        <line x1="50%" y1="50%" x2="20%" y2="70%" stroke="url(#lineGrad)" stroke-width="1.5" /> <!-- Science -->
                                        <line x1="50%" y1="50%" x2="25%" y2="35%" stroke="url(#lineGrad)" stroke-width="1.5" /> <!-- Health -->
                                        
                                        <!-- Top/Right Group -->
                                        <line x1="50%" y1="50%" x2="50%" y2="20%" stroke="url(#lineGrad)" stroke-width="1.5" /> <!-- Business -->
                                        <line x1="50%" y1="50%" x2="80%" y2="35%" stroke="url(#lineGrad)" stroke-width="1.5" /> <!-- Retail -->
                                        <line x1="50%" y1="50%" x2="85%" y2="70%" stroke="url(#lineGrad)" stroke-width="1.5" /> <!-- Culture -->
                                    </svg>

                                    <!-- CENTER NODE: Integrated Ecosystem -->
                                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); z-index:10; display:flex; align-items:center; justify-content:center;">
                                        <div style="width:120px; height:120px; background:linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%); border-radius:50%; box-shadow:0 10px 40px rgba(37,99,235,0.2), inset 0 0 0 2px rgba(255,255,255,1); display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; animation: pulse 6s infinite;">
                                            <div style="position:absolute; inset:-4px; border-radius:50%; border:1px solid rgba(37,99,235,0.15); animation: pulse 3s infinite reverse;"></div>
                                            <div style="font-size:0.6rem; font-weight:800; color:#64748b; letter-spacing:0.05em; text-align:center; line-height:1.2;">ECOSISTEMA<br>INTEGRADO</div>
                                        </div>
                                    </div>

                                    <!-- 1. CIENCIA (Biotech) - Bottom Left -->
                                    <div class="glass-card-hover" style="position:absolute; bottom:10%; left:0%; z-index:5; display:flex; flex-direction:column; align-items:center;">
                                        <div style="width:42px; height:42px; background:rgba(255,255,255,0.9); border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(59,130,246,0.15); border:1px solid #dbeafe; margin-bottom:4px;">
                                            <i class="fa-solid fa-microscope" style="font-size:1rem; color:#2563eb;"></i>
                                        </div>
                                        <div style="font-size:0.65rem; font-weight:700; color:#1e1b4b; background:white; padding:2px 8px; border-radius:10px; border:1px solid #e2e8f0;">CIENCIA</div>
                                        <div style="font-size:0.55rem; color:#64748b;">(Biotech)</div>
                                    </div>

                                    <!-- 2. SALUD (Wellness) - Top Left -->
                                    <div class="glass-card-hover" style="position:absolute; top:15%; left:8%; z-index:5; display:flex; flex-direction:column; align-items:center;">
                                        <div style="width:42px; height:42px; background:rgba(255,255,255,0.9); border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(34,197,94,0.15); border:1px solid #dcfce7; margin-bottom:4px;">
                                            <i class="fa-solid fa-leaf" style="font-size:1rem; color:#16a34a;"></i>
                                        </div>
                                        <div style="font-size:0.65rem; font-weight:700; color:#1e1b4b; background:white; padding:2px 8px; border-radius:10px; border:1px solid #e2e8f0;">SALUD</div>
                                        <div style="font-size:0.55rem; color:#64748b;">(Wellness)</div>
                                    </div>

                                    <!-- 3. NEGOCIO (Smart Capital) - Top Center -->
                                    <div class="glass-card-hover" style="position:absolute; top:2%; left:50%; transform:translateX(-50%); z-index:5; display:flex; flex-direction:column; align-items:center;">
                                        <div style="width:42px; height:42px; background:rgba(255,255,255,0.9); border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(147,51,234,0.15); border:1px solid #f3e8ff; margin-bottom:4px;">
                                            <i class="fa-solid fa-chart-line" style="font-size:1rem; color:#9333ea;"></i>
                                        </div>
                                        <div style="font-size:0.65rem; font-weight:700; color:#1e1b4b; background:white; padding:2px 8px; border-radius:10px; border:1px solid #e2e8f0;">NEGOCIO</div>
                                        <div style="font-size:0.55rem; color:#64748b;">(Smart Capital)</div>
                                    </div>

                                    <!-- 4. RETAIL (Omnicanal) - Top Right -->
                                    <div class="glass-card-hover" style="position:absolute; top:15%; right:8%; z-index:5; display:flex; flex-direction:column; align-items:center;">
                                        <div style="width:42px; height:42px; background:rgba(255,255,255,0.9); border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(249,115,22,0.15); border:1px solid #ffedd5; margin-bottom:4px;">
                                            <i class="fa-solid fa-shop" style="font-size:1rem; color:#ea580c;"></i>
                                        </div>
                                        <div style="font-size:0.65rem; font-weight:700; color:#1e1b4b; background:white; padding:2px 8px; border-radius:10px; border:1px solid #e2e8f0;">RETAIL</div>
                                        <div style="font-size:0.55rem; color:#64748b;">(Omnicanal)</div>
                                    </div>

                                    <!-- 5. CULTURA (Autenticidad) - Bottom Right -->
                                    <div class="glass-card-hover" style="position:absolute; bottom:10%; right:0%; z-index:5; display:flex; flex-direction:column; align-items:center;">
                                        <div style="width:42px; height:42px; background:rgba(255,255,255,0.9); border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(236,72,153,0.15); border:1px solid #fce7f3; margin-bottom:4px;">
                                            <i class="fa-regular fa-comments" style="font-size:1rem; color:#db2777;"></i>
                                        </div>
                                        <div style="font-size:0.65rem; font-weight:700; color:#1e1b4b; background:white; padding:2px 8px; border-radius:10px; border:1px solid #e2e8f0;">CULTURA</div>
                                        <div style="font-size:0.55rem; color:#64748b;">(Autenticidad)</div>
                                    </div>

                                </div>
                            </div>
                        </div>

                        <!-- Global Strategic Insights -->
                        <div style="margin-bottom: 2.5rem; text-align:center;">
                            <div class="mesh-section-title" style="display:inline-block; background:rgba(0,0,0,0.4); backdrop-filter:blur(8px); padding:0.8rem 2rem; border-radius:24px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); color:white; text-shadow:0 2px 4px rgba(0,0,0,0.2);">
                                Insights Estratégicos Globales
                            </div>
                            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.5rem;">
                                ${ANALYSIS_DATA.global_synthesis.map(item => `
                                    <div class="glass-panel glass-card-hover" style="padding:1.5rem; border-radius:12px;">
                                        <h4 style="margin:0 0 0.5rem 0; font-size:1.1rem; font-weight:700; color:#2563eb; text-align:center;">${item.title}</h4>
                                        <p style="margin:0; font-size:0.95rem; color:#374151; line-height:1.6;">${item.text}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- 5 Macro Categories Card Grid (Self-Contained) -->
                        <div style="display:flex; flex-direction:column; gap:1.5rem;">
                            ${ANALYSIS_DATA.macro_focus.map((m, index) => `
                                <div class="glass-panel glass-card-hover responsive-macro-grid" style="align-items:stretch; padding:1.5rem; border-radius:12px;">
                                    
                                    <!-- COL 1: Trend Content -->
                                    <div style="display:flex; flex-direction:column;">
                                        <!-- Header -->
                                        <div class="mesh-section-title" style="margin-bottom:1rem; text-align:center; background:#2563eb; color:#ffffff !important;">
                                            <i class="fa-solid fa-layer-group"></i> Macro-Tendencia
                                        </div>

                                        <div style="margin-bottom:1rem;">
                                            <h5 style="margin:0 0 0.5rem 0; color:#2563eb; font-size:1.1rem; font-weight:800;">${m.name}</h5>
                                            <div style="font-size:0.8rem; font-weight:bold; color:#be185d; text-transform:uppercase; letter-spacing:0.05em;">CLAVE: ${m.insight}</div>
                                        </div>
                                        
                                        <p style="margin:0 0 1rem 0; font-size:0.95rem; color:#4b5563; line-height:1.6;">${m.details}</p>
                                        
                                        <p style="margin:0; font-size:0.9rem; color:#374151; line-height:1.5; font-style:italic; padding-left:1rem; border-left:3px solid #cbd5e1;">
                                            "${m.summary_text || ""}"
                                        </p>
                                    </div>

                                    <!-- COL 2: Impact Matrix -->
                                    <div style="display:flex; flex-direction:column; gap:0.8rem; border-left:1px dashed #9ca3af; padding-left:1.5rem;">
                                        
                                        <div class="mesh-section-title" style="margin-bottom:1rem; text-align:center; background: linear-gradient(135deg, #be185d 0%, #9d174d 100%); color:#ffffff !important;">
                                            <i class="fa-solid fa-scale-balanced"></i> Matriz de Impacto
                                        </div>

                                        <div style="display:flex; gap:0.5rem; align-items:start;">
                                            <span style="font-size:1rem;">🔴</span>
                                            <div>
                                                <div style="font-size:0.7rem; font-weight:700; color:#991b1b; text-transform:uppercase;">Riesgo</div>
                                                <div style="font-size:0.85rem; color:#1f2937; line-height:1.3;">${m.risk}</div>
                                            </div>
                                        </div>
                                        <div style="display:flex; gap:0.5rem; align-items:start;">
                                            <span style="font-size:1rem;">🟢</span>
                                            <div>
                                                <div style="font-size:0.7rem; font-weight:700; color:#065f46; text-transform:uppercase;">Oportunidad</div>
                                                <div style="font-size:0.85rem; color:#1f2937; line-height:1.3;">${m.opp}</div>
                                            </div>
                                        </div>
                                        <div style="display:flex; gap:0.5rem; align-items:start;">
                                            <span style="font-size:1rem;">✨</span>
                                            <div>
                                                <div style="font-size:0.7rem; font-weight:700; color:#7e22ce; text-transform:uppercase;">Tendencia Emergente</div>
                                                <div style="font-size:0.85rem; color:#1f2937; line-height:1.3;">${m.emerging}</div>
                                            </div>
                                        </div>
                                        <div style="display:flex; gap:0.5rem; align-items:start;">
                                            <span style="font-size:1rem;">🛡️</span>
                                            <div>
                                                <div style="font-size:0.7rem; font-weight:700; color:#1e40af; text-transform:uppercase;">Fortaleza Clave</div>
                                                <div style="font-size:0.85rem; color:#1f2937; line-height:1.3;">${m.strength}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- COL 3: Strategic Action -->
                                    <div style="display:flex; flex-direction:column; gap:1.5rem; border-left:1px dashed #9ca3af; padding-left:1.5rem;">
                                        
                                        <div class="mesh-section-title" style="margin-bottom:1rem; text-align:center; background: linear-gradient(135deg, #059669 0%, #047857 100%); color:#ffffff !important;">
                                            <i class="fa-solid fa-chess"></i> Estrategia & KPIs
                                        </div>

                                        <div style="display:flex; gap:0.5rem; align-items:start;">
                                            <span style="font-size:1.2rem;">🤔</span>
                                            <div>
                                                <div style="font-size:0.75rem; font-weight:700; color:#4f46e5; text-transform:uppercase; margin-bottom:0.2rem;">Key Question</div>
                                                <div style="font-size:0.9rem; color:#1f2937; font-weight:600; line-height:1.3;">${m.question || "N/A"}</div>
                                            </div>
                                        </div>

                                        <div style="display:flex; gap:0.5rem; align-items:start;">
                                            <span style="font-size:1.2rem;">📊</span>
                                            <div>
                                                <div style="font-size:0.75rem; font-weight:700; color:#059669; text-transform:uppercase; margin-bottom:0.2rem;">Key KPI</div>
                                                <div style="font-size:0.9rem; color:#1f2937; font-family:monospace; background:#e0e7ff; padding:4px 8px; border-radius:4px; display:inline-block;">${m.kpi || "N/A"}</div>
                                            </div>
                                        </div>

                                    </div>

                                </div>
                            `).join('')}
                        </div>

                    </div>
                </div>

                <!-- SECTION 2: TACTICAL WAR ROOM -->
                <div id="section-tactical" style="background:transparent; padding:1rem; border-radius:12px;">
                    <div style="position:relative; display:flex; justify-content:center; align-items:center; margin-bottom:1.5rem; height:40px;">
                        <div style="display:inline-block; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); padding:0.5rem 1.5rem; border-radius:50px; border:1px solid rgba(255,255,255,0.15); box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
                            <h2 style="margin:0; color:#ffffff; font-size:1.4rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5); text-align:center; line-height:1;">TRENDING TOPICS</h2>
                        </div>
                        <button id="export-tactical-btn" class="action-btn-small" style="position:absolute; right:0; background:#be185d; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">
                            <i class="fa-solid fa-crosshairs"></i> Exportar Tablero Táctico
                        </button>
                    </div>

                    <div class="dashboard-row" style="display:flex; gap:2rem; align-items:start;">
                        <!-- Top News per Topic (Left Column) -->
                        <div class="stat-box" style="background:transparent; border:none; box-shadow:none; padding:0;">
                            <h3 style="display:flex; align-items:center; height:32px; width:fit-content; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); padding:0 1.2rem; border-radius:50px; border:1px solid rgba(255,255,255,0.15); margin:0 0 1rem 0; color:#ffffff; text-transform:uppercase; font-size:0.75rem; letter-spacing:0.05em; font-weight:700; line-height:1;">
                                NOTICIAS RELEVANTES
                            </h3>
                            <div style="display:flex; flex-direction:column; gap:1rem;">
                                ${sortedTopics.map(t => {
                const topicName = t[0];
                // Take TOP 2 filtered articles
                const articles = filtered.filter(a => (a.displayTopic || "General") === topicName).slice(0, 2);

                if (articles.length === 0) return '';

                return `
                                        <div style="background:rgba(255,255,255,0.9); backdrop-filter:blur(10px); padding:1rem; border-radius:8px; border-left: 3px solid #818cf8; border:1px solid rgba(255,255,255,0.4); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                                            <div style="font-size:0.75rem; color:#4f46e5; font-weight:700; text-transform:uppercase; margin-bottom:0.5rem;">${topicName}</div>
                                            <div style="display:flex; flex-direction:column; gap:0.8rem;">
                                                ${articles.map(article => `
                                                    <div style="border-bottom:1px solid rgba(0,0,0,0.06); padding-bottom:0.5rem; last-child:border-bottom:0;">
                                                        <div style="font-size:0.85rem; font-weight:600; color:#1f2937; margin-bottom:0.3rem; line-height:1.4;">${article.title}</div>
                                                        <a href="${article.link}" target="_blank" style="display:inline-block; font-size:0.75rem; color:#2563eb; text-decoration:none; font-weight:500;">
                                                            Leer nota <i class="fa-solid fa-arrow-right" style="font-size:0.65rem;"></i>
                                                        </a>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    `;
            }).join('')}
                            </div>
                        </div>

                        <!-- Competitor Watchlist & Tactics (Right Column) -->
                        <div class="stat-box" style="display:flex; flex-direction:column; border:none; background:transparent; box-shadow:none; margin-top:-25px;">
                            <h3 style="display:flex; align-items:center; gap:0.5rem; height:32px; width:fit-content; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); padding:0 1.2rem; border-radius:50px; border:1px solid rgba(255,255,255,0.15); margin:0 0 1rem 0; color:#ffffff; text-transform:uppercase; font-size:0.75rem; letter-spacing:0.05em; font-weight:700; line-height:1;">
                                <i class="fa-solid fa-binoculars" style="color:#dbeafe; font-size:0.75rem;"></i> COMPETITIVE PLAYBOOK
                            </h3>
                            
                            <div style="flex:1; display:flex; flex-direction:column; align-items:stretch; gap:0.25rem;">
                                ${(() => {
                    const macroStats = {};
                    filtered.forEach(a => {
                        const m = a.macro || 'otros';
                        const t = a.displayTopic || "General";
                        if (!macroStats[m]) macroStats[m] = { count: 0, topics: {} };
                        macroStats[m].count++;
                        macroStats[m].topics[t] = (macroStats[m].topics[t] || 0) + 1;
                    });

                    const sortedMacros = Object.entries(macroStats).sort((a, b) => b[1].count - a[1].count);

                    return sortedMacros.map(([macroKey, stats]) => {
                        const sortedTopics = Object.entries(stats.topics).sort((a, b) => b[1] - a[1]);
                        const topTopicName = sortedTopics.length > 0 ? sortedTopics[0][0] : 'General';
                        // Update to use dynamic ANALYSIS_DATA
                        const tacticData = ANALYSIS_DATA.strategic_tactics[macroKey] || ANALYSIS_DATA.strategic_tactics['otros'];

                        return `
                                            <div style="animation: fadeIn 0.5s ease-in-out;">
                                                <div style="background:rgba(255,255,255,0.9); backdrop-filter:blur(10px); border-radius:8px; overflow:hidden; border:1px solid rgba(255,255,255,0.4); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom:1rem; padding:1rem;">
                                                    <div style="background:transparent; padding:0 0 0.5rem 0; display:flex; justify-content:space-between; align-items:center;">
                                                        <span style="color:#4f46e5; font-size:0.75rem; text-transform:uppercase; font-weight:800; letter-spacing:0.05em;">
                                                            ${topTopicName} <span style="font-weight:400; opacity:0.7; color:#4b5563;">// ${macroKey.toUpperCase()}</span>
                                                        </span>
                                                    </div>
                                                    
                                                    <div style="padding:0; display:flex; flex-direction:column; gap:0.5rem;">
                                                        ${(tacticData.threats || []).map(threat => `
                                                            <div style="border-bottom:1px dashed rgba(0,0,0,0.1); padding-bottom:0.3rem; last-child:border-bottom:0; last-child:padding-bottom:0;">
                                                                <div style="margin-bottom:0.15rem;">
                                                                    <div style="font-size:0.65rem; color:#64748b; font-weight:600; text-transform:uppercase; margin-bottom:0.1rem;">
                                                                        Movimiento [${threat.source}]
                                                                    </div>
                                                                    <div style="font-size:0.8rem; font-weight:700; color:#dc2626; line-height:1.1;">
                                                                        "${threat.move}"
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div style="font-size:0.75rem; color:#334155; line-height:1.2; text-transform:uppercase; margin-bottom:0.1rem;">
                                                                        Respuesta
                                                                    </div>
                                                                    <div style="font-size:0.8rem; font-weight:600; color:#166534; line-height:1.1;">
                                                                        ${threat.response}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                    }).join('<div style="height:1px; background:#e5e7eb; margin:0.15rem 0;"></div>');
                })()}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Render Chart with current aggregation level
            if (state.chartAggregation === 'monthly') {
                renderMonthlyDistributionChart(filtered);
            } else {
                renderSituationMatrix(filtered, state.chartAggregation || 'topic');
            }

            // Attach Listeners for aggregation toggle
            const macroBtn = document.getElementById('chart-agg-macro');
            const topicBtn = document.getElementById('chart-agg-topic');
            const subtopicBtn = document.getElementById('chart-agg-subtopic');
            const monthlyBtn = document.getElementById('chart-agg-monthly');

            // Helper for button styles
            const updateButtonStyles = (activeBtn) => {
                [macroBtn, topicBtn, subtopicBtn, monthlyBtn].forEach(btn => {
                    if (!btn) return; // Guard clause
                    if (btn === activeBtn) {
                        btn.style.background = 'rgba(255,255,255,0.9)';
                        btn.style.color = '#1e293b';
                        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    } else {
                        btn.style.background = 'transparent';
                        btn.style.color = '#64748b';
                        btn.style.boxShadow = 'none';
                    }
                });
            };

            if (macroBtn && topicBtn && subtopicBtn && monthlyBtn) {
                macroBtn.addEventListener('click', () => {
                    state.chartAggregation = 'macro';
                    updateButtonStyles(macroBtn);
                    renderSituationMatrix(filtered, 'macro');
                });

                topicBtn.addEventListener('click', () => {
                    state.chartAggregation = 'topic';
                    updateButtonStyles(topicBtn);
                    renderSituationMatrix(filtered, 'topic');
                });

                subtopicBtn.addEventListener('click', () => {
                    state.chartAggregation = 'subtopic';
                    updateButtonStyles(subtopicBtn);
                    renderSituationMatrix(filtered, 'subtopic');
                });

                monthlyBtn.addEventListener('click', () => {
                    state.chartAggregation = 'monthly';
                    updateButtonStyles(monthlyBtn);
                    renderMonthlyDistributionChart(filtered);
                });
            }

            // Attach other export listeners
            document.getElementById('export-global-btn').addEventListener('click', () => exportSection('section-global', 'export-global-btn'));
            document.getElementById('export-tactical-btn').addEventListener('click', () => exportSection('section-tactical', 'export-tactical-btn'));

        } catch (e) {
            console.error(e);
            container.innerHTML = `<p class="center-msg" style="color:red">Error generando resumen: ${e.message}</p>`;
        }
    }

    // --- UI Rendering ---


    // --- Timeline Rendering ---
    // --- Strategic Opportunity Matrix Logic ---
    function renderSituationMatrix(currentData, aggregationLevel = 'topic') {
        const ctx = document.getElementById('opportunityMatrix');
        if (!ctx || typeof Chart === 'undefined') return;

        // destroy previous chart if exists
        if (window.opportunityChartInstance) {
            window.opportunityChartInstance.destroy();
        }

        // 1. Determine "Current" and "Previous" context
        // simpler approach: Current = data passed (filtered). Previous = data from previous month found in GLOBAL data.
        // But "filtered" might be by TOPIC, not just time.
        // If we want "Trend", we need the SAME filters applied to the PREVIOUS month.

        // Let's get the Current Month/Year from the *filtered* data (assuming it represents a specific period)
        // If multiple months are in filtered, "Current" is the aggregation of all of them.
        // To get "Previous", we need to figure out what the "Previous" period is relative to the "Current" selection.

        // Fallback: If we can't easily determine strict "Previous", we can use a proxy or just plot Volume vs "Sentiment" or "Relevance"?
        // The Proposal was "Volume vs Trend". Trend requires comparison.

        // Algorithm for Trend:
        // A. Extract all Subcategories from currentData.
        // B. For each subcategory, count volume in currentData.
        // C. Find the "Month" of currentData. (e.g. Jan 2026).
        // D. Look in PRELOADED_DATA for the *Previous Month* (Dec 2025) with the SAME Topic/Macro filters.
        // E. Count volume in that Previous Slice.
        // F. Calculate Growth.

        // Detect Time Context
        const years = [...new Set(currentData.map(d => d.year || d.AÑO))].filter(Boolean).sort();
        const months = [...new Set(currentData.map(d => d.month || d.MES))].filter(Boolean);

        // If mixed time, trend is hard. We'll assume the user filters by month for best results.
        // If no time filter, we might default to "Total Volume" vs "Recent Growth" (Last Month vs Month Prior).


        // Let's implement a robust "Last Month in Data" vs "Month Before That" logic if filters are loose.


        // 1. Group Current Data by Macro, Topic, or Subtopic (based on aggregationLevel)
        const currentStats = {};
        currentData.forEach(d => {
            // Determine grouping key based on mode
            let groupKey;
            if (aggregationLevel === 'macro') {
                // Group by macro category label (e.g., "Dinámica de Negocio", "Retail & Distribución")
                groupKey = d.category || TAXONOMY[d.macro]?.label || "General";
            } else if (aggregationLevel === 'topic') {
                groupKey = d.displayTopic || d.topic || "General";
            } else {
                groupKey = d.subcategory || d.SUBCATEGORÍA || "Otros";
            }

            const cat = d.category || d.CATEGORÍA || "General";
            const src = d.source || d['TIPO DE FUENTE'] || "Desconocida";

            if (!currentStats[groupKey]) {
                currentStats[groupKey] = {
                    count: 0,
                    category: cat,
                    articles: [],
                    sources: new Set() // Track unique sources
                };
            }
            currentStats[groupKey].count++;
            currentStats[groupKey].articles.push(d);
            currentStats[groupKey].sources.add(src); // Add source to set
        });

        // 2. Calculate Source Diversity Score
        // Find max sources across all subcategories for normalization
        let maxSources = 0;
        Object.values(currentStats).forEach(stat => {
            if (stat.sources.size > maxSources) maxSources = stat.sources.size;
        });

        // 3. Build Chart Data
        const chartData = [];
        Object.keys(currentStats).forEach(sub => {
            const currentCount = currentStats[sub].count;
            const uniqueSources = currentStats[sub].sources.size;

            // Normalize source diversity to 0-100 scale
            // More sources = higher score (broader relevance)
            let diversityScore = maxSources > 0 ? (uniqueSources / maxSources) * 100 : 0;

            // Color by Category (Simple Hashing or predefined)
            // Existing categories: "Dinámica de Negocio", "Retail", "Wellness", etc.
            const cat = currentStats[sub].category.toUpperCase();
            let color = 'rgba(75, 192, 192, 0.6)'; // default teal
            if (cat.includes('NEGOCIO') || cat.includes('BUSINESS')) color = 'rgba(54, 162, 235, 0.7)'; // blue
            else if (cat.includes('CONSUMIDOR') || cat.includes('CULTURE')) color = 'rgba(255, 99, 132, 0.7)'; // red/pink
            else if (cat.includes('RETAIL')) color = 'rgba(255, 159, 64, 0.7)'; // orange
            else if (cat.includes('PRODUCT') || cat.includes('CIENCIA') || cat.includes('INNOVACIÓN')) color = 'rgba(153, 102, 255, 0.7)'; // purple
            else if (cat.includes('WELLNESS') || cat.includes('SALUD')) color = 'rgba(75, 192, 192, 0.7)'; // teal

            chartData.push({
                x: currentCount,
                y: diversityScore,
                r: Math.max(5, Math.min(30, currentCount * 1.5)), // Radius proportional to volume
                label: sub,
                category: currentStats[sub].category,
                rawVolume: currentCount,
                rawDiversity: uniqueSources, // Store actual source count for tooltip
                diversityScore: diversityScore.toFixed(1)
            });
        });

        // Filter: Only show top 30 by volume to avoid clutter
        const topData = chartData.sort((a, b) => b.x - a.x).slice(0, 30);

        // 4. Render
        window.opportunityChartInstance = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Subcategorías',
                    data: topData,
                    backgroundColor: topData.map(d => {
                        // Dynamic color per point
                        const cat = d.category.toUpperCase();
                        if (cat.includes('NEGOCIO')) return 'rgba(54, 162, 235, 0.8)';
                        if (cat.includes('CONSUMIDOR')) return 'rgba(236, 72, 153, 0.8)';
                        if (cat.includes('RETAIL')) return 'rgba(249, 115, 22, 0.8)';
                        if (cat.includes('PRODUCT') || cat.includes('INNOVACIÓN')) return 'rgba(139, 92, 246, 0.8)';
                        if (cat.includes('WELLNESS')) return 'rgba(16, 185, 129, 0.8)';
                        return 'rgba(203, 213, 225, 0.8)';
                    }),
                    borderColor: 'rgba(255,255,255,0.8)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#1e293b',
                        bodyColor: '#334155',
                        borderColor: 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                const p = context.raw;
                                return [
                                    `${p.label}`,
                                    `Volumen: ${p.rawVolume} noticias`,
                                    `Fuentes únicas: ${p.rawDiversity}`,
                                    `Diversidad: ${p.diversityScore}%`
                                ];
                            }
                        }
                    },
                    annotation: {
                        // Optional: Draw Quadrant Lines if plugin available, else standard grid is fine
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Volumen de Conversación (Cantidad de Noticias)', color: '#94a3b8' },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        title: { display: true, text: 'Diversidad de Fuentes (% Normalizado)', color: '#94a3b8' },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#94a3b8' },
                        suggestedMin: 0,
                        suggestedMax: 100
                    }
                }
            }
        });

        // 5. Generate Custom Legend (HTML-based, more reliable than plugin)
        const legendContainer = document.getElementById('chart-legend-container');
        if (legendContainer) {
            // Sort by volume for legend
            const sortedForLegend = topData.sort((a, b) => b.rawVolume - a.rawVolume);

            // Calculate total volume for percentage calculation
            const totalVolume = sortedForLegend.reduce((sum, item) => sum + item.rawVolume, 0);

            let legendHTML = '<div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; margin-top: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.5); border-radius: 12px;">';

            sortedForLegend.forEach((item, index) => {
                const cat = item.category.toUpperCase();
                let color = 'rgba(203, 213, 225, 0.9)';
                if (cat.includes('NEGOCIO')) color = 'rgba(54, 162, 235, 0.9)';
                else if (cat.includes('CONSUMIDOR')) color = 'rgba(236, 72, 153, 0.9)';
                else if (cat.includes('RETAIL')) color = 'rgba(249, 115, 22, 0.9)';
                else if (cat.includes('PRODUCT') || cat.includes('INNOVACIÓN')) color = 'rgba(139, 92, 246, 0.9)';
                else if (cat.includes('WELLNESS')) color = 'rgba(16, 185, 129, 0.9)';

                // Calculate percentage (rounded, no decimals)
                const percentage = Math.round((item.rawVolume / totalVolume) * 100);

                legendHTML += `
                    <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="width: 16px; height: 16px; border-radius: 50%; background: ${color}; border: 2px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.2);"></div>
                        <span style="font-size: 0.85rem; font-weight: 600; color: #1e293b;">${item.label}</span>
                        <span style="font-size: 0.75rem; color: #64748b; margin-left: 0.25rem;">(${item.rawVolume} • ${percentage}%)</span>
                    </div>
                `;
            });

            legendHTML += '</div>';
            legendContainer.innerHTML = legendHTML;
        }
    }

    // --- Monthly Category Distribution Chart ---
    function renderMonthlyDistributionChart(currentData) {
        const ctx = document.getElementById('opportunityMatrix');
        if (!ctx || typeof Chart === 'undefined') return;

        // Ensure "Por Mes" button is highlighted (persisting state visual)
        const monthlyBtn = document.getElementById('chart-agg-monthly');
        if (monthlyBtn) {
            document.querySelectorAll('.chart-agg-btn').forEach(btn => {
                btn.style.background = 'transparent';
                btn.style.color = '#64748b';
                btn.style.boxShadow = 'none';
            });
            monthlyBtn.style.background = 'rgba(255,255,255,0.9)';
            monthlyBtn.style.color = '#1e293b';
            monthlyBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }

        // Destroy previous chart if exists
        if (window.opportunityChartInstance) {
            window.opportunityChartInstance.destroy();
        }

        // Month order for sorting
        const MONTH_ORDER = {
            'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
            'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
        };

        // 1. Aggregate data by month and category
        const monthlyData = {};
        const categoryTotals = {}; // Standard: Track total volume for sorting

        currentData.forEach(article => {
            if (!article.year || !article.month) return;

            const monthKey = `${article.year}-${String(MONTH_ORDER[article.month] || 0).padStart(2, '0')}`;
            const monthLabel = `${article.month.charAt(0) + article.month.slice(1).toLowerCase()} ${article.year}`;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    label: monthLabel,
                    total: 0,
                    categories: {}
                };
            }

            const macro = article.macro || 'otros';
            monthlyData[monthKey].total++;
            monthlyData[monthKey].categories[macro] = (monthlyData[monthKey].categories[macro] || 0) + 1;

            // Track global total for sorting
            categoryTotals[macro] = (categoryTotals[macro] || 0) + 1;
        });

        // 2. Sort months chronologically
        const sortedMonths = Object.keys(monthlyData).sort();
        const labels = sortedMonths.map(key => monthlyData[key].label);

        // 3. Get all unique categories and SORT by Total Volume (Descending)
        // This ensures the largest categories are consistently at the bottom (or top depending on logic)
        const sortedCategories = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a]);

        const allCategories = {};
        sortedCategories.forEach(cat => {
            const catData = TAXONOMY[cat] || {};
            allCategories[cat] = {
                label: catData.label || cat.toUpperCase(),
                color: getCategoryColor(cat)
            };
        });

        // Helper to get category color
        function getCategoryColor(cat) {
            if (cat === 'negocio') return 'rgba(54, 162, 235, 0.8)';
            if (cat === 'consumidor') return 'rgba(236, 72, 153, 0.8)';
            if (cat === 'retail') return 'rgba(249, 115, 22, 0.8)';
            if (cat === 'producto') return 'rgba(139, 92, 246, 0.8)';
            if (cat === 'wellness') return 'rgba(16, 185, 129, 0.8)';
            return 'rgba(203, 213, 225, 0.8)';
        }

        // 4. Create datasets (one per category, in sorted order)
        const datasets = Object.entries(allCategories).map(([catKey, catInfo]) => {
            return {
                label: catInfo.label,
                data: sortedMonths.map(monthKey => {
                    const month = monthlyData[monthKey];
                    const count = month.categories[catKey] || 0;
                    return month.total > 0 ? (count / month.total * 100) : 0;
                }),
                backgroundColor: catInfo.color,
                borderColor: '#ffffff',
                borderWidth: 1,
                maxBarThickness: 80 // Limit bar width for better aesthetics with few data points
            };
        });

        // 5. Create stacked bar chart
        window.opportunityChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Mes - Año',
                            color: '#94a3b8',
                            font: { size: 14, weight: '600' }
                        },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Porcentaje (%)',
                            color: '#94a3b8',
                            font: { size: 14, weight: '600' }
                        },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: {
                            color: '#94a3b8',
                            callback: function (value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        reverse: true, // Match stack order visual
                        labels: {
                            color: '#94a3b8',
                            padding: 15,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#1e293b',
                        bodyColor: '#334155',
                        borderColor: 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                const percentage = context.parsed.y.toFixed(1);
                                const monthKey = sortedMonths[context.dataIndex];
                                const monthData = monthlyData[monthKey];
                                const catKeys = Object.keys(allCategories);
                                const category = catKeys[context.datasetIndex];
                                const count = monthData.categories[category] || 0;
                                return `${context.dataset.label}: ${percentage}% (${count} noticias)`;
                            }
                        }
                    },
                    datalabels: {
                        color: '#ffffff',
                        font: {
                            weight: 'bold',
                            size: 11
                        },
                        formatter: function (value, context) {
                            return value > 5 ? Math.round(value) + '%' : '';
                        },
                        display: function (context) {
                            return context.dataset.data[context.dataIndex] > 5; // Only show significant segments
                        }
                    }
                }
            },
            plugins: [ChartDataLabels] // Register plugin for this specific chart instance
        });

        // 6. Update legend container
        const legendContainer = document.getElementById('chart-legend-container');
        if (legendContainer) {
            legendContainer.innerHTML = `
                <div style="text-align: center; padding: 1rem; background: rgba(255,255,255,0.5); border-radius: 12px; margin-top: 1.5rem;">
                    <p style="color: #64748b; font-size: 0.9rem; margin: 0;">
                        <i class="fa-solid fa-chart-column"></i> Ordenado por volumen total (Categorías principales abajo)
                    </p>
                </div>
            `;
        }
    }

    // --- Timeline Rendering (Snake Layout) ---
    function renderTimeline() {
        const container = document.getElementById('timeline-view');
        if (!container) return;

        // 1. Prepare Container & Controls (Idempotent)
        let controls = container.querySelector('.snake-controls');
        let snakeWrapper = container.querySelector('.snake-container');

        if (!controls) {
            container.innerHTML = `
                <div class="snake-controls" style="max-width: 1400px; margin: 0 auto 2rem; padding: 0 5%; display: flex; justify-content: flex-end; align-items: center;">
                    <div style="font-size: 0.9rem; color: #64748b; font-weight: 500;">
                        <i class="fa-solid fa-filter"></i> Mostrando <span id="snake-count" style="font-weight: 700; color: #1e293b;">0</span> eventos
                    </div>
                </div>
                <div class="snake-container"></div>
            `;
            snakeWrapper = container.querySelector('.snake-container');

        }

        // Update Count with Debug Info (Temporary)
        const countSpan = document.getElementById('snake-count');
        /*
        const debugInfo = state.filters.macro !== 'all' ? ` [Cat: ${state.filters.macro}]` : '';
        if (countSpan) countSpan.textContent = filtered.length + debugInfo;
        */
        // 2. Filter Data
        const filtered = state.articles.filter(a => {
            let matchSearch = true;
            if (state.filters.search) {
                const searchTerms = expandSearchQuery(state.filters.search);
                const text = (a.title + " " + a.summary + " " + a.displayTopic + " " + a.subtopic).toLowerCase();
                matchSearch = searchTerms.some(term => text.includes(term));
            }
            const matchTopic = state.filters.topic === 'all' || a.displayTopic === state.filters.topic;
            const matchSub = state.filters.subtopic === 'all' || a.subtopic === state.filters.subtopic;
            // Robust Year Check
            const matchYear = state.filters.year === 'all' || (a.year && String(a.year).trim() === String(state.filters.year).trim());
            const matchMonth = state.filters.month === 'all' || (a.month && String(a.month).trim().toUpperCase() === String(state.filters.month).trim().toUpperCase());

            // Robust Macro Match (Case Insensitive + Trim)
            const articleMacro = (a.macro || '').toLowerCase().trim();
            const filterMacro = (state.filters.macro || 'all').toLowerCase().trim();
            const matchMacro = filterMacro === 'all' || articleMacro === filterMacro;

            // New Filters
            const matchSpecialty = state.filters.specialty === 'all' || (a.targetSpecialties && a.targetSpecialties.includes(state.filters.specialty));
            const matchProductPillar = state.filters.productPillar === 'all' || a.productPillar === state.filters.productPillar;
            const matchRegion = state.filters.region === 'all' || a.region === state.filters.region;
            const matchCountry = state.filters.country === 'all' || a.country === state.filters.country;

            return matchSearch && matchTopic && matchSub && matchYear && matchMonth && matchMacro && matchSpecialty && matchProductPillar && matchRegion && matchCountry;
        });

        // Update Count
        if (countSpan) countSpan.textContent = filtered.length;
        snakeWrapper.innerHTML = ''; // Clear previous items

        if (filtered.length === 0) {
            snakeWrapper.innerHTML = '<p class="center-msg" style="width:100%; text-align:center; padding: 4rem; color: #64748b;">No hay noticias para mostrar con los filtros actuales.</p>';
            return;
        }

        // 3. Sort
        // 3. Sort
        const sortOrder = state.filters.sort || 'desc';
        filtered.sort((a, b) => {
            if (a.date && b.date) {
                return sortOrder === 'asc' ? a.date - b.date : b.date - a.date;
            }
            return 0;
        });

        // 4. Chunk into Rows of 3 (Snake Layout)
        const chunkSize = 3;
        for (let i = 0; i < filtered.length; i += chunkSize) {
            const chunk = filtered.slice(i, i + chunkSize);
            const rowDiv = document.createElement('div');
            const isLTR = (i / chunkSize) % 2 === 0; // Even rows: LTR (0, 2, 4...)

            rowDiv.className = `snake-row ${isLTR ? 'snake-row-ltr' : 'snake-row-rtl'}`;

            // Render Items in Row
            chunk.forEach((article, idx) => {
                const card = createSnakeCard(article);
                rowDiv.appendChild(card);

                // Add horizontal connector if it's NOT the last item in this chunk
                if (idx < chunk.length - 1) {
                    const hConnect = document.createElement('div');
                    hConnect.className = 'snake-connector-h';
                    rowDiv.appendChild(hConnect);
                }
            });

            snakeWrapper.appendChild(rowDiv);

            // Add Vertical Connector (if not last row)
            if (i + chunkSize < filtered.length) {
                const vConnectRow = document.createElement('div');
                vConnectRow.className = `snake-v-row ${isLTR ? 'align-right' : 'align-left'}`;
                // V6: Darker Ink Style & Sturdier Lines
                vConnectRow.innerHTML = '<div class="snake-connector-v"></div>';
                snakeWrapper.appendChild(vConnectRow);
            }
        }
    }

    function createSnakeCard(article) {
        const item = document.createElement('div');
        item.className = 'snake-card-wrapper';

        const macroColor = getMacroColor(article.macro);
        const dateStr = article.date instanceof Date
            ? article.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
            : (article.year || "");

        item.innerHTML = `
            <div class="snake-card" onclick="window.open('${article.link}', '_blank')">
                <div class="snake-header">
                    <span class="snake-tag" style="background:${macroColor};">${article.displayTopic}</span>
                    <span class="snake-date">${dateStr}</span>
                </div>
                <h3 class="snake-title">${article.shortTitle || article.title}</h3>
                <div class="snake-sub">${article.subtopic || ""}</div>
            </div>
        `;
        return item;
    }

    function getMacroColor(macro) {
        const colors = {
            'negocio': '#3b82f6', // blue-500
            'retail': '#f59e0b', // amber-500
            'producto': '#10b981', // emerald-500
            'wellness': '#8b5cf6', // violet-500
            'consumidor': '#ec4899', // pink-500
            'otros': '#6b7280'
        };
        return colors[macro] || colors['otros'];
    }

    // --- View Switching Logic (Mobile Optimized) ---
    window.switchView = (viewName) => {
        state.currentView = viewName;

        // 1. Update Buttons
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active');
            // Check if onclick attribute contains viewName (simple heuristic)
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(viewName)) {
                btn.classList.add('active');
            }
        });

        // 2. Toggle Containers
        const newsGrid = document.getElementById('news-grid');
        const stratView = document.getElementById('strategic-view');
        const timelineView = document.getElementById('timeline-view');

        // Hide all first
        if (newsGrid) newsGrid.classList.add('hidden');
        if (stratView) stratView.classList.add('hidden');
        if (newsGrid) newsGrid.classList.add('hidden');
        if (stratView) stratView.classList.add('hidden');
        if (timelineView) timelineView.classList.add('hidden');
        const synapseView = document.getElementById('synapse-view');
        if (synapseView) synapseView.classList.add('hidden');

        // Show selected
        if (viewName === 'news') {
            if (newsGrid) newsGrid.classList.remove('hidden');
            renderGrid();
        } else if (viewName === 'strategy') {
            if (stratView) stratView.classList.remove('hidden');
            generateStrategicSummary();
        } else if (viewName === 'timeline') {
            if (timelineView) timelineView.classList.remove('hidden');
            renderTimeline();
        } else if (viewName === 'synapse') {
            const synapseView = document.getElementById('synapse-view');
            if (synapseView) synapseView.classList.remove('hidden');
            renderSynapse();
        }

        // 3. Mobile Optimization: Close Sidebar on Selection
        // Check if sidebar is currently open (has .active class)
        const sidebar = document.querySelector('.sidebar');
        if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
            toggleSidebar(); // Close it
        }

        // 4. Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- Helper Functions ---
    function expandSearchQuery(query) {
        if (!query) return [];
        return query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    }

    // --- Synapse Graph Rendering ---
    let networkInstance = null;

    // === SEMANTIC RELATIONSHIP ENGINE ===

    // Knowledge Base: Entities and Concepts
    const ENTITY_KEYWORDS = {
        // Companies
        companies: ['sanfer', 'loreal', "l'oreal", 'allergan', 'galderma', 'abbvie', 'estee lauder', 'unilever',
            'procter', 'johnson', 'beiersdorf', 'shiseido', 'coty', 'revlon', 'merz', 'ipsen',
            'ulta', 'sephora', 'natura', 'avon', 'lvmh', 'henkel', 'kao', 'clarins', 'neutrogena',
            'mesoestetic', 'dove', 'target', 'boots', 'inmode', 'hugel', 'givaudan', 'maybelline',
            'clinique', 'lancome', 'kylie', 'stripes', 'wonderbelly', 'ciroa', 'docplanner',
            'bain', 'saks', 'chanel', 'puig', 'finetoday'],

        // Products & Molecules
        products: ['ozempic', 'wegovy', 'mounjaro', 'botox', 'juvederm', 'restylane', 'sculptra', 'radiesse',
            'glp-1', 'glp1', 'semaglutide', 'tirzepatide', 'peptide', 'peptides', 'hyaluronic acid',
            'retinol', 'niacinamide', 'vitamin c', 'aha', 'bha', 'bakuchiol', 'collagen', 'ceramide',
            'neurotoxin', 'neurotoxina', 'filler', 'dermal filler', 'toxina', 'hialurónico',
            'exosome', 'exosomas', 'microneedling', 'resurfacer', 'nano-resurfacer',
            'antitranspirante', 'refillable', 'recargable', 'letybo', 'fermented', 'probiotic',
            'device', 'dispositivo', 'wearable', 'antiaging'],

        // Geography
        geography: ['mexico', 'méxico', 'usa', 'europe', 'china', 'latam', 'latinoamerica', 'spain', 'españa',
            'brazil', 'brasil', 'argentina', 'asia', 'korea', 'corea', 'japan', 'india', 'france', 'germany', 'uk', 'apac'],

        // Business Concepts
        business: ['acquisition', 'merger', 'fusión', 'adquisición', 'ceo', 'cmo', 'leadership', 'ipo',
            'investment', 'inversión', 'partnership', 'alianza', 'deal', 'restructuring', 'reestructuración',
            'campaign', 'campaña', 'marketing', 'advertising', 'publicidad', 'launch', 'lanzamiento',
            'branding', 'retail', 'e-commerce', 'digital', 'revenue', 'sales', 'profit', 'profitability',
            'bankruptcy', 'bancarrota', 'creditor', 'expansion', 'expansión', 'distribution',
            'direct sales', 'omnichannel', 'dtc', 'd2c', 'private equity', 'venture capital',
            'funding', 'financiamiento', 'valuation', 'market share', 'cuota de mercado'],

        // Supply Chain
        // Supply Chain
        supply: ['manufacturing', 'manufactura', 'production', 'producción', 'supply chain', 'distribution',
            'distribución', 'logistics', 'logística', 'contract', 'outsourcing', 'tariff', 'arancel',
            'arancelaria', 'import', 'export', 'exportación', 'packaging', 'empaque', 'envase'],

        // Regulatory
        // Regulatory
        regulatory: ['fda', 'cofepris', 'approval', 'aprobación', 'clinical trial', 'ensayo', 'regulation',
            'regulación', 'compliance', 'safety', 'seguridad', 'efficacy', 'eficacia', 'mocra',
            'packaging rules', 'labeling', 'etiquetado', 'consultation', 'consulta pública',
            'heavy metals', 'metales pesados', 'toxic', 'tóxico', 'lead', 'plomo'],

        // Market
        market: ['market growth', 'crecimiento', 'demand', 'demanda', 'pricing', 'competition', 'competencia',
            'trend', 'tendencia', 'consumer', 'consumidor', 'gen z', 'millennial', 'alpha', 'gen x',
            'wellness', 'bienestar', 'sustainability', 'sostenibilidad', 'natural', 'organic', 'clean beauty', 'clean label',
            'personalization', 'inclusivity', 'diversity', 'athlete', 'sport', 'fitness',
            'longevity', 'epigenetic', 'epigenética', 'menopause', 'menopausia',
            'dermatitis', 'atópica', 'skin health', 'barrier', 'barrera',
            'fragrance', 'perfume', 'masculina', 'tiktok', 'viral', 'influencer',
            'transparency', 'transparencia', 'refill', 'circular economy',
            'digestive health', 'gut health', 'digestivo', 'otc',
            'beauty tech', 'beautytech', 'ai', 'inteligencia artificial', 'biotech', 'biotecnología',
            'prestige', 'premium', 'luxury', 'mass', 'prestige-at-mass',
            'k-beauty', 'korean', 'coreana', 'innovation', 'innovación', 'tech', 'technology',
            'mental health', 'salud mental', 'neuro', 'cognitive',
            'minimally invasive', 'non-surgical', 'heritage', 'niche', 'nicho', 'emerging',
            'ranking', 'index', 'quarterly', 'annual', 'bcorp', 'esg', 'impact']
    };

    // Extract keywords and entities from article
    function extractKeywords(article) {
        const text = `${article.title} ${article.summary} ${article.insight}`.toLowerCase();
        const extracted = {
            companies: [],
            products: [],
            geography: [],
            business: [],
            supply: [],
            regulatory: [],
            market: [],
            raw: []
        };

        // Extract entities by category
        for (const [category, keywords] of Object.entries(ENTITY_KEYWORDS)) {
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    extracted[category].push(keyword);
                    extracted.raw.push(keyword);
                }
            }
        }

        // Extract additional keywords from title (high value)
        const titleWords = article.title.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 4) // Only words longer than 4 chars
            .filter(w => !['sobre', 'para', 'desde', 'hasta', 'entre', 'with', 'from', 'about'].includes(w));

        extracted.raw.push(...titleWords);

        return extracted;
    }

    // Calculate similarity score between two articles
    function calculateSimilarity(article1, article2, keywords1, keywords2) {
        let score = 0;
        const reasons = [];

        // 1. Entity matches (high weight)
        const entityCategories = ['companies', 'products', 'geography', 'business', 'supply', 'regulatory'];
        const genericGeo = ['europe', 'asia', 'america', 'world', 'global'];

        for (const category of entityCategories) {
            const common = keywords1[category].filter(k => keywords2[category].includes(k));
            if (common.length > 0) {
                let weight = category === 'companies' || category === 'products' ? 3.0 : 2.0;

                // Penalize generic geography
                if (category === 'geography') {
                    const hasGeneric = common.some(k => genericGeo.includes(k));
                    if (hasGeneric && common.length === 1) {
                        weight = 0.3; // Very low weight for ONLY generic geo
                    } else if (hasGeneric) {
                        weight = 1.0; // Medium weight if has generic + specific
                    }
                }

                score += common.length * weight;
                reasons.push({
                    type: category,
                    entities: common,
                    weight: weight
                });
            }
        }

        // 2. Raw keyword overlap (reduced impact)
        const rawCommon = keywords1.raw.filter(k => keywords2.raw.includes(k));
        if (rawCommon.length > 0) {
            score += rawCommon.length * 0.3; // Reduced from 0.5
        }

        // 3. Same year bonus (small)
        if (article1.year === article2.year) {
            score += 0.3; // Reduced from 0.5
        }

        // 4. Same category (tiny bonus)
        if (article1.displayTopic === article2.displayTopic) {
            score += 0.2; // Reduced from 0.3
        }

        return { score, reasons };
    }

    // Build relationship map for all articles
    function buildRelationshipMap(articles) {
        const relationships = [];
        const articleKeywords = new Map();

        // Extract keywords for all articles
        articles.forEach(article => {
            articleKeywords.set(article.id, extractKeywords(article));
        });

        // Calculate similarities
        for (let i = 0; i < articles.length; i++) {
            for (let j = i + 1; j < articles.length; j++) {
                const a1 = articles[i];
                const a2 = articles[j];
                const k1 = articleKeywords.get(a1.id);
                const k2 = articleKeywords.get(a2.id);

                // Quick filter: must share at least 1 raw keyword
                const hasCommon = k1.raw.some(k => k2.raw.includes(k));
                if (!hasCommon) continue;

                const { score, reasons } = calculateSimilarity(a1, a2, k1, k2);

                // Threshold: VERY low (1.0) to maximize connections
                if (score >= 1.0) {
                    relationships.push({
                        from: a1.id,
                        to: a2.id,
                        score: score,
                        reasons: reasons
                    });
                }
            }
        }

        return relationships;
    }


    function renderSynapse_OLD() {
        const container = document.getElementById('synapse-graph-container');
        if (!container || typeof vis === 'undefined') {
            return;
        }

        // 1. Filter Data (Reuse logic from renderTimeline/renderGrid)
        const filtered = state.articles.filter(a => {
            let matchSearch = true;
            if (state.filters.search) {
                const searchTerms = expandSearchQuery(state.filters.search);
                const text = (a.title + " " + a.summary + " " + a.displayTopic + " " + a.subtopic).toLowerCase();
                matchSearch = searchTerms.some(term => text.includes(term));
            }
            const matchTopic = state.filters.topic === 'all' || a.displayTopic === state.filters.topic;
            const matchSub = state.filters.subtopic === 'all' || a.subtopic === state.filters.subtopic;
            const matchYear = state.filters.year === 'all' || (a.year && String(a.year).trim() === String(state.filters.year).trim());
            const matchMonth = state.filters.month === 'all' || (a.month && String(a.month).trim().toUpperCase() === String(state.filters.month).trim().toUpperCase());
            const articleMacro = (a.macro || '').toLowerCase().trim();
            const filterMacro = (state.filters.macro || 'all').toLowerCase().trim();
            const matchMacro = filterMacro === 'all' || articleMacro === filterMacro;

            // New Filters
            const matchSpecialty = state.filters.specialty === 'all' || (a.targetSpecialties && a.targetSpecialties.includes(state.filters.specialty));
            const matchProductPillar = state.filters.productPillar === 'all' || a.productPillar === state.filters.productPillar;
            const matchRegion = state.filters.region === 'all' || a.region === state.filters.region;
            const matchCountry = state.filters.country === 'all' || a.country === state.filters.country;

            const res = matchSearch && matchTopic && matchSub && matchYear && matchMonth && matchMacro && matchSpecialty && matchProductPillar && matchRegion && matchCountry;
            return res;
        });

        if (filtered.length === 0) {
            container.innerHTML = '<div class="center-msg" style="color:white; height:100%; display:flex; align-items:center; justify-content:center;">No data found for current filters.</div>';
            return;
        }

        // 2. Build Graph Data (SEM ANTIC RELATIONSHIPS)
        const nodes = [];
        const edges = [];
        const nodeIds = new Set();

        // Build semantic relationship map
        console.log('Building semantic relationships...');
        const relationshipMap = buildRelationshipMap(filtered);
        console.log(`Found ${relationshipMap.length} semantic connections`);

        // Create article nodes
        filtered.forEach(article => {
            const articleId = `a_${article.id || Math.random()}`;
            if (!nodeIds.has(articleId)) {
                // Count connections for this article
                const connectionCount = relationshipMap.filter(r =>
                    r.from === article.id || r.to === article.id
                ).length;

                nodes.push({
                    id: articleId,
                    label: connectionCount > 5 ? article.displayTopic.substring(0, 20) : '', // Show label for highly connected nodes
                    title: `<b>${article.title}</b><br/>${connectionCount} conexiones`, // Tooltip
                    group: 'article',
                    value: Math.max(3, connectionCount / 2), // Size based on connections
                    data: article,
                    color: getMacroColor(article.macro),
                    font: { size: 10, color: '#ffffff' }
                });
                nodeIds.add(articleId);
            }
        });

        // Create edges from semantic relationships
        relationshipMap.forEach(rel => {
            const fromId = `a_${rel.from}`;
            const toId = `a_${rel.to}`;

            // Determine edge color by relationship type
            let edgeColor = 'rgba(255,255,255,0.15)';

            if (rel.reasons.length > 0) {
                const primary = rel.reasons[0].type;
                if (primary === 'products') {
                    edgeColor = 'rgba(59, 130, 246, 0.4)'; // Blue for products
                } else if (primary === 'companies') {
                    edgeColor = 'rgba(34, 197, 94, 0.4)'; // Green for business
                } else if (primary === 'geography') {
                    edgeColor = 'rgba(234, 179, 8, 0.4)'; // Yellow for geography
                } else if (primary === 'business' || primary === 'supply') {
                    edgeColor = 'rgba(34, 197, 94, 0.3)'; // Green for business
                }
            }

            edges.push({
                from: fromId,
                to: toId,
                value: Math.min(rel.score / 2, 5), // Edge thickness based on score
                color: {
                    color: edgeColor,
                    highlight: edgeColor.replace('0.4', '0.8').replace('0.3', '0.6')
                },
                smooth: {
                    type: 'continuous',
                    roundness: 0.5
                },
                relationshipData: rel // Store relationship info
            });
        });

        // 3. Visualization Options
        const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
        const options = {
            nodes: {
                shape: 'dot',
                borderWidth: 0,
                shadow: true,
                font: { color: '#fff' }
            },
            edges: {
                width: 1,
                smooth: { type: 'continuous' }
            },
            physics: {
                stabilization: {
                    enabled: true,
                    iterations: 200, // Limit iterations
                    updateInterval: 25
                },
                barnesHut: {
                    gravitationalConstant: -8000,
                    springConstant: 0.02,
                    springLength: 180,
                    avoidOverlap: 0.5
                }
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                zoomView: true
            }
        };

        // 4. Create Network
        // Destroy old instance if exists to prevent leaks
        if (networkInstance) {
            networkInstance.destroy();
            networkInstance = null;
        }

        container.innerHTML = ''; // Clear container
        networkInstance = new vis.Network(container, data, options);

        // Freeze physics after stabilization for better UX
        networkInstance.on("stabilizationIterationsDone", function () {
            networkInstance.setOptions({ physics: false });
            console.log('Network stabilized and frozen');
        });

        // 5. Event Handling
        networkInstance.on("click", function (params) {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const clickedNode = data.nodes.get(nodeId);

                if (clickedNode.group === 'article') {
                    // --- DIMMING LOGIC ---
                    const connectedNodes = networkInstance.getConnectedNodes(nodeId);
                    const allNodes = data.nodes.get();

                    const updateArray = allNodes.map(n => {
                        if (n.id === nodeId || connectedNodes.includes(n.id)) {
                            // Highlight selected and connected
                            return {
                                id: n.id,
                                opacity: 1,
                                font: { color: '#ffffff' },
                                color: n.originalColor || n.color
                            };
                        } else {
                            // Dim others
                            return {
                                id: n.id,
                                opacity: 0.1,
                                font: { color: 'rgba(255,255,255,0)' } // Hide label
                            };
                        }
                    });

                    data.nodes.update(updateArray);

                    // Show article details regardless of dimming state
                    const allEdges = data.edges.get(); // Use data.edges direct reference
                    showSynapseDetails(clickedNode.data, allNodes, allEdges, nodeId);
                }
            } else {
                // --- RESTORE LOGIC ---
                const allNodes = data.nodes.get();
                const updateArray = allNodes.map(n => ({
                    id: n.id,
                    opacity: n.isActive ? 1 : 0.2, // Restore to original active state
                    font: { color: n.isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.05)' }
                }));
                data.nodes.update(updateArray);

                closeSynapseSidebar();
            }
        });
    }

    function showSynapseDetails(article, allNodes, allEdges, currentNodeId) {
        const sidebar = document.getElementById('synapse-sidebar');
        const content = document.getElementById('synapse-details');

        // Safety check for critical DOM elements
        if (!sidebar || !content) {
            console.error("CRITICAL: Synapse sidebar or content container not found in DOM.");
            return;
        }

        try {
            // DEBUG
            console.log("--- showSynapseDetails DEBUG ---");
            console.log("Article:", article ? article.title : "UNDEFINED ARTICLE");

            // Use passed nodeId or fallback
            // If article is undefined, we can't proceed with id construction safely unless we check
            if (!article) throw new Error("Article data is missing");

            const articleId = currentNodeId || `a_${article.id}`;
            const macroColor = getMacroColor(article.macro);

            // Edge filtering
            const connectedEdges = allEdges.filter(e =>
                e.from === articleId || e.to === articleId
            );

            // Calculate total connections
            const totalConnections = connectedEdges.length;

            // Extract related article nodes
            const related = connectedEdges.map(edge => {
                const relatedId = edge.from === articleId ? edge.to : edge.from;
                const relatedNode = allNodes.find(n => n.id === relatedId);

                if (!relatedNode) {
                    console.warn(`Related node not found for ID: ${relatedId}`);
                }

                return {
                    node: relatedNode,
                    relationshipData: edge.relationshipData
                };
            }).filter(r => r.node)
                .sort((a, b) => (b.relationshipData?.score || 0) - (a.relationshipData?.score || 0)) // Sort by score
                .slice(0, 25);

            // Analysis Text
            const analysisText = generateSemanticAnalysis(article, related, totalConnections);

            // Relationship HTML Generation (Robust)
            let relationshipHTML = "";
            let topTypeLabel = "Conexiones Mixtas"; // Default

            if (related.length > 0) {
                // Calculate relationship types
                const typeCounts = {};
                related.forEach(r => {
                    if (r.relationshipData && r.relationshipData.reasons) {
                        r.relationshipData.reasons.forEach(reason => {
                            typeCounts[reason.type] = (typeCounts[reason.type] || 0) + 1;
                        });
                    }
                });

                const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
                if (topType) {
                    const typeLabels = {
                        'companies': 'Empresas Comunes',
                        'products': 'Productos Similares',
                        'geography': 'Misma Región',
                        'business': 'Modelo de Negocio',
                        'supply': 'Cadena de Suministro',
                        'regulatory': 'Cumplimiento Normativo'
                    };
                    topTypeLabel = typeLabels[topType[0]] || topType[0];

                    // Extract entities for connection explanation
                    const topEntities = [];
                    const entitiesSeen = new Set();
                    related.forEach(r => {
                        if (r.relationshipData && r.relationshipData.reasons) {
                            r.relationshipData.reasons.forEach(reason => {
                                if (reason.type === topType[0] && reason.entities) {
                                    reason.entities.forEach(e => {
                                        if (!entitiesSeen.has(e)) {
                                            topEntities.push(`<strong>${e}</strong>`);
                                            entitiesSeen.add(e);
                                        }
                                    });
                                }
                            });
                        }
                    });

                    // Limit entities shown
                    const displayedEntities = topEntities.slice(0, 3);

                    relationshipHTML = `
                        Esta noticia está conectada principalmente por <strong>${topTypeLabel}</strong>. 
                        ${displayedEntities.length > 0 ? `Los conectores clave son: ${displayedEntities.join(', ')}.` : ''}
                    `;
                } else {
                    relationshipHTML = "Conexiones semánticas diversas sin un patrón dominante único.";
                }
            } else {
                relationshipHTML = "Esta noticia no tiene conexiones fuertes, lo que sugiere que es un tema de nicho o un evento aislado.";
            }

            // Related HTML Generation (Robust)
            let relatedHTML = "";
            if (related.length > 0) {
                const badgesHTML = related.map((r) => {
                    const n = r.node;
                    const relationData = r.relationshipData;
                    let reasonBadges = '';

                    if (relationData && relationData.reasons) {
                        reasonBadges = relationData.reasons.slice(0, 2).map(reason => {
                            const badgeColors = {
                                'companies': '#10b981',
                                'products': '#3b82f6',
                                'geography': '#eab308',
                                'business': '#10b981',
                                'supply': '#8b5cf6',
                                'regulatory': '#f59e0b'
                            };
                            const color = badgeColors[reason.type] || '#6b7280';
                            const labels = {
                                'companies': reason.entities.join(', '),
                                'products': reason.entities.join(', '),
                                'geography': reason.entities.join(', '),
                                'business': reason.entities.join(', '),
                                'supply': reason.entities.join(', '),
                                'regulatory': reason.entities.join(', ')
                            };
                            return `<span style="display: inline-block; background: ${color}30; color: ${color}; padding: 0.15rem 0.5rem; border-radius: 12px; font-size: 0.7rem; margin-right: 0.25rem;">${labels[reason.type] || reason.type}</span>`;
                        }).join('');
                    }

                    return `
                        <div class="synapse-related-item" style="position: relative;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
                                <div style="flex: 1;" onclick="selectSynapseNode('${n.id}')">
                                    <div class="synapse-related-title">${n.data.title}</div>
                                    <div class="synapse-related-meta">${n.data.year} • ${n.data.subtopic}</div>
                                    ${reasonBadges ? `<div style="margin-top: 0.5rem;">${reasonBadges}</div>` : ''}
                                </div>
                                <a href="${n.data.link}" target="_blank" 
                                   style="flex-shrink: 0; padding: 0.5rem; color: ${macroColor}; opacity: 0.7; transition: opacity 0.2s;"
                                   onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'"
                                   onclick="event.stopPropagation()"
                                   title="Abrir enlace">
                                    <i class="fa-solid fa-external-link-alt"></i>
                                </a>
                            </div>
                        </div>
                    `;
                }).join('');

                relatedHTML = `
                    <div class="synapse-related-section">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem;">
                            <h4 style="font-size: 0.95rem;"><i class="fa-solid fa-circle-nodes"></i> Noticias Relacionadas</h4>
                            <span style="font-size: 0.75rem; color: #94a3b8; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                                Mostrando ${related.length} de ${totalConnections}
                            </span>
                        </div>
                        ${related.length < totalConnections ? `<p style="font-size: 0.75rem; color: #64748b; margin-top: -0.5rem; margin-bottom: 1rem; font-style: italic;">Mostrando las ${related.length} conexiones semánticas más fuertes.</p>` : ''}
                        ${badgesHTML}
                    </div>
                `;
            } else {
                relatedHTML = '<p style="text-align: center; color: #64748b; padding: 2rem;">No se encontraron noticias relacionadas directamente conectadas.</p>';
            }

            const html = `
                <div class="synapse-detail-header" style="border-color: ${macroColor}">
                    <span class="synapse-detail-topic" style="background: ${macroColor}30; color: ${macroColor}">
                        ${article.displayTopic || article.topic || "Tema"}
                    </span>
                    <h2 class="synapse-detail-title">${article.title}</h2>
                    <div class="synapse-detail-meta">
                        <span><i class="fa-regular fa-calendar"></i> ${article.year} ${article.month || ''}</span>
                        <span><i class="fa-solid fa-layer-group"></i> ${article.subtopic || ''}</span>
                    </div>
                </div>

                <div class="synapse-detail-summary">
                    ${article.summary || article.insight || "Sin resumen disponible."}
                </div>
                
                <button onclick="window.open('${article.link}', '_blank')" class="primary-btn" style="width:100%; margin-bottom: 2rem;">
                    <i class="fa-solid fa-external-link-alt"></i> Leer Artículo Completo
                </button>

                 <!-- Relationship Explanation -->
                <div class="synapse-analysis-section" style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid ${macroColor}; padding: 1rem; border-radius: 8px; margin-bottom: 2rem;">
                    <h4 style="margin: 0 0 0.75rem 0; color: #cbd5e1; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fa-solid fa-diagram-project"></i> Por qué están conectadas
                    </h4>
                    <p style="margin: 0; font-size: 0.9rem; line-height: 1.6; color: #e2e8f0;">
                        ${relationshipHTML}
                    </p>
                </div>

                <!-- Contextual Analysis -->
                <div class="synapse-analysis-section" style="background: rgba(139, 92, 246, 0.1); border-left: 3px solid #8b5cf6; padding: 1rem; border-radius: 8px; margin-bottom: 2rem;">
                    <h4 style="margin: 0 0 0.75rem 0; color: #cbd5e1; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fa-solid fa-brain"></i> Análisis de Tendencia
                    </h4>
                    <p style="margin: 0; font-size: 0.9rem; line-height: 1.6; color: #e2e8f0;">
                        ${analysisText}
                    </p>
                </div>

                ${relatedHTML}
            `;

            content.innerHTML = html;
            sidebar.classList.remove('hidden');

        } catch (e) {
            console.error("CRITICAL ERROR in showSynapseDetails:", e);
            // Fallback UI
            if (content) {
                content.innerHTML = `
                    <div style="padding: 2rem; color: #f87171; text-align: center; border: 1px solid #7f1d1d; background: rgba(127, 29, 29, 0.2); border-radius: 8px;">
                        <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-bug"></i> Error de Visualización</h3>
                        <p>Ocurrió un error al generar los detalles de esta noticia.</p>
                        <pre style="text-align: left; background: rgba(0,0,0,0.3); padding: 1rem; margin-top: 1rem; overflow-x: auto; font-size: 0.8rem;">${e.message}\n${e.stack}</pre>
                    </div>
                `;
                sidebar.classList.remove('hidden');
            }
        }
    }

    // Generate semantic analysis based on relationship patterns
    function generateSemanticAnalysis(mainArticle, relatedArticles, totalCount) {
        if (relatedArticles.length === 0) {
            return "Este artículo parece ser un evento único o está pobremente conectado con otras noticias en la base de datos actual.";
        }

        const displayedCount = relatedArticles.length;
        const totalConnections = totalCount || displayedCount;

        // Collect all entities from relationships
        const allEntities = {
            companies: new Set(),
            products: new Set(),
            geography: new Set(),
            business: new Set(),
            supply: new Set()
        };

        relatedArticles.forEach(r => {
            if (r.relationshipData && r.relationshipData.reasons) {
                r.relationshipData.reasons.forEach(reason => {
                    if (reason.entities && allEntities[reason.type]) {
                        reason.entities.forEach(e => allEntities[reason.type].add(e));
                    }
                });
            }
        });

        // Build analysis text
        let analysis = `Este artículo forma parte de una red de <strong>${totalConnections} noticias interconectadas</strong> semánticamente`;

        if (totalConnections > displayedCount) {
            analysis += `, de las cuales mostramos las <strong>${displayedCount} más significativas</strong>. `;
        } else {
            analysis += `. `;
        }

        // Analyze entity patterns
        if (allEntities.companies.size > 0) {
            const companyList = Array.from(allEntities.companies).slice(0, 3).join(', ');
            analysis += `Las conexiones giran en torno a empresas clave como <strong>${companyList}</strong>. `;
        }

        if (allEntities.products.size > 0) {
            const productList = Array.from(allEntities.products).slice(0, 3).join(', ');
            analysis += `Las tecnologías/productos comunes incluyen <strong>${productList}</strong>. `;
        }

        if (allEntities.geography.size > 0) {
            const geoList = Array.from(allEntities.geography).slice(0, 2).join(', ');
            analysis += `Con especial relevancia en <strong>${geoList}</strong>. `;
        }

        // Connection strength
        if (totalConnections >= 6) {
            analysis += "La alta densidad de conexiones indica un tema de intensa cobertura e interés estratégico.";
        } else if (totalConnections >= 3) {
            analysis += "El nivel de conexión sugiere un área de interés emergente o en desarrollo.";
        } else {
            analysis += "Las pocas conexiones sugieren un nicho específico o nuevo desarrollo.";
        }

        return analysis;
    }


    // --- News Reader Logic (New Feature) ---

    // Expose Global Functions
    window.openNewsReader = function (id) {
        const article = state.articles.find(a => String(a.id) === String(id)); // Robust ID check
        if (!article) return;

        console.log("Opening Reader for:", article.title);

        const overlay = document.getElementById('news-reader-overlay');
        if (!overlay) return console.error("Overlay not found");

        const contextData = calculateContext(article);

        // Populate Content
        const titleEl = document.getElementById('reader-title');
        if (titleEl) titleEl.textContent = article.title;

        // Summary (Fallback to description or insight if summary empty)
        const summaryEl = document.getElementById('reader-summary');
        if (summaryEl) summaryEl.textContent = article.summary || article.insight || "Sin resumen disponible.";

        // Date
        const dateEl = document.getElementById('reader-date');
        if (dateEl) {
            const dateStr = article.date instanceof Date && !isNaN(article.date)
                ? article.date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : 'Fecha desconocida';
            dateEl.innerHTML = `<i class="fa-regular fa-calendar"></i> ${dateStr} <span style="margin-left:1rem; opacity:0.7;">${article.source || ''}</span>`;
        }

        // Link
        const linkBtn = document.getElementById('reader-link');
        if (linkBtn) linkBtn.href = article.link;


        // Tags
        const tagsContainer = document.getElementById('reader-tags');
        if (tagsContainer) {
            const macroColor = getMacroColor(article.macro);
            tagsContainer.innerHTML = `
                <span class="reader-tag" style="background:${macroColor}20; color:${macroColor}; border:1px solid ${macroColor}40;">${article.category}</span>
                <span class="reader-tag" style="background:#3b82f620; color:#60a5fa; border:1px solid #3b82f640;">${article.displayTopic}</span>
                ${article.productPillar !== 'transversal' ? `<span class="reader-tag" style="background:#8b5cf620; color:#a78bfa; border:1px solid #8b5cf640;">${article.productPillar}</span>` : ''}
            `;
        }



        // Context / Related News (List Only)
        const relatedContainer = document.getElementById('reader-related-content');
        if (relatedContainer) {
            console.log("Found related container, populating with", contextData.related.length, "items");
            if (contextData.related && contextData.related.length > 0) {
                relatedContainer.innerHTML = `
                    <h5 style="color:#94a3b8; font-size:0.85rem; text-transform:uppercase; margin-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem;">
                        <i class="fa-solid fa-link"></i> Lecturas Relacionadas
                    </h5>
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                        ${contextData.related.map(r => `
                            <div onclick="window.openNewsReader('${r.node.id}')" 
                                 class="related-card-item"
                            >
                                <div style="font-size:0.95rem; font-weight:600; color:#e2e8f0; margin-bottom:0.3rem;">${r.node.title}</div>
                                <div style="font-size:0.75rem; color:#64748b; display:flex; justify-content:space-between;">
                                    <span>${r.node.data.displayTopic}</span>
                                    <span>${(r.score * 10).toFixed(0)}% Coincidencia</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                relatedContainer.innerHTML = '<div style="color:#64748b; font-size:0.9rem; font-style:italic;">No hay lecturas relacionadas disponibles.</div>';
            }
        }

        // Show & Animate
        overlay.classList.remove('hidden');
    };

    window.closeNewsReader = function () {
        const overlay = document.getElementById('news-reader-overlay');
        if (overlay) overlay.classList.add('hidden');
    };

    function calculateContext(targetArticle) {
        let related = [];
        let totalConnections = 0;

        state.articles.forEach(other => {
            if (String(other.id) === String(targetArticle.id)) return;

            let score = 0;
            let reasons = [];

            // 1. Taxonomy Matching
            if (other.macro === targetArticle.macro) {
                score += 1;
                // reasons.push({type: 'business', entities: [other.macro]}); // Don't push generic macro reasons
            }
            if (other.displayTopic === targetArticle.displayTopic) {
                score += 3;
                reasons.push({ type: 'regulatory', entities: [other.displayTopic] });
            }
            if (other.subtopic === targetArticle.subtopic) {
                score += 5;
                reasons.push({ type: 'products', entities: [other.subtopic] });
            }

            // 2. Simple Keyword Overlap (Title/Summary)
            // Normalize: lower, remove accents
            const getWords = (txt) => normalizeText(txt).split(/\s+/).filter(w => w.length > 4);
            const targetWords = new Set(getWords(targetArticle.title + " " + targetArticle.summary));
            const otherWords = getWords(other.title + " " + other.summary);

            let matches = 0;
            otherWords.forEach(w => { if (targetWords.has(w)) matches++; });

            if (matches > 0) {
                score += matches * 0.5;
                if (matches > 2) reasons.push({ type: 'companies', entities: [`${matches} palabras clave`] });
            }

            if (score > 3) { // Threshold
                totalConnections++;
                related.push({
                    node: { id: other.id, title: other.title, data: other },
                    score: score,
                    relationshipData: { reasons: reasons }
                });
            }
        });

        // Sort by score DESC
        related.sort((a, b) => b.score - a.score);

        return {
            related: related.slice(0, 5), // Top 5
            totalConnections: totalConnections
        };
    }

    function getMacroColor(macro) {
        const colors = {
            'negocio': '#3b82f6', // blue
            'retail': '#10b981', // emerald
            'producto': '#8b5cf6', // violet
            'wellness': '#f59e0b', // amber
            'consumidor': '#ec4899', // pink
            'general': '#64748b'
        };
        return colors[macro] || '#64748b';
    }



    function generateContextualAnalysis(mainArticle, relatedArticles) {
        if (relatedArticles.length === 0) {
            return "Esta noticia representa un evento aislado en este tema. No hay suficientes artículos relacionados para generar un análisis contextual profundo.";
        }

        const totalRelated = relatedArticles.length;
        const topic = mainArticle.displayTopic;
        const macro = mainArticle.macro;

        // Count unique years
        const years = new Set([mainArticle.year, ...relatedArticles.map(n => n.data.year)]);
        const yearSpan = years.size > 1 ? `Este tema ha sido cubierto a lo largo de ${years.size} años diferentes` : `Este tema se concentra en ${mainArticle.year}`;

        // Analyze frequency
        let frequencyInsight = "";
        if (totalRelated >= 5) {
            frequencyInsight = `La alta densidad de ${totalRelated} noticias relacionadas indica que <strong>"${topic}"</strong> es un área de intensa actividad y cobertura mediática.`;
        } else if (totalRelated >= 3) {
            frequencyInsight = `Con ${totalRelated} noticias conectadas, <strong>"${topic}"</strong> muestra un nivel moderado de atención en el mercado.`;
        } else {
            frequencyInsight = `Las ${totalRelated} noticias relacionadas sugieren que <strong>"${topic}"</strong> está emergiendo como un tema de interés.`;
        }

        // Category context
        const categoryMap = {
            'negocio': 'estratégico y comercial',
            'consumidor': 'comportamiento del consumidor',
            'retail': 'distribución y retail',
            'producto': 'innovación de productos',
            'wellness': 'bienestar y salud'
        };
        const categoryContext = categoryMap[macro] || 'este sector';

        return `${frequencyInsight} ${yearSpan}, revelando una tendencia consistente en el contexto ${categoryContext}. El análisis de estas conexiones sugiere que los eventos no son aislados, sino parte de un movimiento más amplio en la industria.`;
    }

    // Helper to select node from sidebar
    window.selectSynapseNode = (nodeId) => {
        if (networkInstance) {
            networkInstance.selectNodes([nodeId]);
            const node = networkInstance.body.data.nodes.get(nodeId);
            if (node) {
                const allEdges = networkInstance.body.data.edges.get();
                showSynapseDetails(node.data, networkInstance.body.data.nodes.get(), allEdges, nodeId);
            }
        }
    }

    window.closeSynapseSidebar = () => {
        const sidebar = document.getElementById('synapse-sidebar');
        if (sidebar) sidebar.classList.add('hidden');
        if (networkInstance) networkInstance.unselectAll();
    };

    // === NEW SYNAPSE RENDERER WITH DIMMING LOGIC ===
    function renderSynapse() {
        const container = document.getElementById('synapse-graph-container');
        if (!container || typeof vis === 'undefined') {
            return;
        }

        // 1. Determine Active Filters
        const filters = state.filters;
        const isFilterActive = filters.search ||
            filters.topic !== 'all' ||
            filters.subtopic !== 'all' ||
            filters.year !== 'all' ||
            filters.month !== 'all' ||
            filters.macro !== 'all' ||
            filters.specialty !== 'all' ||
            filters.productPillar !== 'all' ||
            filters.region !== 'all' ||
            filters.country !== 'all';

        // DEBUG DATA
        if (state.articles.length > 0) {
            console.log("Sample Article Data (ID: " + state.articles[0].id + "):", {
                region: state.articles[0].region,
                country: state.articles[0].country,
                topic: state.articles[0].displayTopic,
                filters: filters
            });
        }

        // 2. Identify Matched Articles (Active Nodes)
        const activeIds = new Set();
        state.articles.forEach(a => {
            let matchSearch = true;
            if (filters.search) {
                const searchTerms = expandSearchQuery(filters.search);
                // Normalized search
                const text = (a.title + " " + a.summary + " " + a.displayTopic + " " + a.subtopic).toLowerCase();
                // Check if ALL terms match (AND logic for search)
                matchSearch = searchTerms.every(term => text.includes(term));
            }
            const matchTopic = filters.topic === 'all' || a.displayTopic === filters.topic;
            const matchSub = filters.subtopic === 'all' || a.subtopic === filters.subtopic;
            const matchYear = filters.year === 'all' || (a.year && String(a.year).trim() === String(filters.year).trim());
            const matchMonth = filters.month === 'all' || (a.month && String(a.month).trim().toUpperCase() === String(filters.month).trim().toUpperCase());
            const articleMacro = (a.macro || '').toLowerCase().trim();
            const filterMacro = (filters.macro || 'all').toLowerCase().trim();
            const matchMacro = filterMacro === 'all' || articleMacro === filterMacro;
            const matchSpecialty = filters.specialty === 'all' || (a.targetSpecialties && a.targetSpecialties.includes(filters.specialty));

            // Robust Product Pillar Match
            const articlePillar = (a.productPillar || '').toLowerCase().trim();
            const filterPillar = (filters.productPillar || 'all').toLowerCase().trim();
            const matchProductPillar = filterPillar === 'all' || articlePillar === filterPillar;

            // Debug specific mismatch if filter is active
            if (filterPillar !== 'all' && !matchProductPillar && state.articles.indexOf(a) < 3) {
                console.log(`Mismatch Pillar: Filter '${filterPillar}' vs Article '${articlePillar}' (ID: ${a.id})`);
            }

            // Robust Comparison for Location
            const articleRegion = (a.region || '').toLowerCase().trim();
            const filterRegion = (filters.region || 'all').toLowerCase().trim();
            const matchRegion = filterRegion === 'all' || articleRegion === filterRegion;

            if (filterRegion !== 'all' && !matchRegion && state.articles.indexOf(a) < 3) {
                console.log(`Mismatch Region: Filter '${filterRegion}' vs Article '${articleRegion}'`);
            }

            const articleCountry = (a.country || '').toLowerCase().trim();
            const filterCountry = (filters.country || 'all').toLowerCase().trim();
            const matchCountry = filterCountry === 'all' || articleCountry === filterCountry;

            if (filterCountry !== 'all' && !matchCountry && state.articles.indexOf(a) < 3) {
                console.log(`Mismatch Country: Filter '${filterCountry}' vs Article '${articleCountry}'`);
            }

            if (matchSearch && matchTopic && matchSub && matchYear && matchMonth && matchMacro && matchSpecialty && matchProductPillar && matchRegion && matchCountry) {
                activeIds.add(a.id);
            }
        });

        console.log('--- DEBUG SYNAPSE FILTER ---');
        console.log('Indices Activos:', isFilterActive);
        console.log('Filtros:', filters);
        console.log('Artículos Totales:', state.articles.length);
        console.log('Artículos Coincidentes:', activeIds.size);

        if (state.articles.length === 0) {
            container.innerHTML = '<div class="center-msg" style="color:white; height:100%; display:flex; align-items:center; justify-content:center;">No data loaded.</div>';
            return;
        }

        // 3. Build Graph Data (Filtered)
        // Use only active (matched) articles if filters are active.
        const dataset = isFilterActive
            ? state.articles.filter(a => activeIds.has(a.id))
            : state.articles;

        if (dataset.length === 0) {
            container.innerHTML = '<div class="center-msg" style="color:white; height:100%; display:flex; align-items:center; justify-content:center;">No match found for filters.</div>';
            return;
        }

        const nodes = [];
        const edges = [];
        const nodeIds = new Set();
        const connectivityMap = new Map();

        // Build semantic relationship map for FILTERED articles
        console.log(`Building semantic relationships for ${dataset.length} nodes...`);
        const relationshipMap = buildRelationshipMap(dataset);

        // Create article nodes
        dataset.forEach(article => {
            const articleId = `a_${article.id || Math.random()}`;
            if (!nodeIds.has(articleId)) {
                // All nodes in dataset are active by definition
                const isActive = true;

                const connectionCount = relationshipMap.filter(r =>
                    r.from === article.id || r.to === article.id
                ).length;

                // Store for edge logic
                connectivityMap.set(articleId, connectionCount);

                // Visual styling based on active state
                const baseColor = getMacroColor(article.macro);

                // Dimming Logic
                const nodeColor = isActive ? baseColor : 'rgba(80, 80, 80, 0.2)';
                const labelColor = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.05)';
                // Dimmed nodes are very transparent
                const opacity = isActive ? 1 : 0.2;

                // Mass: Hubs are extremely heavy to sink to center
                // Satellites are light to float on periphery
                const mass = 2 + (connectionCount * 3);

                // Size based on impact (connections) - More dramatic scaling
                const size = isActive ? Math.max(5, connectionCount * 1.2) : 2;

                nodes.push({
                    id: articleId,
                    label: (isActive && connectionCount > 3) ? article.displayTopic.substring(0, 15) : '',
                    title: `<b>${article.title}</b><br/>${connectionCount} conexiones`,
                    group: 'article',
                    value: size,
                    mass: mass, // Heavier nodes stay central
                    data: article,
                    color: nodeColor,
                    font: { size: 10, color: labelColor },
                    opacity: opacity,
                    isActive: isActive,
                    chosen: {
                        node: (values, id, selected, hovering) => {
                            if (!isActive) return;
                            values.color = baseColor;
                            values.borderColor = '#ffffff';
                            values.borderWidth = 2;
                        }
                    }
                });
                nodeIds.add(articleId);
            }
        });

        // --- NEW: Explicit Concentric Positioning ---
        // 1. Rank nodes by importance (connection count)
        nodes.sort((a, b) => (connectivityMap.get(b.id) || 0) - (connectivityMap.get(a.id) || 0));

        const totalNodes = nodes.length;
        // Define Cumulative Counts for 5 Tiers
        const limit1 = Math.ceil(totalNodes * 0.02); // Top 2% (Core)
        const limit2 = Math.ceil(totalNodes * 0.10); // Next 8%
        const limit3 = Math.ceil(totalNodes * 0.25); // Next 15%
        const limit4 = Math.ceil(totalNodes * 0.50); // Next 25%
        // Rest is Outer Ring

        nodes.forEach((node, index) => {
            let radius, ringTotal, ringIndex, offsetAngle;

            if (index < limit1) {
                // Ring 1: Core (Larger gap requested: ~120px)
                radius = 120;
                ringIndex = index;
                ringTotal = limit1;
                offsetAngle = 0;
            } else if (index < limit2) {
                // Ring 2
                radius = 280;
                ringIndex = index - limit1;
                ringTotal = limit2 - limit1;
                offsetAngle = 0.5;
            } else if (index < limit3) {
                // Ring 3
                radius = 420;
                ringIndex = index - limit2;
                ringTotal = limit3 - limit2;
                offsetAngle = 1.0;
            } else if (index < limit4) {
                // Ring 4
                radius = 580;
                ringIndex = index - limit3;
                ringTotal = limit4 - limit3;
                offsetAngle = 1.5;
            } else {
                // Ring 5: Outer
                radius = 750;
                ringIndex = index - limit4;
                ringTotal = totalNodes - limit4;
                offsetAngle = 2.0;
            }

            // Homogeneous Distribution (Regular Polygon)
            // Even spacing: 360 / N
            const angleStep = (2 * Math.PI) / (ringTotal || 1);
            const angle = (ringIndex * angleStep) + offsetAngle;

            // Jitter: +/- 15px radius, angle is strict
            const r = radius + (Math.random() * 30 - 15);

            // Convert polar to cartesian
            node.x = r * Math.cos(angle);
            node.y = r * Math.sin(angle);
        });

        // Create edges from semantic relationships
        relationshipMap.forEach(rel => {
            const fromId = `a_${rel.from}`;
            const toId = `a_${rel.to}`;

            const isFromActive = !isFilterActive || activeIds.has(rel.from);
            const isToActive = !isFilterActive || activeIds.has(rel.to);
            const isEdgeActive = isFromActive && isToActive;

            // Get weights/importance
            const countFrom = connectivityMap.get(fromId) || 0;
            const countTo = connectivityMap.get(toId) || 0;
            const isHubConnection = countFrom > 8 && countTo > 8;
            const isSatelliteConnection = countFrom < 3 || countTo < 3;

            // Optional: Hide edges requires at least one active node to be barely visible
            if (isFilterActive && !isFromActive && !isToActive) return;

            // Ultra-transparent default (3% opacity)
            let edgeColor = 'rgba(226, 232, 240, 0.03)';

            // Highlight color remains colored for interaction
            let highlightColor = edgeColor;
            if (rel.reasons.length > 0) {
                const primary = rel.reasons[0].type;
                if (primary === 'products') highlightColor = 'rgba(59, 130, 246, 0.6)';
                else if (primary === 'companies') highlightColor = 'rgba(34, 197, 94, 0.6)';
                else if (primary === 'geography') highlightColor = 'rgba(234, 179, 8, 0.6)';
            }
            if (isEdgeActive) {
                // Slightly more visible if active
                edgeColor = 'rgba(226, 232, 240, 0.08)';
            }

            // Adjust opacity for dimmed scenarios
            let finalColor = edgeColor;
            let width = 1;

            if (!isEdgeActive) {
                finalColor = 'rgba(255, 255, 255, 0.01)';
            }

            // Variable Spring Length to enforce Orbits
            // Core (Hub-Hub): Short springs -> Tight center
            // Periphery (Hub-Sat): Long springs -> Outer orbit
            let springLength = 200;
            if (isHubConnection) springLength = 50; // Inner Core
            else if (isSatelliteConnection) springLength = 350; // Outer shell
            else springLength = 150; // Mid shell

            edges.push({
                from: fromId,
                to: toId,
                width: width,
                length: springLength, // Physics uses this per edge
                color: {
                    color: finalColor,
                    highlight: highlightColor, // Color appears on selection/hover
                    opacity: isEdgeActive ? 1 : 0.05
                },
                smooth: { type: 'continuous', roundness: 0.5 },
                relationshipData: rel
            });
        });

        // 3. Visualization Options

        // PRE-ANIMATION SETUP: Capture targets and reset nodes to start positions to prevent flash
        const animationState = {};
        nodes.forEach(n => {
            animationState[n.id] = { targetX: n.x, targetY: n.y };

            // Set initial position to center cluster for "Explosion" effect
            const startAngle = Math.random() * Math.PI * 2;
            const startR = Math.random() * 50;
            n.x = startR * Math.cos(startAngle);
            n.y = startR * Math.sin(startAngle);

            // Store start in state too for easy interpolation
            animationState[n.id].startX = n.x;
            animationState[n.id].startY = n.y;
        });

        const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
        const options = {
            nodes: {
                shape: 'dot',
                borderWidth: 0,
                shadow: true,
                font: { color: '#fff' }
            },
            edges: {
                width: 1,
                smooth: { type: 'continuous' }
            },
            physics: {
                enabled: false, // STATIC LAYOUT: Physics off to keep concentric rings
                stabilization: false
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                zoomView: true
            }
        };

        // 4. Create Network
        if (networkInstance) {
            networkInstance.destroy();
            networkInstance = null;
        }
        container.innerHTML = '';
        networkInstance = new vis.Network(container, data, options);

        // --- Custom Assembly Animation (5 seconds) ---
        const startTime = Date.now();
        const duration = 5000;

        const animInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3); // Cubic Ease Out

            Object.keys(animationState).forEach(id => {
                const state = animationState[id];
                if (networkInstance.body.nodes[id]) {
                    networkInstance.body.nodes[id].x = state.startX + (state.targetX - state.startX) * ease;
                    networkInstance.body.nodes[id].y = state.startY + (state.targetY - state.startY) * ease;
                }
            });

            networkInstance.redraw();

            if (progress >= 1) {
                clearInterval(animInterval);
                networkInstance.fit();
            }
        }, 33); // ~30fps

        // --- NEW: Draw Concentric Background Rings ---
        networkInstance.on("beforeDrawing", function (ctx) {
            const center = networkInstance.canvasToDOM({ x: 0, y: 0 });
            const scale = networkInstance.getScale();

            ctx.save();
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 15]);

            const radii = [120, 280, 420, 580, 750];
            radii.forEach(r => {
                ctx.beginPath();
                ctx.arc(center.x, center.y, r * scale, 0, 2 * Math.PI);
                ctx.stroke();
            });
            ctx.restore();
        });

        // 5. Event Handling
        // 5. Event Handling
        networkInstance.on("click", function (params) {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const clickedNode = data.nodes.get(nodeId);

                if (clickedNode.group === 'article') {
                    // --- DIMMING LOGIC ---
                    const connectedNodes = networkInstance.getConnectedNodes(nodeId);
                    const allNodes = data.nodes.get();

                    const updateArray = allNodes.map(n => {
                        if (n.id === nodeId || connectedNodes.includes(n.id)) {
                            // Highlight selected and connected
                            return {
                                id: n.id,
                                opacity: 1,
                                font: { color: '#ffffff' },
                                color: n.originalColor || n.color
                            };
                        } else {
                            // Dim others
                            return {
                                id: n.id,
                                opacity: 0.1,
                                font: { color: 'rgba(255,255,255,0)' } // Hide label
                            };
                        }
                    });

                    data.nodes.update(updateArray);

                    // Show article details regardless of dimming state
                    const allEdges = data.edges.get();
                    showSynapseDetails(clickedNode.data, nodes, allEdges, nodeId);
                }
            } else {
                // --- RESTORE LOGIC ---
                const allNodes = data.nodes.get();
                const updateArray = allNodes.map(n => ({
                    id: n.id,
                    opacity: n.isActive ? 1 : 0.2, // Restore to original active state
                    font: { color: n.isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.05)' }
                }));
                data.nodes.update(updateArray);

                closeSynapseSidebar();
            }
        });
    }

    // Listen for Product Pillar Filter Changes from Global Scope
    document.addEventListener('productPillarFilterChange', (e) => {
        const { value } = e.detail;
        console.log('Product Pillar Filter Changed to:', value);
        state.filters.productPillar = value;
        renderSynapse();
    });

    // === NEW: Event Listeners for Synapse Dimming Filters ===
    // These ensure that changing filters updates the Synapse view immediately if active
    const synapseFilters = ['macro-filter', 'topic-filter', 'subtopic-filter'];
    synapseFilters.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                // Determine which filter changed and update state accordingly
                // Note: The existing updateFilters() logic handles the state update for these,
                // but we need to force a re-render of Synapse if we are in that view.

                // Small delay to allow main app logic (updateFilters) to process state changes first
                setTimeout(() => {
                    if (state.currentView === 'synapse') {
                        console.log(`Filter ${id} changed, re-rendering Synapse...`);
                        renderSynapse();
                    }
                }, 50);
            });
        }
    });

    // === NEW: Search Input Listener for Synapse (Debounced) ===
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            if (state.currentView === 'synapse') {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    console.log('Search input changed, re-rendering Synapse...');
                    // State is already updated by the main listener
                    renderSynapse();
                }, 300); // 300ms debounce to prevent lag while typing
            }
        });
    }

    // === NEW: Sidebar Search Input Listener ===
    const sidebarSearchInput = document.getElementById('sidebar-search-input');
    if (sidebarSearchInput) {
        let debounceTimerSidebar;
        sidebarSearchInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            state.filters.search = val;

            // Sync with main search input if it exists
            if (elements.searchInput) elements.searchInput.value = val;

            clearTimeout(debounceTimerSidebar);
            debounceTimerSidebar = setTimeout(() => {
                console.log('Sidebar search input changed:', val);
                updateView(); // Updates Grid or Synapse or Strategy

                // Specific Synapse re-render if active (updateView calls renderGrid, but renderSynapse needs manual call if not handled by updateView for 'synapse' mode??)
                // updateView checks state.currentView. If 'synapse', does it call renderSynapse?
                // Let's check updateView implementation... it calls renderTimeline, renderGrid, generateStrategicSummary.
                // It does NOT seem to call renderSynapse.
                if (state.currentView === 'synapse') {
                    renderSynapse();
                }
            }, 300);
        });
    }

    // Start App
    init();
});

// --- Mobile Sidebar Logic ---
window.toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
};

// --- NEW: Product Pillar Filter Function ---
window.filterByProductPillar = (value) => {
    // Access state from the DOMContentLoaded scope
    const event = new CustomEvent('productPillarFilterChange', { detail: { value } });
    document.dispatchEvent(event);
};
