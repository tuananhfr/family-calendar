param([switch]$InitializeSigningKey)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolRoot = Join-Path $repoRoot '.cache\android'
$privateDir = Join-Path $env:USERPROFILE '.family-calendar\android-signing'
$privateConfig = Join-Path $privateDir 'signing.json'
$keyStore = Join-Path $privateDir 'release.p12'
$downloadDir = Join-Path $repoRoot 'frontend\public\downloads'
$jdkDirectory = Get-ChildItem -LiteralPath (Join-Path $toolRoot 'jdk') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if (!$jdkDirectory) { throw 'Run scripts/build-android.ps1 -Bootstrap -AcceptSdkLicenses to prepare the Android toolchain first.' }
$env:JAVA_HOME = $jdkDirectory.FullName
$keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'

if (!(Test-Path -LiteralPath $privateConfig)) {
    if (Test-Path -LiteralPath $keyStore) { throw 'Keystore exists without signing.json. Restore its original config; do not generate a replacement.' }
    if (!$InitializeSigningKey) { throw 'Restore your user-profile .family-calendar/android-signing backup, or use -InitializeSigningKey for the first release only.' }
    if (Test-Path -LiteralPath (Join-Path $downloadDir 'android-release.json')) { throw 'A release was already published. Restore its signing key from backup.' }
    New-Item -ItemType Directory -Force -Path $privateDir | Out-Null
    $passwordBytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($passwordBytes) } finally { $generator.Dispose() }
    $password = [Convert]::ToBase64String($passwordBytes)
    $settings = [pscustomobject]@{ alias = 'family-calendar-release'; storePassword = $password; keyPassword = $password }
    $env:FC_ANDROID_STORE_PASSWORD = $password
    $env:FC_ANDROID_KEY_PASSWORD = $password
    & $keytool -genkeypair -noprompt -storetype PKCS12 -keystore $keyStore -alias $settings.alias -keyalg RSA -keysize 3072 -validity 36500 -dname 'CN=Lich Gia Dinh Android, OU=Screen Time, O=Family Calendar, C=VN' -storepass:env FC_ANDROID_STORE_PASSWORD -keypass:env FC_ANDROID_KEY_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Could not generate release signing key.' }
    [IO.File]::WriteAllText($privateConfig, ($settings | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    Write-Output 'Created private signing key in your user profile under .family-calendar/android-signing, outside the web directory. Back it up securely.'
}
if (!(Test-Path -LiteralPath $keyStore)) { throw 'Release key is missing. Restore your user-profile .family-calendar/android-signing backup.' }
$settings = Get-Content -LiteralPath $privateConfig -Raw | ConvertFrom-Json
$env:FC_ANDROID_KEYSTORE = $keyStore
$env:FC_ANDROID_STORE_PASSWORD = $settings.storePassword
$env:FC_ANDROID_KEY_ALIAS = $settings.alias
$env:FC_ANDROID_KEY_PASSWORD = $settings.keyPassword
try {
    & (Join-Path $PSScriptRoot 'build-android.ps1') -Variant Release
    $apk = Join-Path $repoRoot 'android\app\build\outputs\apk\release\app-release.apk'
    if (!(Test-Path -LiteralPath $apk)) { throw 'Signed release APK was not produced.' }
    $tools = Join-Path $toolRoot 'sdk\build-tools\35.0.0'
    $signature = @(& (Join-Path $tools 'apksigner.bat') verify --verbose --print-certs $apk)
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    $certLine = $signature | Where-Object { $_ -match '^Signer #1 certificate SHA-256 digest: ' } | Select-Object -First 1
    if (!$certLine) { throw 'Signing certificate fingerprint was not returned.' }
    $certificate = ($certLine -replace '^Signer #1 certificate SHA-256 digest: ', '').Trim().ToLowerInvariant()
    $badging = @(& (Join-Path $tools 'aapt.exe') dump badging $apk)
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect APK metadata.' }
    $packageLine = ($badging | Where-Object { $_ -match '^package: ' } | Select-Object -First 1)
    $packageMatch = [regex]::Match($packageLine, "name='vn.lichgiadinh.screentime' versionCode='(\d+)' versionName='([^']+)'")
    if (!$packageMatch.Success -or ($badging -match '^application-debuggable') -or !($badging -contains "sdkVersion:'29'")) { throw 'APK must be a non-debuggable production package supporting Android 10.' }
    $versionCode = [int]$packageMatch.Groups[1].Value
    $versionName = $packageMatch.Groups[2].Value
    $digest = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
    $manifestPath = Join-Path $downloadDir 'android-release.json'
    if (Test-Path -LiteralPath $manifestPath) {
        $previous = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        if ($previous.signingCertificateSha256 -ne $certificate) { throw 'Signing certificate changed. Restore the original key so existing users can update.' }
        if ($previous.sha256 -ne $digest -and $versionCode -le $previous.versionCode) { throw 'Increase versionCode in android/app/build.gradle before publishing a changed APK.' }
    }
    New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
    Copy-Item -LiteralPath $apk -Destination (Join-Path $downloadDir 'lich-gia-dinh-screen-time.apk') -Force
    $manifest = [ordered]@{
        applicationId = 'vn.lichgiadinh.screentime'; buildType = 'release'; versionName = $versionName; versionCode = $versionCode
        minAndroid = '10'; fileName = 'lich-gia-dinh-screen-time.apk'; bytes = (Get-Item -LiteralPath $apk).Length
        sha256 = $digest; signingCertificateSha256 = $certificate
    }
    [IO.File]::WriteAllText($manifestPath, (($manifest | ConvertTo-Json) + "`n"), (New-Object Text.UTF8Encoding($false)))
    & node (Join-Path $repoRoot 'frontend\scripts\verify-android-download.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Published APK integrity check failed.' }
    Write-Output "Published signed Android release $versionName (code $versionCode) into frontend/public/downloads."
} finally {
    Remove-Item Env:FC_ANDROID_KEYSTORE, Env:FC_ANDROID_STORE_PASSWORD, Env:FC_ANDROID_KEY_ALIAS, Env:FC_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
}
