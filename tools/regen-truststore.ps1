# Regenerates android/proxy-cacerts.p12 from the current Windows root cert store.
# Needed because this machine has HTTPS inspection (a private root CA) and the Android
# Studio JBR can't read the Windows cert store directly. Run when dependency downloads
# start failing with SSL/PKIX errors after the machine's trusted roots change.
#
# Usage (from the repo root):  powershell -File tools/regen-truststore.ps1

$ErrorActionPreference = "Stop"
$jbr = $env:JAVA_HOME
if (-not $jbr -or -not (Test-Path "$jbr\bin\java.exe")) {
  $jbr = "C:\Program Files\Android\Android Studio1\jbr"
}
$root = Split-Path $PSScriptRoot -Parent
$pem  = Join-Path $env:TEMP ("roots-" + [guid]::NewGuid().ToString() + ".pem")
$dst  = Join-Path $root "android\proxy-cacerts.p12"

# 1. Export every trusted root from the Windows cert store to one PEM bundle.
$lines = New-Object System.Collections.Generic.List[string]
Get-ChildItem Cert:\LocalMachine\Root, Cert:\CurrentUser\Root -ErrorAction SilentlyContinue | ForEach-Object {
  $lines.Add("-----BEGIN CERTIFICATE-----")
  $lines.Add([Convert]::ToBase64String($_.RawData, 'InsertLineBreaks'))
  $lines.Add("-----END CERTIFICATE-----")
}
Set-Content -Path $pem -Value $lines -Encoding ascii

# 2. Compile + run the builder with the JBR to produce a real PKCS12 truststore.
& "$jbr\bin\javac.exe" (Join-Path $PSScriptRoot "BuildTruststore.java")
& "$jbr\bin\java.exe" -cp $PSScriptRoot BuildTruststore $pem $dst
Write-Output "Truststore written to $dst"
