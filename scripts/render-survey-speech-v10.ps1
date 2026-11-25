param([Parameter(Mandatory=$true)][string]$Manifest,[Parameter(Mandatory=$true)][string]$OutputFolder)
$ErrorActionPreference='Stop'
$entries=Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
$voice=New-Object -ComObject SAPI.SpVoice
foreach ($line in $entries) {
    $token=New-Object -ComObject SAPI.SpObjectToken
    $spirit=$line.role -eq 'spirit'
    $name=if($spirit){'Yaoyao'}else{'Kangkang'}
    $token.SetId('HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Speech_OneCore\Voices\Tokens\MSTTS_V110_zhCN_'+$name+'M')
    $voice.Voice=$token
    $voice.Rate=if($spirit){0}else{-1}
    $voice.Volume=95
    $file=New-Object -ComObject SAPI.SpFileStream
    $file.Format.Type=22
    $file.Open((Join-Path $OutputFolder ($line.id+'.wav')),3,$false)
    try {
        $voice.AudioOutputStream=$file
        $spoken=([string]$line.text).Replace('烁羽','朔羽')
        $escaped=[Security.SecurityElement]::Escape($spoken)
        $pitch=if($spirit){'+1'}else{'-1'}
        $xml='<pitch absmiddle="'+$pitch+'">'+$escaped+'</pitch>'
        [void]$voice.Speak($xml,8)
    } finally {
        $file.Close()
    }
}
