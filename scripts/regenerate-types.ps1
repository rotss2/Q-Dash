# PowerShell script to regenerate Supabase TypeScript types
# Usage: .\scripts\regenerate-types.ps1

Write-Host "Regenerating Supabase TypeScript types..."

# Check if supabase CLI is installed
$supabasePath = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabasePath) {
    Write-Error "Error: supabase CLI is not installed. Install it with: npm install -g supabase"
    exit 1
}

# Get Supabase project ID from environment or prompt
$projectId = $env:VITE_SUPABASE_PROJECT_ID
if (-not $projectId) {
    $projectId = Read-Host "Enter your Supabase Project ID"
}

# Generate types
supabase gen types typescript --project-id $projectId --schema public > src/lib/database.types.ts

Write-Host "Types regenerated successfully at src/lib/database.types.ts" -ForegroundColor Green
