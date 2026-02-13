$token = "eyJraWQiOiJ2YmFFMWNuOHd2YXFIOHozakFHd2N2aTdcLzlkblpvK0llclJjTmgwTHIzMD0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJlMmM1MTQxNC00MGIxLTcwMWItNDkzZC1hNjE3OWFhZGFkOTYiLCJjb2duaXRvOmdyb3VwcyI6WyJzeXN0ZW1fYWRtaW4iXSwiZW1haWxfdmVyaWZpZWQiOnRydWUsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC5ldS13ZXN0LTEuYW1hem9uYXdzLmNvbVwvZXUtd2VzdC0xX2xDMjV4WjhzNiIsImNvZ25pdG86dXNlcm5hbWUiOiJlMmM1MTQxNC00MGIxLTcwMWItNDkzZC1hNjE3OWFhZGFkOTYiLCJnaXZlbl9uYW1lIjoiQWRtaW4iLCJvcmlnaW5fanRpIjoiOGY2MGRjNTMtOTViZC00MGQ2LWEwNTQtNjE2NTUwNWI5ZTc2IiwiYXVkIjoiNGU0NXBkaW9iY204cW8zZWh2aTFiY21vMnMiLCJldmVudF9pZCI6ImZhMjEyZWU1LWE0YTctNDk3Ny1hZTQyLTdlZDJlZGRmMzExYyIsInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNzcwODI2MDQyLCJleHAiOjE3NzA4Mjk2NDIsImlhdCI6MTc3MDgyNjA0MiwiZmFtaWx5X25hbWUiOiJVc2VyIiwianRpIjoiMWM3Y2UwZWItZGM1Ny00OTQ0LTgxMmEtN2M2YmM0ZmUzZTY5IiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSJ9.iD-31LZWr58n6XePIYsD0_8STk1OhZSsjqi_gwt3hF0aTxZi68z02t2YJywIM2LgbuAO5_EKRK35ke3fvQHvuM-DdkrsReb_Bw8iwEdedYIXGZr1NTyXhfxI5_OFIP-xbymPwGs9bxOQCetInlsWGKLYma4C3do4Y69YAVyHDGTJpvK1yh6c9VvQ_GQuGuN36O8ktysWXO69yHG2LtftVzmWZroc3X32wvBBUqFnDHbI9wGmDXzFQn-HPi752G0JOOTBjJwV2NQHG_FV5kO5vgUcLOxwnxr8-n-ELNhRn3Di-Z9v7SuKeuNC_DfxDZXqOwbJHGAmJMG8XY7QLHO9yQ"

$headers = @{
    'Authorization' = "Bearer $token"
    'Origin' = 'https://overlay-platform.vercel.app'
}

# Test 1: Non-existent submission ID
Write-Host "Test 1: Non-existent submission ID"
Write-Host "=" * 50
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri 'https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/submissions/00000000-0000-0000-0000-000000000000/annotate' `
        -Method GET `
        -Headers $headers `
        -UseBasicParsing

    Write-Host "HTTP Status: $($response.StatusCode)"
    $json = $response.Content | ConvertFrom-Json
    Write-Host "Response: $($response.Content)"

} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "HTTP Status: $statusCode"

    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    Write-Host "Error Response: $responseBody"

    if ($statusCode -eq 404) {
        Write-Host ""
        Write-Host "SUCCESS: Correctly returned 404 for non-existent submission"
    } else {
        Write-Host ""
        Write-Host "UNEXPECTED: Expected 404, got $statusCode"
    }
}

Write-Host ""
Write-Host ""

# Test 2: Invalid submission ID format
Write-Host "Test 2: Invalid submission ID format"
Write-Host "=" * 50
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri 'https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/submissions/invalid-id/annotate' `
        -Method GET `
        -Headers $headers `
        -UseBasicParsing

    Write-Host "HTTP Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"

} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "HTTP Status: $statusCode"

    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    Write-Host "Error Response: $responseBody"

    if ($statusCode -eq 404 -or $statusCode -eq 400) {
        Write-Host ""
        Write-Host "SUCCESS: Correctly returned error for invalid ID format"
    }
}
