# ============================================================================
#  AbridGO — Génération des icônes de l'app mobile à partir du logo complet
#  Tourne en local (Windows PowerShell). Aucune dépendance : utilise System.Drawing.
#
#  Usage (depuis D:\projects\EpeceriGo\front\epiceriego-app) :
#     powershell -ExecutionPolicy Bypass -File .\generate-icons.ps1
# ============================================================================

# --- Paramètres (à adapter si besoin) --------------------------------------
$Src    = "C:\Users\Administrateur\Desktop\bureau1\logo\logo_app_3.png"
$Assets = "D:\projects\EpeceriGo\front\epiceriego-app\assets\images"
$BgHex  = "#FFFFFF"   # fond des icônes carrées (blanc)

# ---------------------------------------------------------------------------
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Src))    { Write-Error "Logo introuvable : $Src"; exit 1 }
if (-not (Test-Path $Assets)) { Write-Error "Dossier assets introuvable : $Assets"; exit 1 }

$bgColor = [System.Drawing.ColorTranslator]::FromHtml($BgHex)
$src = New-Object System.Drawing.Bitmap ([System.Drawing.Image]::FromFile($Src))
Write-Host "Logo chargé : $($src.Width) x $($src.Height)"

# --- Rogne le fond (transparent OU quasi-blanc) pour bien centrer -----------
function Get-Trimmed([System.Drawing.Bitmap]$bmp) {
    $minX = $bmp.Width; $minY = $bmp.Height; $maxX = -1; $maxY = -1
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $p = $bmp.GetPixel($x, $y)
            $bg = ($p.A -lt 10) -or ($p.R -gt 245 -and $p.G -gt 245 -and $p.B -gt 245)
            if (-not $bg) {
                if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    if ($maxX -lt 0) { return $bmp }  # image vide -> renvoie tel quel
    $rect = New-Object System.Drawing.Rectangle $minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1)
    return $bmp.Clone($rect, $bmp.PixelFormat)
}

$logo = Get-Trimmed $src
Write-Host "Logo rogné : $($logo.Width) x $($logo.Height)"

# --- Compose le logo centré sur un canevas carré ----------------------------
function New-Icon([int]$size, $bg, [double]$widthFrac) {
    $canvas = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    if ($bg) { $g.Clear($bg) } else { $g.Clear([System.Drawing.Color]::Transparent) }

    $tw = [int]($size * $widthFrac)
    $th = [int]($tw * $logo.Height / $logo.Width)
    $maxH = [int]($size * $widthFrac)
    if ($th -gt $maxH) { $th = $maxH; $tw = [int]($th * $logo.Width / $logo.Height) }
    $x = [int](($size - $tw) / 2); $y = [int](($size - $th) / 2)
    $g.DrawImage($logo, $x, $y, $tw, $th)
    $g.Dispose()
    return $canvas
}

# --- Silhouette monochrome (Android 13+ themed icon) ------------------------
function New-Monochrome([int]$size, [double]$widthFrac) {
    $sil = New-Object System.Drawing.Bitmap $logo.Width, $logo.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($y = 0; $y -lt $logo.Height; $y++) {
        for ($x = 0; $x -lt $logo.Width; $x++) {
            $p = $logo.GetPixel($x, $y)
            $bg = ($p.A -lt 40) -or ($p.R -gt 245 -and $p.G -gt 245 -and $p.B -gt 245)
            if ($bg) { $sil.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0,0,0,0)) }
            else     { $sil.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A,60,60,60)) }
        }
    }
    $saveLogo = $script:logo; $script:logo = $sil
    $out = New-Icon $size $null $widthFrac
    $script:logo = $saveLogo
    $sil.Dispose()
    return $out
}

function Save-Png($bmp, [string]$name) {
    $path = Join-Path $Assets $name
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "  OK  $name"
}

Write-Host "Génération..."
Save-Png (New-Icon 1024 $bgColor 0.86)                 "icon.png"                     # iOS + notifications (fond blanc)
Save-Png (New-Icon 1024 $null 0.62)                    "android-icon-foreground.png"  # Android adaptatif (zone sûre)
Save-Png (New-Icon 1024 $bgColor 1.0)                  "android-icon-background.png"  # fond blanc plein
Save-Png (New-Monochrome 1024 0.62)                    "android-icon-monochrome.png"  # themed icon (silhouette)
Save-Png (New-Icon 196  $bgColor 0.86)                 "favicon.png"                  # web
Save-Png (New-Icon 1024 $null 0.90)                    "splash-icon.png"              # écran de démarrage

$logo.Dispose(); $src.Dispose()
Write-Host "`nTermine. Icones ecrites dans : $Assets" -ForegroundColor Green
Write-Host "Ensuite : cd D:\projects\EpeceriGo\front\epiceriego-app ; npx expo prebuild --clean" -ForegroundColor Yellow
