param([switch]$Bootstrap, [switch]$AcceptSdkLicenses, [ValidateSet('Debug', 'Release')][string]$Variant = 'Debug')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolRoot = Join-Path $repoRoot '.cache\android'
New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null

function Get-VerifiedArchive([string]$Url, [string]$Destination, [string]$Hash, [string]$Algorithm = 'SHA256') {
    $valid = (Test-Path -LiteralPath $Destination) -and ((Get-FileHash -LiteralPath $Destination -Algorithm $Algorithm).Hash -eq $Hash.Trim())
    if (!$valid) {
        & curl.exe --fail --location --silent --show-error --max-time 600 --output $Destination $Url
        if ($LASTEXITCODE -ne 0) { throw "Download failed: $Url" }
    }
    if ((Get-FileHash -LiteralPath $Destination -Algorithm $Algorithm).Hash -ne $Hash.Trim()) {
        throw "Checksum mismatch: $Destination"
    }
}

if ($Bootstrap) {
    if (!(Test-Path -LiteralPath (Join-Path $toolRoot 'jdk'))) {
        Write-Output 'Downloading verified Temurin JDK 17...'
        $jdkAsset = @(Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse')[0]
        $jdkZip = Join-Path $toolRoot 'jdk.zip'
        Get-VerifiedArchive $jdkAsset.binary.package.link $jdkZip $jdkAsset.binary.package.checksum
        Expand-Archive -LiteralPath $jdkZip -DestinationPath (Join-Path $toolRoot 'jdk') -Force
    }
    if (!(Test-Path -LiteralPath (Join-Path $toolRoot 'gradle-8.11.1\bin\gradle.bat'))) {
        Write-Output 'Downloading verified Gradle 8.11.1...'
        $gradleUrl = 'https://services.gradle.org/distributions/gradle-8.11.1-bin.zip'
        $gradleHash = (& curl.exe --fail --location --silent --show-error --max-time 60 "$gradleUrl.sha256") -join ''
        $gradleZip = Join-Path $toolRoot 'gradle.zip'
        Get-VerifiedArchive $gradleUrl $gradleZip $gradleHash
        Expand-Archive -LiteralPath $gradleZip -DestinationPath $toolRoot -Force
    }
    if (!(Test-Path -LiteralPath (Join-Path $toolRoot 'cli19\cmdline-tools\bin\sdkmanager.bat'))) {
        Write-Output 'Downloading verified Android command-line tools...'
        [xml]$sdkRepo = ((& curl.exe --fail --location --silent --show-error --max-time 60 'https://dl.google.com/android/repository/repository2-1.xml') -join "`n")
        $sdkPackage = $sdkRepo.SelectSingleNode("//*[local-name()='remotePackage' and @path='cmdline-tools;19.0']")
        $sdkArchive = $sdkPackage.SelectSingleNode(".//*[local-name()='archive'][*[local-name()='host-os' and text()='windows']]")
        $sdkUrl = $sdkArchive.SelectSingleNode(".//*[local-name()='url']").InnerText
        $sdkChecksum = $sdkArchive.SelectSingleNode(".//*[local-name()='checksum']")
        $sdkZip = Join-Path $toolRoot 'cli19.zip'
        if (!$sdkUrl -or !$sdkChecksum.InnerText) { throw 'Android repository metadata has no Windows CLI archive/checksum.' }
        $sdkHashAlgorithm = if ($sdkChecksum.InnerText.Length -eq 40) { 'SHA1' } else { 'SHA256' }
        Get-VerifiedArchive "https://dl.google.com/android/repository/$sdkUrl" $sdkZip $sdkChecksum.InnerText $sdkHashAlgorithm
        Expand-Archive -LiteralPath $sdkZip -DestinationPath (Join-Path $toolRoot 'cli19') -Force
    }
}

$jdkDirectory = Get-ChildItem -LiteralPath (Join-Path $toolRoot 'jdk') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jdkDirectory) { $env:JAVA_HOME = $jdkDirectory.FullName }
$gradleCommand = Join-Path $toolRoot 'gradle-8.11.1\bin\gradle.bat'
if (!(Test-Path -LiteralPath $gradleCommand)) {
    $installedGradle = Get-Command gradle -ErrorAction SilentlyContinue
    if (!$installedGradle) { throw 'Install JDK 17 / Gradle 8.11.1 / Android SDK, or run with -Bootstrap.' }
    $gradleCommand = $installedGradle.Source
}
if ($Bootstrap) {
    $env:ANDROID_HOME = Join-Path $toolRoot 'sdk'
    $sdkManager = Join-Path $toolRoot 'cli19\cmdline-tools\bin\sdkmanager.bat'
    if ($AcceptSdkLicenses) {
        $ErrorActionPreference = 'Continue'
        1..100 | ForEach-Object { 'y' } | & $sdkManager "--sdk_root=$env:ANDROID_HOME" --licenses *> (Join-Path $toolRoot 'sdk-licenses.log')
        $ErrorActionPreference = 'Stop'
        if ($LASTEXITCODE -ne 0) { throw 'Android SDK license setup failed.' }
    }
    Write-Output 'Installing Android SDK 35...'
    $ErrorActionPreference = 'Continue'
    & $sdkManager "--sdk_root=$env:ANDROID_HOME" 'platforms;android-35' 'build-tools;35.0.0' 'platform-tools' *> (Join-Path $toolRoot 'sdk-install.log')
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw 'Android SDK installation failed. Review SDK terms and use -AcceptSdkLicenses if appropriate.' }
}
if (!$Bootstrap -and (Test-Path -LiteralPath (Join-Path $toolRoot 'sdk'))) {
    $env:ANDROID_HOME = Join-Path $toolRoot 'sdk'
}
$env:GRADLE_USER_HOME = Join-Path $toolRoot 'gradle-home'
$env:ANDROID_USER_HOME = Join-Path $toolRoot 'user-home'
New-Item -ItemType Directory -Force -Path $env:ANDROID_USER_HOME | Out-Null
$tasks = if ($Variant -eq 'Release') { @('testReleaseUnitTest', 'lintRelease', 'assembleRelease') } else { @('testDebugUnitTest', 'lintDebug', 'assembleDebug') }
# Do not serialize release signing credentials into the project's configuration cache.
[string[]]$cacheOptions = @()
if ($Variant -eq 'Release') { $cacheOptions = @('--no-configuration-cache') }
& $gradleCommand -p (Join-Path $repoRoot 'android') --no-daemon --console=plain --max-workers=2 @cacheOptions @tasks
if ($LASTEXITCODE -ne 0) { throw 'Android verification/build failed.' }
$variantDirectory = $Variant.ToLowerInvariant()
Write-Output (Join-Path $repoRoot "android\app\build\outputs\apk\$variantDirectory")
