
$csvPath = ".\temp.csv"
$jsPath = "C:\Users\Fabian Arellano\.gemini\antigravity\brain\6ceee79c-7312-4d81-b731-c5625f331605\NewsDashboard\data.js"

if (-not (Test-Path -LiteralPath $csvPath)) {
    Write-Host "Error: CSV file not found at $csvPath"
    exit 1
}

try {
    # Import CSV. Default encoding usually handles Windows ANSI/UTF-8 with BOM well.
    $data = Import-Csv -LiteralPath $csvPath -Delimiter "," 
    
    if ($data.Count -eq 0) {
        Write-Host "Error: No data read from CSV"
        exit 1
    }

    # Filter valid rows
    $filteredData = $data | Where-Object { ![string]::IsNullOrWhiteSpace($_.URL) }
    
    # Convert to JSON
    $json = $filteredData | ConvertTo-Json -Depth 10

    $jsContent = "const PRELOADED_DATA = $json;"

    # Write to data.js with UTF8 encoding
    $jsContent | Set-Content -LiteralPath $jsPath -Encoding UTF8

    Write-Host "Successfully updated data.js with $($filteredData.Count) records."
}
catch {
    Write-Host "Error updating data: $_"
    exit 1
}
