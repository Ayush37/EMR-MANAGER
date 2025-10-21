#!/bin/bash

# Test EMR Serverless search functionality

echo "Testing EMR Serverless Backend Endpoints..."
echo "==========================================="

# Set the base URL
BASE_URL="http://localhost:3700/serverless-api"

echo -e "\n1. Testing list endpoint (should include isTruncated):"
curl -s "$BASE_URL/list?page=1&limit=50" | python3 -m json.tool | grep -E '"isTruncated"|"totalPages"|"total"'

echo -e "\n2. Testing search endpoint with query 'application':"
curl -s "$BASE_URL/search?query=application" | python3 -m json.tool | head -20

echo -e "\n3. Testing search endpoint with specific prefix:"
curl -s "$BASE_URL/search?prefix=logs/serverless/applications/&query=driver" | python3 -m json.tool | head -20

echo -e "\n4. Testing health endpoint:"
curl -s "$BASE_URL/health" | python3 -m json.tool

echo -e "\nDone!"