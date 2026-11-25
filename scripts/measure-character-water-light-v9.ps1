Add-Type -AssemblyName System.Drawing
$result = [ordered]@{ at = [DateTime]::UtcNow.ToString('o'); method = 'Read-only PNG analysis. Fixed 400x390 screen rectangle (520,270) containing the bird in paired frozen underwater views; includes unchanged background. Display-referred luminance, not HDR radiance or a character segmentation.'; cases = @() }
foreach ($view in @('diving', 'diving-side', 'diving-front')) {
  foreach ($variant in @('legacy', 'baseline')) {
    $file = "docs/v9/character/water-light/final-angles/$view-$variant.png"
    $bitmap = [System.Drawing.Bitmap]::new((Resolve-Path -LiteralPath $file).Path)
    try {
      $bright = 0; $nearWhite = 0; $total = 0.0; $maximum = 0.0
      for ($y = 270; $y -lt 660; $y++) {
        for ($x = 520; $x -lt 920; $x++) {
          $pixel = $bitmap.GetPixel($x, $y)
          $luma = (.2126 * $pixel.R + .7152 * $pixel.G + .0722 * $pixel.B) / 255
          $total += $luma
          if ($luma -gt $maximum) { $maximum = $luma }
          if ($luma -gt .8) { $bright++ }
          if ($pixel.R -gt 235 -and $pixel.G -gt 235 -and $pixel.B -gt 235) { $nearWhite++ }
        }
      }
      $result.cases += [ordered]@{ view=$view; variant=$variant; roi=@(520,270,400,390); pixels=156000; abovePoint8=$bright; nearWhite=$nearWhite; maximum=$maximum; average=$total/156000 }
    } finally { $bitmap.Dispose() }
  }
}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath docs/v9/character/water-light/pixel-analysis.json -Encoding utf8
$result.cases | ForEach-Object { [pscustomobject]$_ } | Format-Table view,variant,abovePoint8,nearWhite,maximum,average
