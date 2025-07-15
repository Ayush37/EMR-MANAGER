#!/usr/bin/env python3
import requests

# Test both health endpoints
urls = [
    'http://localhost:3700/health',
    'http://localhost:3700/s3data-api/health'
]

for url in urls:
    print(f"\nTesting {url}")
    try:
        response = requests.get(url)
        print(f"Status: {response.status_code}")
        print(f"Headers: {response.headers}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")