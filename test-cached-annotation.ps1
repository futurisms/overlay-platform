$token = "eyJraWQiOiJ2YmFFMWNuOHd2YXFIOHozakFHd2N2aTdcLzlkblpvK0llclJjTmgwTHIzMD0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJlMmM1MTQxNC00MGIxLTcwMWItNDkzZC1hNjE3OWFhZGFkOTYiLCJjb2duaXRvOmdyb3VwcyI6WyJzeXN0ZW1fYWRtaW4iXSwiZW1haWxfdmVyaWZpZWQiOnRydWUsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC5ldS13ZXN0LTEuYW1hem9uYXdzLmNvbVwvZXUtd2VzdC0xX2xDMjV4WjhzNiIsImNvZ25pdG86dXNlcm5hbWUiOiJlMmM1MTQxNC00MGIxLTcwMWItNDkzZC1hNjE3OWFhZGFkOTYiLCJnaXZlbl9uYW1lIjoiQWRtaW4iLCJvcmlnaW5fanRpIjoiOWJiNGQyN2EtMjFiOC00OGMzLTlkYmItOTE5OGQxNzNmMDY1IiwiYXVkIjoiNGU0NXBkaW9iY204cW8zZWh2aTFiY21vMnMiLCJldmVudF9pZCI6ImM5MGYxNzEzLWI1ZGItNDk1NC05ZTQzLTYzMTY5YjBjYzFmNCIsInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNzcwODI3Nzk0LCJleHAiOjE3NzA4MzEzOTQsImlhdCI6MTc3MDgyNzc5NCwiZmFtaWx5X25hbWUiOiJVc2VyIiwianRpIjoiZjNjMzIxZWQtMzFhNS00ZDU1LWJjM2UtYTRkYTk2ZjM4MjdiIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSJ9.iExOGo8GYJ3DKNofcY92dbdGz0mj1MLGezXUsBmTJAehiOGDWtlTxg_lNEjIrvEuPKIfDFYaHB72B9HnT2xjD4ximvwhvrOJLQ8OyYLPITbi9a4IK0_AQf_Q5UxwlYi3NucUw9hD6JLnf7hNNYkmXD5FXcDu7lT6v449kRynADKPeDVxEBKGqVwyGZgcORqsSkJQJArL2hbKrNMujl62hzi-sp9Hiq_e7P-sIZeiBzZQ05uFXU9P6leBEC-_X3CrQVhe-SETxlGxSaMU-9IWVdMT4bSBP-Z4T64RmN5fKERXC1AoHo0qTqYrhdq14548f2HG01q8LO6JqWHzcqxe-w"

$headers = @{
    'Authorization' = "Bearer $token"
    'Origin' = 'http://localhost:3000'
}

Write-Host "Testing previously failing submission (should now be cached)..."
Write-Host ""

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $response = Invoke-WebRequest `
        -Uri 'http://localhost:3001/submissions/2be2bdf6-dafd-4aee-bb23-ee2aa53909a4/annotate' `
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
    Write-Host "Generation Time: $($json.generation_time_ms / 1000)s"

    if ($json.cached -eq $true) {
        Write-Host ""
        Write-Host "SUCCESS: Annotation now loads from cache!"
    } else {
        Write-Host ""
        Write-Host "WARNING: Not cached - was regenerated"
    }

} catch {
    $stopwatch.Stop()
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host "Total Time: $($stopwatch.Elapsed.TotalSeconds)s"
}
