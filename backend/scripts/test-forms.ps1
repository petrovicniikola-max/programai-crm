# Forms module – PowerShell test (backend on http://localhost:3000)
# 1. Create form  2. Add 3 questions (short_text, multiple_choice, checkbox)
# 3. Submit 2 submissions  4. GET pivot (show matrix)  5. Export CSV

$BaseUrl = $env:API_URL ?? 'http://localhost:3000'
$AdminPass = $env:SEED_ADMIN_PASSWORD ?? 'Admin123!'

Write-Host "Login as admin (SUPER_ADMIN)..." -ForegroundColor Cyan
$loginBody = @{ email = 'admin@demo.local'; password = $AdminPass } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -Body $loginBody -ContentType 'application/json'
$token = $login.accessToken
$headers = @{ Authorization = "Bearer $token" }
Write-Host "OK" -ForegroundColor Green

# 1. Create form
Write-Host "`n1. POST /forms – create form" -ForegroundColor Cyan
$formBody = @{ title = 'Sprint 3 Test Form'; description = 'Demo' } | ConvertTo-Json
$form = Invoke-RestMethod -Uri "$BaseUrl/forms" -Method Post -Headers $headers -Body $formBody -ContentType 'application/json'
$formId = $form.id
Write-Host "   Form id: $formId" -ForegroundColor Green

# 2. Add 3 questions: short_text, multiple_choice, checkboxes
Write-Host "`n2. POST /forms/:id/questions – add 3 questions" -ForegroundColor Cyan
$q1 = @{ type = 'SHORT_TEXT'; title = 'Your name'; isRequired = $true } | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/forms/$formId/questions" -Method Post -Headers $headers -Body $q1 -ContentType 'application/json' | Out-Null

$q2 = @{
  type   = 'MULTIPLE_CHOICE'
  title  = 'Preferred contact'
  options = @(
    @{ label = 'Email'; value = 'email' }
    @{ label = 'Phone'; value = 'phone' }
  )
} | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/forms/$formId/questions" -Method Post -Headers $headers -Body $q2 -ContentType 'application/json' | Out-Null

$q3 = @{
  type    = 'CHECKBOXES'
  title   = 'Topics of interest'
  options = @(
    @{ label = 'Sales' }
    @{ label = 'Support' }
    @{ label = 'Other' }
  )
} | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/forms/$formId/questions" -Method Post -Headers $headers -Body $q3 -ContentType 'application/json' | Out-Null
Write-Host "   Added SHORT_TEXT, MULTIPLE_CHOICE, CHECKBOXES" -ForegroundColor Green

# Get form to read question IDs for submit
$formFull = Invoke-RestMethod -Uri "$BaseUrl/forms/$formId" -Headers $headers
$questions = $formFull.questions
$nameQ = $questions | Where-Object { $_.type -eq 'SHORT_TEXT' } | Select-Object -First 1
$contactQ = $questions | Where-Object { $_.type -eq 'MULTIPLE_CHOICE' } | Select-Object -First 1
$topicsQ = $questions | Where-Object { $_.type -eq 'CHECKBOXES' } | Select-Object -First 1

# 3. Submit 2 responses
Write-Host "`n3. POST /forms/:id/submissions – 2 submissions" -ForegroundColor Cyan
$sub1 = @{
  metadata = @{ leadName = 'Alice'; leadEmail = 'alice@test.com' }
  answers  = @(
    @{ questionId = $nameQ.id; valueText = 'Alice' }
    @{ questionId = $contactQ.id; valueText = 'email' }
    @{ questionId = $topicsQ.id; valueJson = @('Sales', 'Support') }
  )
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$BaseUrl/forms/$formId/submissions" -Method Post -Headers $headers -Body $sub1 -ContentType 'application/json' | Out-Null

$sub2 = @{
  metadata = @{ leadName = 'Bob' }
  answers  = @(
    @{ questionId = $nameQ.id; valueText = 'Bob' }
    @{ questionId = $contactQ.id; valueText = 'phone' }
    @{ questionId = $topicsQ.id; valueJson = @('Other') }
  )
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$BaseUrl/forms/$formId/submissions" -Method Post -Headers $headers -Body $sub2 -ContentType 'application/json' | Out-Null
Write-Host "   Submitted 2 responses" -ForegroundColor Green

# 4. GET pivot – show matrix
Write-Host "`n4. GET /forms/:id/responses/pivot – matrix view" -ForegroundColor Cyan
$pivot = Invoke-RestMethod -Uri "$BaseUrl/forms/$formId/responses/pivot?limit=10" -Headers $headers
Write-Host "   Form: $($pivot.form.title)"
Write-Host "   Questions: $($pivot.questions.Count)"
Write-Host "   Submissions: $($pivot.submissions.Count)"
Write-Host "   Matrix (rows=questions, cols=submissions):"
$pivot.matrix | ForEach-Object { Write-Host "     $_" }
$pivot | ConvertTo-Json -Depth 6

# 5. Export CSV
Write-Host "`n5. GET /forms/:id/responses.csv" -ForegroundColor Cyan
$csv = Invoke-WebRequest -Uri "$BaseUrl/forms/$formId/responses.csv?limit=10" -Headers $headers -UseBasicParsing
Write-Host "   CSV length: $($csv.Content.Length) bytes"
Write-Host "   First lines:"
$csv.Content.Split("`n") | Select-Object -First 6 | ForEach-Object { Write-Host "     $_" }

Write-Host "`nDone." -ForegroundColor Green
