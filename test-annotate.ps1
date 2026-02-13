$token = "eyJraWQiOiJ2YmFFMWNuOHd2YXFIOHozakFHd2N2aTdcLzlkblpvK0llclJjTmgwTHIzMD0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJlMmM1MTQxNC00MGIxLTcwMWItNDkzZC1hNjE3OWFhZGFkOTYiLCJjb2duaXRvOmdyb3VwcyI6WyJzeXN0ZW1fYWRtaW4iXSwiZW1haWxfdmVyaWZpZWQiOnRydWUsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC5ldS13ZXN0LTEuYW1hem9uYXdzLmNvbVwvZXUtd2VzdC0xX2xDMjV4WjhzNiIsImNvZ25pdG86dXNlcm5hbWUiOiJlMmM1MTQxNC00MGIxLTcwMWItNDkzZC1hNjE3OWFhZGFkOTYiLCJnaXZlbl9uYW1lIjoiQWRtaW4iLCJvcmlnaW5fanRpIjoiOGY2MGRjNTMtOTViZC00MGQ2LWEwNTQtNjE2NTUwNWI5ZTc2IiwiYXVkIjoiNGU0NXBkaW9iY204cW8zZWh2aTFiY21vMnMiLCJldmVudF9pZCI6ImZhMjEyZWU1LWE0YTctNDk3Ny1hZTQyLTdlZDJlZGRmMzExYyIsInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNzcwODI2MDQyLCJleHAiOjE3NzA4Mjk2NDIsImlhdCI6MTc3MDgyNjA0MiwiZmFtaWx5X25hbWUiOiJVc2VyIiwianRpIjoiMWM3Y2UwZWItZGM1Ny00OTQ0LTgxMmEtN2M2YmM0ZmUzZTY5IiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSJ9.iD-31LZWr58n6XePIYsD0_8STk1OhZSsjqi_gwt3hF0aTxZi68z02t2YJywIM2LgbuAO5_EKRK35ke3fvQHvuM-DdkrsReb_Bw8iwEdedYIXGZr1NTyXhfxI5_OFIP-xbymPwGs9bxOQCetInlsWGKLYma4C3do4Y69YAVyHDGTJpvK1yh6c9VvQ_GQuGuN36O8ktysWXO69yHG2LtftVzmWZroc3X32wvBBUqFnDHbI9wGmDXzFQn-HPi752G0JOOTBjJwV2NQHG_FV5kO5vgUcLOxwnxr8-n-ELNhRn3Di-Z9v7SuKeuNC_DfxDZXqOwbJHGAmJMG8XY7QLHO9yQ"

$headers = @{
    'Authorization' = "Bearer $token"
    'Origin' = 'https://overlay-platform.vercel.app'
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    Write-Host "Making GET request to annotate endpoint..."
    Write-Host ""

    $response = Invoke-WebRequest `
        -Uri 'https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/submissions/014b7cd1-4012-408d-8e34-77ebb211e246/annotate' `
        -Method GET `
        -Headers $headers `
        -UseBasicParsing

    $stopwatch.Stop()

    Write-Host "HTTP Status: $($response.StatusCode)"
    Write-Host "Total Time: $($stopwatch.Elapsed.TotalSeconds)s"
    Write-Host ""
    Write-Host "Response Headers:"
    $response.Headers.GetEnumerator() | ForEach-Object { Write-Host "  $($_.Key): $($_.Value)" }
    Write-Host ""
    Write-Host "Response Body:"
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

    # Save to file
    $response.Content | Out-File -FilePath "annotation_response.json" -Encoding utf8
    Write-Host ""
    Write-Host "Response saved to annotation_response.json"

} catch {
    $stopwatch.Stop()
    Write-Host "Error occurred!"
    Write-Host "Message: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "HTTP Status: $($_.Exception.Response.StatusCode.value__)"
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody"
    }
    Write-Host "Total Time: $($stopwatch.Elapsed.TotalSeconds)s"
}
