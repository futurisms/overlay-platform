$token = "eyJraWQiOiJ2YmFFMWNuOHd2YXFIOHozakFHd2N2aTdcLzlkblpvK0llclJjTmgwTHIzMD0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJlMmM1MTQxNC00MGIxLTcwMWItNDkzZC1hNjE3OWFhZGFkOTYiLCJjb2duaXRvOmdyb3VwcyI6WyJzeXN0ZW1fYWRtaW4iXSwiZW1haWxfdmVyaWZpZWQiOnRydWUsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC5ldS13ZXN0LTEuYW1hem9uYXdzLmNvbVwvZXUtd2VzdC0xX2xDMjV4WjhzNiIsImNvZ25pdG86dXNlcm5hbWUiOiJlMmM1MTQxNC00MGIxLTcwMWItNDkzZC1hNjE3OWFhZGFkOTYiLCJnaXZlbl9uYW1lIjoiQWRtaW4iLCJvcmlnaW5fanRpIjoiOGY2MGRjNTMtOTViZC00MGQ2LWEwNTQtNjE2NTUwNWI5ZTc2IiwiYXVkIjoiNGU0NXBkaW9iY204cW8zZWh2aTFiY21vMnMiLCJldmVudF9pZCI6ImZhMjEyZWU1LWE0YTctNDk3Ny1hZTQyLTdlZDJlZGRmMzExYyIsInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNzcwODI2MDQyLCJleHAiOjE3NzA4Mjk2NDIsImlhdCI6MTc3MDgyNjA0MiwiZmFtaWx5X25hbWUiOiJVc2VyIiwianRpIjoiMWM3Y2UwZWItZGM1Ny00OTQ0LTgxMmEtN2M2YmM0ZmUzZTY5IiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSJ9.iD-31LZWr58n6XePIYsD0_8STk1OhZSsjqi_gwt3hF0aTxZi68z02t2YJywIM2LgbuAO5_EKRK35ke3fvQHvuM-DdkrsReb_Bw8iwEdedYIXGZr1NTyXhfxI5_OFIP-xbymPwGs9bxOQCetInlsWGKLYma4C3do4Y69YAVyHDGTJpvK1yh6c9VvQ_GQuGuN36O8ktysWXO69yHG2LtftVzmWZroc3X32wvBBUqFnDHbI9wGmDXzFQn-HPi752G0JOOTBjJwV2NQHG_FV5kO5vgUcLOxwnxr8-n-ELNhRn3Di-Z9v7SuKeuNC_DfxDZXqOwbJHGAmJMG8XY7QLHO9yQ"

$headers = @{
    'Authorization' = "Bearer $token"
    'Origin' = 'https://overlay-platform.vercel.app'
}

Write-Host "Testing caching behavior (second request)..."
Write-Host ""

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $response = Invoke-WebRequest `
        -Uri 'https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/submissions/014b7cd1-4012-408d-8e34-77ebb211e246/annotate' `
        -Method GET `
        -Headers $headers `
        -UseBasicParsing

    $stopwatch.Stop()

    Write-Host "HTTP Status: $($response.StatusCode)"
    Write-Host "Total Time: $($stopwatch.Elapsed.TotalSeconds)s"
    Write-Host ""

    $json = $response.Content | ConvertFrom-Json

    Write-Host "Cached: $($json.cached)"
    Write-Host "Annotation ID: $($json.annotation_id)"
    Write-Host "Sections: $($json.annotated_json.sections.Length)"

    if ($json.cached -eq $true) {
        Write-Host ""
        Write-Host "SUCCESS: Caching works! Response returned from database cache."
    } else {
        Write-Host ""
        Write-Host "WARNING: Not cached - annotation was regenerated."
    }

} catch {
    $stopwatch.Stop()
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host "Total Time: $($stopwatch.Elapsed.TotalSeconds)s"
}
