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
                        a.macro = determineMacroCategory(a.topic);
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
                    <div class="insight-card mesh-header-bg" style="border-top: none; padding: 3rem 2rem;">
                        <div style="text-align:center; margin-bottom:2rem;">
                            <h2 style="color:white; margin-bottom:0.5rem; font-size: 2.2rem; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${ANALYSIS_DATA.title}</h2>
                            <p style="color:rgba(255,255,255,0.9);">Generado por Market Insights AI • ${new Date().toLocaleDateString()}</p>
                        </div>

                        <!-- NEW HERO SUMMARY DESIGN -->
                        <div class="glass-panel" style="padding:0; border-radius:16px; margin-bottom:2.5rem; border:none; overflow:hidden; display:flex; flex-direction:row; background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(240,249,255,0.95) 100%); box-shadow: 0 10px 40px -10px rgba(37,99,235,0.2);">
                            
                            <!-- Left: Text Content -->
                            <div style="flex: 1.2; padding:3rem; display:flex; flex-direction:column; justify-content:center; position:relative; z-index:2;">
                                <h3 style="margin-top:0; margin-bottom:1.5rem; font-size:2rem; font-weight:800; line-height:1.2; letter-spacing:-0.03em; color:#2563eb;">
                                    ${ANALYSIS_DATA.summary_title}
                                </h3>
                                    ${ANALYSIS_DATA.summary_body}
                                </div>
                            </div>

                            <!-- Right: Visual "5-Force Ecosystem" (Based on Ref Image) -->
                            <div style="flex: 1.5; position:relative; display:flex; align-items:center; justify-content:center; background: radial-gradient(circle at center, #f8fafc 0%, #e2e8f0 100%); overflow:hidden;">
                                
                                <!-- Background Glow & Texture -->
                                <div style="position:absolute; inset:0; pointer-events:none;">
                                    <div style="position:absolute; top:-20%; right:-20%; width:60%; height:60%; background:radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%); filter:blur(40px);"></div>
                                    <div style="position:absolute; bottom:-10%; left:-10%; width:50%; height:50%; background:radial-gradient(circle, rgba(236,72,153,0.05) 0%, transparent 70%); filter:blur(40px);"></div>
                                </div>

                                <!-- The Integrated System Container -->
                                <div style="position:relative; width:450px; height:320px; display:flex; align-items:center; justify-content:center;">
                                    
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
                                    <div class="glass-card-hover" style="position:absolute; bottom:15%; left:5%; z-index:5; display:flex; flex-direction:column; align-items:center;">
                                        <div style="width:50px; height:50px; background:rgba(255,255,255,0.9); border-radius:14px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(59,130,246,0.15); border:1px solid #dbeafe; margin-bottom:4px;">
                                            <i class="fa-solid fa-microscope" style="font-size:1.2rem; color:#2563eb;"></i>
                                        </div>
                                        <div style="font-size:0.65rem; font-weight:700; color:#1e1b4b; background:white; padding:2px 8px; border-radius:10px; border:1px solid #e2e8f0;">CIENCIA</div>
                                        <div style="font-size:0.55rem; color:#64748b;">(Biotech)</div>
                                    </div>

                                    <!-- 2. SALUD (Wellness) - Top Left -->
                                    <div class="glass-card-hover" style="position:absolute; top:20%; left:12%; z-index:5; display:flex; flex-direction:column; align-items:center;">
                                        <div style="width:50px; height:50px; background:rgba(255,255,255,0.9); border-radius:14px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(34,197,94,0.15); border:1px solid #dcfce7; margin-bottom:4px;">
                                            <i class="fa-solid fa-leaf" style="font-size:1.2rem; color:#16a34a;"></i>
                                        </div>
                                        <div style="font-size:0.65rem; font-weight:700; color:#1e1b4b; background:white; padding:2px 8px; border-radius:10px; border:1px solid #e2e8f0;">SALUD</div>
                                        <div style="font-size:0.55rem; color:#64748b;">(Wellness)</div>
                                    </div>

                                    <!-- 3. NEGOCIO (Smart Capital) - Top Center -->
                                    <div class="glass-card-hover" style="position:absolute; top:5%; left:50%; transform:translateX(-50%); z-index:5; display:flex; flex-direction:column; align-items:center;">
                                        <div style="width:50px; height:50px; background:rgba(255,255,255,0.9); border-radius:14px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(147,51,234,0.15); border:1px solid #f3e8ff; margin-bottom:4px;">
                                            <i class="fa-solid fa-chart-line" style="font-size:1.2rem; color:#9333ea;"></i>
                                        </div>
                                        <div style="font-size:0.65rem; font-weight:700; color:#1e1b4b; background:white; padding:2px 8px; border-radius:10px; border:1px solid #e2e8f0;">NEGOCIO</div>
                                        <div style="font-size:0.55rem; color:#64748b;">(Smart Capital)</div>
                                    </div>

                                    <!-- 4. RETAIL (Omnicanal) - Top Right -->
                                    <div class="glass-card-hover" style="position:absolute; top:20%; right:12%; z-index:5; display:flex; flex-direction:column; align-items:center;">
                                        <div style="width:50px; height:50px; background:rgba(255,255,255,0.9); border-radius:14px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(249,115,22,0.15); border:1px solid #ffedd5; margin-bottom:4px;">
                                            <i class="fa-solid fa-shop" style="font-size:1.2rem; color:#ea580c;"></i>
                                        </div>
                                        <div style="font-size:0.65rem; font-weight:700; color:#1e1b4b; background:white; padding:2px 8px; border-radius:10px; border:1px solid #e2e8f0;">RETAIL</div>
                                        <div style="font-size:0.55rem; color:#64748b;">(Omnicanal)</div>
                                    </div>

                                    <!-- 5. CULTURA (Autenticidad) - Bottom Right -->
                                    <div class="glass-card-hover" style="position:absolute; bottom:15%; right:5%; z-index:5; display:flex; flex-direction:column; align-items:center;">
                                        <div style="width:50px; height:50px; background:rgba(255,255,255,0.9); border-radius:14px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(236,72,153,0.15); border:1px solid #fce7f3; margin-bottom:4px;">
                                            <i class="fa-regular fa-comments" style="font-size:1.2rem; color:#db2777;"></i>
                                        </div>
                                        <div style="font-size:0.65rem; font-weight:700; color:#1e1b4b; background:white; padding:2px 8px; border-radius:10px; border:1px solid #e2e8f0;">CULTURA</div>
                                        <div style="font-size:0.55rem; color:#64748b;">(Autenticidad)</div>
                                    </div>

                                </div>
                            </div>
                        </div>

                        <!-- Global Strategic Insights -->
                        <div style="margin-bottom: 2.5rem;">
                            <div class="mesh-section-title">
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

                        <!-- 5 Macro Categories Grid (SIDE BY SIDE ALIGNMENT) -->
                        <!-- 5 Macro Categories Grid (SIDE BY SIDE ALIGNMENT) -->
                        <!-- 3-Column Header -->
                        <div style="display:grid; grid-template-columns: 1.6fr 1.1fr 0.9fr; gap:1.5rem; margin-bottom: 1.5rem; align-items:center;">
                             <div class="mesh-section-title" style="margin:0; text-align:center;">
                                <i class="fa-solid fa-layer-group"></i> Macro-Tendencias
                            </div>
                            <div class="mesh-section-title" style="margin:0; text-align:center; background: linear-gradient(135deg, #be185d 0%, #9d174d 100%);">
                                <i class="fa-solid fa-scale-balanced"></i> Matriz de Impacto
                            </div>
                            <div class="mesh-section-title" style="margin:0; text-align:center; background: linear-gradient(135deg, #059669 0%, #047857 100%);">
                                <i class="fa-solid fa-chess"></i> Estrategia & KPIs
                            </div>
                        </div>
                        
                        <div style="display:flex; flex-direction:column; gap:1.5rem;">
                            ${ANALYSIS_DATA.macro_focus.map((m, index) => `
                                <div class="glass-panel glass-card-hover" style="display:grid; grid-template-columns: 1.6fr 1.1fr 0.9fr; gap:1.5rem; align-items:stretch; padding:1.5rem; border-radius:12px;">
                                    
                                    <!-- COL 1: Trend Content -->
                                    <div style="display:flex; flex-direction:column;">
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
                                    <div style="display:flex; flex-direction:column; gap:0.8rem; border-left:1px dashed #9ca3af; padding-left:1.5rem; justify-content:center;">
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
                                    <div style="display:flex; flex-direction:column; gap:1.5rem; border-left:1px dashed #9ca3af; padding-left:1.5rem; justify-content:center;">
                                        
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
                <div id="section-tactical" style="background:#f3f4f6; padding:1rem; border-radius:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h2 style="margin:0; color:#1f2937; font-size:1.4rem;">TRENDING TOPICS</h2>
                        <button id="export-tactical-btn" class="action-btn-small" style="background:#be185d; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">
                            <i class="fa-solid fa-crosshairs"></i> Exportar Tablero Táctico
                        </button>
                    </div>

                    <div class="dashboard-row">
                        <!-- Top News per Topic (Left Column) -->
                        <div class="stat-box">
                            <h3 style="margin-bottom:1rem; color:#4b5563; text-transform:uppercase; font-size:0.85rem; letter-spacing:0.05em;">NOTICIAS RELEVANTES</h3>
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
                                <span><i class="fa-solid fa-binoculars"></i> COMPETITIVE PLAYBOOK</span>
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
                                                        <span style="color:#ffffff; font-size:0.7rem; text-transform:uppercase; font-weight:700;">
                                                            <span style="color:#ffffff;">${topTopicName}</span> <span style="font-weight:400; opacity:0.8; color:#e2e8f0;">// ${macroKey.toUpperCase()}</span>
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
