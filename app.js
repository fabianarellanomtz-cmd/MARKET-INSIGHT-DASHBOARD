document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let state = {
        articles: [],
        filters: {
            search: '',
            topic: 'all',
            macro: 'all', // New filter
            year: 'all',
            month: 'all'
        },
        currentView: 'news'
    };

    // --- DOM Elements ---
    const elements = {
        fileInput: document.getElementById('file-input'),
        dropZone: document.getElementById('drop-zone'),
        grid: document.getElementById('news-grid'),
        emptyState: document.getElementById('empty-state'),
        loadingState: document.getElementById('loading-state'),
        searchInput: document.getElementById('search-input'),
        topicFilter: document.getElementById('topic-filter'),
        yearFilter: document.getElementById('year-filter'),
        monthFilter: document.getElementById('month-filter'),
        macroFilter: document.getElementById('macro-filter'), // New Element
        resetBtn: document.getElementById('reset-filters'),
        totalCount: document.getElementById('total-count'),
        lastUpdate: document.getElementById('last-update-date')
    };

    // --- Initialization ---
    init();

    function init() {
        setupEventListeners();
        loadFromStorage();
    }

    // --- Event Listeners ---
    function setupEventListeners() {
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
        if (elements.searchInput) elements.searchInput.addEventListener('input', (e) => { state.filters.search = e.target.value.toLowerCase(); updateView(); });
        if (elements.topicFilter) elements.topicFilter.addEventListener('change', (e) => { state.filters.topic = e.target.value; updateView(); });
        if (elements.yearFilter) elements.yearFilter.addEventListener('change', (e) => { state.filters.year = e.target.value; state.filters.month = 'all'; updateMonthOptions(); updateView(); });
        if (elements.monthFilter) elements.monthFilter.addEventListener('change', (e) => { state.filters.month = e.target.value; updateView(); });

        // New Macro Filter Listener
        if (elements.macroFilter) {
            elements.macroFilter.addEventListener('change', (e) => {
                state.filters.macro = e.target.value;
                updateView();
            });
        }

        if (elements.resetBtn) elements.resetBtn.addEventListener('click', resetFilters);
    }

    // --- Helper Logic ---
    function determineMacroCategory(topicString) {
        const fullTopic = (topicString || "").toLowerCase();
        if (fullTopic.includes('retail') || fullTopic.includes('distribución') || fullTopic.includes('expansión') || fullTopic.includes('tienda')) {
            return "retail";
        } else if (fullTopic.includes('negocio') || fullTopic.includes('financier') || fullTopic.includes('m&a') || fullTopic.includes('adquisición') || fullTopic.includes('corporativ')) {
            return "negocio";
        } else if (fullTopic.includes('producto') || fullTopic.includes('ingrediente') || fullTopic.includes('ciencia') || fullTopic.includes('innovación') || fullTopic.includes('skincare')) {
            return "producto";
        } else if (fullTopic.includes('wellness') || fullTopic.includes('salud') || fullTopic.includes('hormonal') || fullTopic.includes('menopausia') || fullTopic.includes('suplement')) {
            return "wellness";
        } else if (fullTopic.includes('consumidor') || fullTopic.includes('cultura') || fullTopic.includes('marketing') || fullTopic.includes('trend') || fullTopic.includes('generaci')) {
            return "consumidor";
        }
        return "otros";
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

                state.articles = jsonData.map(normalizeRow).filter(a => a.title && a.title !== "Sin título");

                alert(`Datos cargados: ${state.articles.length} noticias.`);
                saveToStorage();

                updateFilters();
                updateMonthOptions();
                renderGrid();
                updateLastUpdated();
                setLoading(false);
            } catch (err) {
                console.error(err);
                alert("Error al leer el archivo: " + err.message);
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function normalizeRow(row) {
        const get = (key) => {
            if (row[key] !== undefined) return row[key];
            const cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const found = Object.keys(row).find(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === cleanKey);
            return found ? row[found] : "";
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
                else dateObj = new Date(d);
                if (!yearRaw) yearRaw = dateObj.getFullYear();
                if (!monthRaw) monthRaw = dateObj.toLocaleDateString('es-ES', { month: 'long' });
            }
        }

        const fullDisplayTopic = subtopic ? `${topic} - ${subtopic}` : topic;
        const macroCat = determineMacroCategory(`${topic} ${subtopic}`);

        return {
            title: title || "Noticia sin título",
            link: link,
            source: source,
            topic: fullDisplayTopic,
            displayTopic: topic,
            summary: summary || "",
            date: dateObj,
            year: yearRaw ? yearRaw.toString().trim() : "",
            month: monthRaw ? monthRaw.toString().trim().toUpperCase() : "",
            macro: macroCat,
            id: Math.random().toString(36).substr(2, 9)
        };
    }

    // --- UI Rendering ---
    function renderGrid() {
        if (state.currentView !== 'news') return;
        elements.grid.innerHTML = '';

        const filtered = state.articles.filter(a => {
            const matchSearch = !state.filters.search || a.title.toLowerCase().includes(state.filters.search) || a.summary.toLowerCase().includes(state.filters.search);
            const matchTopic = state.filters.topic === 'all' || a.displayTopic === state.filters.topic;
            const matchYear = state.filters.year === 'all' || (a.year && a.year === state.filters.year);
            const matchMonth = state.filters.month === 'all' || (a.month && a.month === state.filters.month);
            // Macro Filter
            const matchMacro = state.filters.macro === 'all' || a.macro === state.filters.macro;
            return matchSearch && matchTopic && matchYear && matchMonth && matchMacro;
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

            // Add Macro badge
            let macroLabel = "";
            let macroColor = "#eee";
            switch (article.macro) {
                case 'negocio': macroLabel = "Negocio"; macroColor = "#dbeafe"; break;
                case 'retail': macroLabel = "Retail"; macroColor = "#ffedd5"; break;
                case 'producto': macroLabel = "Producto"; macroColor = "#dcfce7"; break;
                case 'wellness': macroLabel = "Wellness"; macroColor = "#fce7f3"; break;
                case 'consumidor': macroLabel = "Consumidor"; macroColor = "#f3e8ff"; break;
            }

            const badgeHtml = macroLabel
                ? `<span style="display:inline-block; font-size:0.7rem; background:${macroColor}; padding:2px 6px; border-radius:4px; margin-bottom:0.5rem; color:#555; text-transform:uppercase; font-weight:600;">${macroLabel}</span>`
                : '';

            card.innerHTML = `
                <div class="card-header">
                    <span class="card-topic">${article.topic}</span>
                    <span class="card-date">${dateStr}</span>
                </div>
                ${badgeHtml}
                <h3 class="card-title">${article.title}</h3>
                <p class="card-snippet">${article.summary}</p>
                <div class="card-footer">
                     <span class="source-badge">${article.source || 'Fuente'}</span>
                     <a href="${article.link}" target="_blank" class="read-link">Link <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
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

    function updateFilters() {
        const topics = new Set(state.articles.map(a => a.displayTopic).filter(Boolean));
        if (elements.topicFilter) {
            elements.topicFilter.innerHTML = '<option value="all">Todos</option>';
            topics.forEach(t => elements.topicFilter.appendChild(new Option(t, t)));
        }

        const years = new Set(state.articles.map(a => a.year).filter(Boolean));
        const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
        if (elements.yearFilter) {
            elements.yearFilter.innerHTML = '<option value="all">Año</option>';
            sortedYears.forEach(y => elements.yearFilter.appendChild(new Option(y, y)));
        }
        updateMonthOptions();
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
                        a.macro = determineMacroCategory(a.topic);
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
            : document.querySelector('.nav-item:last-child');
        if (activeBtn) activeBtn.classList.add('active');

        // Toggle Container Visibility
        state.currentView = viewName;
        updateView();

        const strategicView = document.getElementById('strategic-view');
        const searchContainer = document.getElementById('search-container');
        const sidebar = document.getElementById('filters-sidebar');

        if (viewName === 'news') {
            if (strategicView) strategicView.classList.add('hidden');
            if (searchContainer) searchContainer.style.visibility = 'visible';
            if (sidebar) sidebar.classList.remove('hidden');
        } else {
            if (elements.grid) elements.grid.classList.add('hidden');
            if (strategicView) strategicView.classList.remove('hidden');
            if (searchContainer) searchContainer.style.visibility = 'hidden';
            generateStrategicSummary();
        }
    };

    function updateView() {
        if (state.currentView === 'news') renderGrid();
        else generateStrategicSummary();
    }

    // --- ANTIGRAVITY DYNAMIC ANALYSIS DB ---
    const ANALYSIS_DB = {
        '2025': {
            title: "Retrospectiva 2025: La Corrección del Mercado",
            summary: `<strong>El Año de la Racionalización.</strong><br>
            2025 estuvo marcado por la inflación y la fatiga del consumidor. El mercado premió el "Value for Money" y castigó el "Hype" vacío. Fue el auge de los "Dupes" y la caída de las marcas de celebridades sin sustancia.`,
            global_synthesis: [
                { title: "El Auge de la 'Dupe Culture'", text: "El consumidor buscó activamente alternativas baratas a productos de lujo. La lealtad de marca cayó a mínimos históricos." },
                { title: "Crisis de Influencers", text: "El 'De-influencing' viralizó la honestidad brutal. Los consumidores dejaron de confiar en reviews pagadas de TikTokers masivos." },
                { title: "Retail Físico como Showroom", text: "El tráfico a tiendas volvió, pero la conversión bajó. La gente iba a probar texturas para luego buscar el mejor precio online." }
            ],
            macro_focus: [
                { name: "📉 1. Economía & Negocio", insight: "Supervivencia del más Apto", details: "Consolidación forzada. Marcas indie sin cash flow positivo cerraron. El capital riesgo cerró el grifo." },
                { name: "🛒 2. Retail & Canales", insight: "Guerra de Precios", details: "Promociones agresivas (365 días de Black Friday). El consumidor se entrenó a comprar solo con descuento." },
                { name: "🧪 3. Producto", insight: "Básicos Efectivos", details: "Vuelta a ingredientes conocidos y seguros (Retinol, Vitamina C). Menos experimentación, más certeza." },
                { name: "🧘 4. Wellness", insight: "Salud Mental Low Cost", details: "El 'Self-care' se convirtió en una necesidad ante el estrés económico, buscado en pequeños lujos accesibles." },
                { name: "🗣️ 5. Consumidor", insight: "Cinismo Informado", details: "El comprador investiga ingredientes y márgenes. Rechazo al 'Clean Washing' y greenwashing." }
            ],
            risks_opportunities: `<ul style="list-style-type: none; padding-left: 0;"><li style="margin-bottom: 8px;">🔴 <strong>Riesgo:</strong> Guerra de precios insostenible que erosiona el valor de marca a largo plazo.</li><li style="margin-bottom: 8px;">🟢 <strong>Oportunidad:</strong> Capturar al consumidor 'huérfano' de marcas caras con propuestas de valor honestas y transparentes.</li></ul>`,
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
            summary: `<strong>Renacimiento Científico y Sensorial.</strong><br>
            El mercado ha evolucionado de silos independientes a un ecosistema totalmente integrado. El éxito ya no reside en el precio, sino en la convergencia de 5 fuerzas: Salud (Wellness), Ciencia (Biotech), Negocio (Smart Capital), Retail (Omnicanal) y Cultura (Autenticidad).`,
            global_synthesis: [
                { title: "De la Viralidad a la Verificación Clínica", text: "El consumidor de 2026 exige validación clínica inmediata. Las marcas que solo ofrecen marketing sin respaldo científico (IP) están perdiendo cuota." },
                { title: "La Bifurcación del Mercado", text: "Polarización extrema: Lujo Científico o Valor Extremo. El 'Masstige' indefinido muere. Las marcas ganadoras tienen una proposición radical." },
                { title: "Retail Media como Motor de Profit", text: "La rentabilidad para cadenas como Ulta o Sephora viene de sus redes de publicidad (RMNs). La tienda es un canal de medios." }
            ],
            macro_focus: [
                { name: "💼 1. Dinámica de Negocio (M&A)", insight: "Refugio en Calidad", details: "El capital fluye hacia marcas con IP científica o legado histórico. La rentabilidad mata al crecimiento a cualquier precio." },
                { name: "🛍️ 2. Retail & Distribución", insight: "La Tienda como Medio", details: "El retail físico no muere, se especializa. Es el principal canal de reclutamiento ante el costo de los anuncios digitales." },
                { name: "🧪 3. Ciencia & Producto", insight: "Eficacia Clínica Extrema", details: "El consumidor 'Skintellectual' exige pruebas de microscopía y moléculas patentadas. Maquillaje con péptidos reales." },
                { name: "💊 4. Wellness & Salud", insight: "Medicalización del Bienestar", details: "Desde protocolos 'Ozempic Face' hasta control de cortisol. La belleza es una rama de la salud preventiva." },
                { name: "🗣️ 5. Cultura & Consumidor", insight: "Autenticidad & Tribus", details: "Gen Z busca 'Caos' y verdad. Las marcas ganadoras son las que eligen un bando claro y construyen comunidad real." }
            ],
            risks_opportunities: `<ul style="list-style-type: none; padding-left: 0;"><li style="margin-bottom: 8px;">🔴 <strong>Riesgo:</strong> La 'Fatiga de Dupes' y la saturación de marcas de influencers sin IP científica.</li><li style="margin-bottom: 8px;">🟢 <strong>Oportunidad:</strong> La expansión de la <strong>Belleza Masculina</strong> y el auge del <strong>Haircare de Lujo</strong> ('Skinification').</li></ul>`,
            strategic_tactics: {
                'negocio': {
                    threats: [
                        { source: "LVMH / Estée Lauder", move: "Adquisición agresiva de marcas nicho con IP clínica.", response: "Blindaje de Valor: Auditar IP y preparar defensa." },
                        { source: "Venture Capital", move: "Exigencia de EBITDA positivo.", response: "Corte de Grasa: Eliminar canales ineficientes." },
                        { source: "Entorno Regulatorio", move: "Prohibición microplásticos/Retinol.", response: "Reformulación Preventiva." }
                    ],
                    quick_wins: [{ title: "Auditoría de IP", text: "Registrar fórmulas clave." }, { title: "Optimización Margen", text: "Eliminar SKUs <15%." }, { title: "Alianzas", text: "Exclusividad proveedores." }]
                },
                'retail': {
                    threats: [
                        { source: "Sephora / Ulta", move: "Subida costes Retail Media (RMNs).", response: "Escape Velocity: Fortalecer DTC." },
                        { source: "TikTok Shop", move: "Social Commerce transaccional.", response: "Flash Sales exclusivas." },
                        { source: "Farmacia Moderna", move: "Premiumización del pasillo de farmacia.", response: "Masstige Partner." }
                    ],
                    quick_wins: [{ title: "Data Harvest", text: "Captura emails en tienda." }, { title: "Bundles Web", text: "Kits exclusivos online." }, { title: "Staff Guerrilla", text: "Vendedores digitalizadores." }]
                },
                'producto': {
                    threats: [
                        { source: "Topicals / The Ordinary", move: "Democratización de activos.", response: "Elevación Narrativa: Vender Sistema de Entrega." },
                        { source: "Neuro-Cosmetics", move: "Claims emocionales (cortisol).", response: "Test Sensorial." },
                        { source: "Hyper-Personalization", move: "ADN y tests hormonales.", response: "Quiz Digital." }
                    ],
                    quick_wins: [{ title: "Storytelling Tech", text: "Destacar absorción." }, { title: "Validación Externa", text: "Estudio clínico visible." }, { title: "Packaging Lab", text: "Iconografía médica." }]
                },
                'wellness': {
                    threats: [
                        { source: "Hims & Hers / Ro", move: "Telemedicina integrada.", response: "Medicalización Light: Consejo Asesor." },
                        { source: "Biohacking", move: "Terapias IV/Luz Roja.", response: "Partnership Clínico." },
                        { source: "Sleep Economy", move: "Recuperación Nocturna.", response: "Niche Launch: Night Recovery." }
                    ],
                    quick_wins: [{ title: "Sello Médico", text: "Board de Expertos." }, { title: "Bundle Estrés", text: "Kit Cortisol." }, { title: "Guía QR", text: "Protocolo uso." }]
                },
                'consumidor': {
                    threats: [
                        { source: "Influencer Economy", move: "Fatiga de Dupes.", response: "Pívot a Calidad de verdad." },
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

    // --- Export Function (Generic) ---
    async function exportSection(sectionId, btnId) {
        const element = document.getElementById(sectionId);
        const btn = document.getElementById(btnId);

        if (btn) btn.style.display = 'none';

        try {
            const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#f3f4f6" });
            const link = document.createElement('a');
            link.download = `Insights_${sectionId}_${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error(err);
            alert("Error al exportar imagen");
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
            const matchMacro = state.filters.macro === 'all' || a.macro === state.filters.macro;
            const matchYear = state.filters.year === 'all' || (a.year && a.year === state.filters.year);
            const matchMonth = state.filters.month === 'all' || (a.month && a.month === state.filters.month);
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
                <!-- SECTION 1: GLOBAL STRATEGY (${contextKey}) -->
                <div id="section-global" style="background:#f3f4f6; padding:1rem; border-radius:12px; margin-bottom: 2rem;">
                    <div style="margin-bottom:1rem; text-align:right;">
                        <button id="export-global-btn" class="action-btn-small" style="background:#2563eb; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">
                            <i class="fa-solid fa-download"></i> Exportar Panorama Global
                        </button>
                    </div>

                    <!-- Analysis Card -->
                    <div class="insight-card" style="background: white; border-top: 5px solid #6366f1; padding: 2rem;">
                        <div style="text-align:center; margin-bottom:2rem;">
                            <h2 style="color:#1f2937; margin-bottom:0.5rem;">${ANALYSIS_DATA.title}</h2>
                            <p style="color:#6b7280;">Generado por Market Insights AI • ${new Date().toLocaleDateString()}</p>
                        </div>

                        <div style="background:#eef2ff; padding:1.5rem; border-radius:12px; margin-bottom:2rem; border-left:4px solid #4f46e5;">
                            <p style="font-size:1.1rem; line-height:1.6; color:#1f2937; margin:0;">
                                ${ANALYSIS_DATA.summary}
                            </p>
                        </div>

                        <!-- Global Strategic Insights -->
                        <div style="margin-bottom: 2.5rem;">
                            <h3 style="color:#111827; font-size:1.1rem; margin-bottom:1rem; border-left:4px solid #059669; padding-left:1rem;">
                                Insights Estratégicos Globales
                            </h3>
                            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1rem;">
                                ${ANALYSIS_DATA.global_synthesis.map(item => `
                                    <div style="background:#ecfdf5; padding:1.2rem; border-radius:8px; border:1px solid #d1fae5;">
                                        <h4 style="margin:0 0 0.5rem 0; color:#065f46; font-size:1rem; font-weight:700;">${item.title}</h4>
                                        <p style="margin:0; font-size:0.95rem; color:#064e3b; line-height:1.5;">${item.text}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- 5 Macro Categories Grid -->
                        <h3 style="color:#374151; font-size:1.2rem; text-transform:uppercase; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; margin-bottom: 1.5rem;">
                            <i class="fa-solid fa-layer-group"></i> Las 5 Macro-Tendencias
                        </h3>
                        
                        <div style="display:flex; flex-direction:column; gap:1.5rem;">
                            ${ANALYSIS_DATA.macro_focus.map(m => `
                                <div style="display:flex; gap:1rem; align-items:flex-start; background:#f9fafb; padding:1rem; border-radius:8px;">
                                    <div style="flex:1;">
                                        <h5 style="margin:0 0 0.5rem 0; color:#4338ca; font-size:0.95rem;">${m.name}</h5>
                                        <div style="font-size:0.8rem; font-weight:bold; color:#be185d; margin-bottom:0.3rem;">CLAVE: ${m.insight}</div>
                                        <p style="margin:0; font-size:0.9rem; color:#4b5563; line-height:1.5;">${m.details}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <div style="margin-top:2rem; background:#f8fafc; padding:1rem; border-radius:8px;">
                                <h4 style="margin-top:0; margin-bottom:0.8rem; color:#374151; font-size:0.95rem; text-transform:uppercase;">Riesgos y Oportunidades</h4>
                                <div style="font-size:0.95rem; color:#1f2937;">${ANALYSIS_DATA.risks_opportunities}</div>
                        </div>
                    </div>
                </div>

                <!-- SECTION 2: TACTICAL WAR ROOM -->
                <div id="section-tactical" style="background:#f3f4f6; padding:1rem; border-radius:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h2 style="margin:0; color:#1f2937; font-size:1.4rem;">Tablero Táctico & Noticias</h2>
                        <button id="export-tactical-btn" class="action-btn-small" style="background:#be185d; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">
                            <i class="fa-solid fa-crosshairs"></i> Exportar Tablero Táctico
                        </button>
                    </div>

                    <div class="dashboard-row">
                        <!-- Top News per Topic (Left Column) -->
                        <div class="stat-box">
                            <h3 style="margin-bottom:1rem; color:#4b5563; text-transform:uppercase; font-size:0.85rem; letter-spacing:0.05em;">Noticias Relevantes (Top 2)</h3>
                            <div style="display:flex; flex-direction:column; gap:1rem;">
                                ${sortedTopics.map(t => {
                const topicName = t[0];
                // Take TOP 2 filtered articles
                const articles = filtered.filter(a => (a.displayTopic || "General") === topicName).slice(0, 2);

                if (articles.length === 0) return '';

                return `
                                        <div style="background:#f9fafb; padding:1rem; border-radius:8px; border-left: 3px solid #6366f1;">
                                            <div style="font-size:0.75rem; color:#6366f1; font-weight:700; text-transform:uppercase; margin-bottom:0.5rem;">${topicName}</div>
                                            <div style="display:flex; flex-direction:column; gap:0.8rem;">
                                                ${articles.map(article => `
                                                    <div style="border-bottom:1px solid #e5e7eb; padding-bottom:0.5rem; last-child:border-bottom:0;">
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
                        <div class="stat-box" style="display:flex; flex-direction:column; border:1px solid #e5e7eb; background:white;">
                            <h3 style="margin-bottom:0.5rem; color:#4b5563; text-transform:uppercase; font-size:0.8rem; letter-spacing:0.05em; display:flex; justify-content:space-between; align-items:center;">
                                <span><i class="fa-solid fa-binoculars"></i> Vigilancia de Competencia & Tácticas</span>
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
                                                <div style="background:#f8fafc; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0; margin-bottom:0.25rem;">
                                                    <div style="background:#1e293b; padding:0.25rem 0.5rem; display:flex; justify-content:space-between; align-items:center;">
                                                        <span style="color:#94a3b8; font-size:0.7rem; text-transform:uppercase; font-weight:700;">
                                                            <span style="color:#60a5fa;">${topTopicName}</span> <span style="font-weight:400; opacity:0.7;">// ${macroKey.toUpperCase()}</span>
                                                        </span>
                                                    </div>
                                                    
                                                    <div style="padding:0.4rem; display:flex; flex-direction:column; gap:0.3rem;">
                                                        ${(tacticData.threats || []).map(threat => `
                                                            <div style="border-bottom:1px dashed #cbd5e1; padding-bottom:0.3rem; last-child:border-bottom:0; last-child:padding-bottom:0;">
                                                                <div style="margin-bottom:0.15rem;">
                                                                    <div style="font-size:0.65rem; color:#64748b; font-weight:600; text-transform:uppercase; margin-bottom:0.1rem;">
                                                                        Movimiento [${threat.source}]
                                                                    </div>
                                                                    <div style="font-size:0.8rem; font-weight:700; color:#dc2626; line-height:1.1;">
                                                                        "${threat.move}"
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div style="font-size:0.65rem; color:#166534; font-weight:600; text-transform:uppercase; margin-bottom:0.1rem;">
                                                                        Respuesta
                                                                    </div>
                                                                    <div style="font-size:0.8rem; font-weight:600; color:#15803d; line-height:1.1;">
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

            // Attach Listeners
            document.getElementById('export-global-btn').addEventListener('click', () => exportSection('section-global', 'export-global-btn'));
            document.getElementById('export-tactical-btn').addEventListener('click', () => exportSection('section-tactical', 'export-tactical-btn'));

        } catch (e) {
            console.error(e);
            container.innerHTML = `<p class="center-msg" style="color:red">Error generando resumen: ${e.message}</p>`;
        }
    }
});
