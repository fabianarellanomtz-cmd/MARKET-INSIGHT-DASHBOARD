
Add-Type -AssemblyName System.Drawing

# Get all relevant background images
$files = @(Get-ChildItem -Path . -Filter "bg_*.png")
$files += @(Get-ChildItem -Path . -Filter "background*.png")

if ($files.Count -eq 0) {
    Write-Host "No images found to optimize."
    exit
}

Write-Host "Found $($files.Count) images to optimize."

foreach ($file in $files) {
    # Skip if .jpg already exists and is significant size (simple check)
    $newName = $file.Name -replace '\.png$', '.jpg'
    $newPath = Join-Path $file.DirectoryName $newName
    
    try {
        Write-Host "Optimizing $($file.Name)..."
        
        # Load Image
        $img = [System.Drawing.Image]::FromFile($file.FullName)
        
        # Find Encoder
        $encodeParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encodeParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 75)
        
        $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

        if (-not $jpegCodec) {
            Write-Error "JPEG Codec not found."
            continue
        }

        # Save
        $img.Save($newPath, $jpegCodec, $encodeParams)
        $img.Dispose()
        
        # Verify
        if (Test-Path $newPath) {
            $oldSize = (Get-Item $file.FullName).Length
            $newSize = (Get-Item $newPath).Length
            $reduction = [math]::Round((($oldSize - $newSize) / $oldSize) * 100, 1)
            Write-Host "  -> Created $newName : $([math]::Round($newSize/1KB, 0)) KB (Reduced by $reduction%)"
        }
        
    }
    catch {
        Write-Error "Failed to optimize $($file.Name): $_"
    }
}

Write-Host "Optimization Complete."
