# Market Insights Dashboard 📊

Dashboard de inteligencia de mercado diseñado para visualizar tendencias, noticias estratégicas y movimientos de la competencia.

## 🚀 Cómo actualizar el Dashboard

Este dashboard es **dinámico**. Para actualizar la información, no necesitas tocar el código. Solo sigue estos pasos:

1.  **Prepara tu Excel:**
    *   Asegúrate de tener el archivo `ARTÍCULOS.xlsx` (o `.csv` convertida) con las columnas correctas: `Titulo`, `Resumen`, `Link`, `Topic`, `Macro`, `Año`, `Mes`.
2.  **Sube el archivo a GitHub:**
    *   Ve a tu repositorio en GitHub.
    *   Haz clic en "Add file" > "Upload files".
    *   Arrastra tu `ARTÍCULOS.xlsx` actualizado.
    *   Haz clic en "Commit changes".
3.  **¡Listo!**
    *   Espera unos 30-60 segundos.
    *   Recarga tu página web (GitHub Pages). La nueva información aparecerá automáticamente.

## 📂 Estructura del Proyecto

*   `index.html`: Estructura principal y diseño del tablero.
*   `style.css`: Estilos visuales (colores, diseño responsive).
*   `app.js`: El "cerebro" del dashboard. Contiene:
    *   Lógica de lectura de Excel.
    *   Base de datos de Análisis Estratégico (`ANALYSIS_DB`).
    *   Filtros y generación de gráficos.
*   `ARTÍCULOS.xlsx`: Tu base de datos de noticias.

## 🛠️ Mantenimiento

Si necesitas cambiar los textos del "Reporte Estratégico Integral" (el análisis de texto a la derecha), deberás editar la sección `ANALYSIS_DB` dentro del archivo `app.js`.
