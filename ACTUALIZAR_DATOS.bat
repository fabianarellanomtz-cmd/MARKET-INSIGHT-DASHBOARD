@echo off
REM Script para actualizar la base de datos del Dashboard desde un CSV
REM Simplemente coloca tu archivo .csv en esta carpeta y ejecuta este script.

echo Buscando archivos CSV en la carpeta actual...

powershell -ExecutionPolicy Bypass -Command "& {
    $ErrorActionPreference = 'Stop'
    try {
        # Buscar el archivo CSV mas reciente en la carpeta actual
        $csvFile = Get-ChildItem -Path . -Filter *.csv | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        
        if (-not $csvFile) {
            Write-Host 'ERROR: No se encontro ningun archivo .csv en esta carpeta.' -ForegroundColor Red
            Write-Host 'Por favor, copia tu archivo Excel/CSV aqui e intenta de nuevo.'
            exit 1
        }
        
        Write-Host 'Archivo encontrado:' $csvFile.Name -ForegroundColor Cyan
        
        # Leer el contenido (Intentar UTF8 primero, luego Default si falla)
        try {
            $data = Import-Csv -Path $csvFile.FullName -Encoding UTF8
        } catch {
            Write-Host 'Advertencia: Fallo lectura UTF-8, intentando codificacion estandar...' -ForegroundColor Yellow
            $data = Import-Csv -Path $csvFile.FullName -Encoding Default
        }

        if (-not $data) {
            Throw 'El archivo CSV parece estar vacio o no tiene el formato correcto.'
        }
        
        # Convertir a JSON
        $json = $data | ConvertTo-Json -Depth 5 -Compress
        
        # Crear contenido JS
        $jsContent = 'const PRELOADED_DATA = ' + $json + ';'
        
        # Guardar en data.js
        Set-Content -Path 'data.js' -Value $jsContent -Encoding UTF8
        
        Write-Host 'EXITO! La base de datos (data.js) ha sido actualizada.' -ForegroundColor Green
    } catch {
        Write-Host 'Error durante la actualizacion:' $_ -ForegroundColor Red
        exit 1
    }
}"

pause
