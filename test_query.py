import requests
import json

try:
    r = requests.post('http://localhost:8000/query', json={'query': 'What is AI?'})
    print(json.dumps(r.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
