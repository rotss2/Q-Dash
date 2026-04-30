#!/bin/bash
# Script to regenerate Supabase TypeScript types
# Usage: ./scripts/regenerate-types.sh

set -e

echo "Regenerating Supabase TypeScript types..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: supabase CLI is not installed."
    echo "Install it with: npm install -g supabase"
    exit 1
fi

# Generate types from your Supabase project
# Replace with your actual Supabase project ID or use --db-url
supabase gen types typescript --project-id "$VITE_SUPABASE_PROJECT_ID" --schema public > src/lib/database.types.ts

echo "Types regenerated successfully at src/lib/database.types.ts"
