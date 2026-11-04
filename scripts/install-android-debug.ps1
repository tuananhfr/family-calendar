param([string]$Serial = '', [ValidateRange(10, 600)][int]$WaitSeconds = 180)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$adb = Join-Path $repoRoot '.cache\android\sdk\platform-tools\adb.exe'
$apk = Join-Path $repoRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
if (!(Test-Path -LiteralPath $adb)) { throw 'ADB is missing. Run scripts/build-android.ps1 -Bootstrap first.' }
if (!(Test-Path -LiteralPath $apk)) { throw 'APK is missing. Run scripts/build-android.ps1 first.' }

if (!$Serial) {
    $devices = @(& $adb devices | ForEach-Object {
        if ($_ -match '^(\S+)\s+device(?:\s|$)') { $Matches[1] }
    })
    if ($LASTEXITCODE -ne 0) { throw 'Could not list Android devices.' }
    if ($devices.Count -ne 1) { throw 'Start one Android emulator/device, or pass -Serial with its ADB serial.' }
    $Serial = $devices[0]
}

Write-Output "Waiting for Android to finish booting on $Serial..."
$deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
while ($true) {
    $boot = (& $adb -s $Serial shell getprop sys.boot_completed) -join ''
    if ($LASTEXITCODE -ne 0) { throw 'Android disconnected. Wait for the emulator to reconnect, then run this script again.' }
    if ($boot.Trim() -eq '1') { break }
    if ([DateTime]::UtcNow -ge $deadline) {
        throw 'Android is still booting. Wait for its home screen, then run this script again. On a slow PC, use an API 35 AVD and close unused apps.'
    }
    Start-Sleep -Seconds 3
}

& $adb -s $Serial install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'APK installation failed.' }
& $adb -s $Serial reverse tcp:3004 tcp:3005
if ($LASTEXITCODE -ne 0) { throw 'Could not connect Android port 3004 to backend port 3005.' }
& $adb -s $Serial shell am start -n vn.lichgiadinh.screentime.debug/vn.lichgiadinh.screentime.MainActivity
if ($LASTEXITCODE -ne 0) { throw 'Could not open the screen time app.' }
Write-Output 'Ready. In the Android app, enter http://localhost:3004/api/v1 and a new pairing code from the website.'
