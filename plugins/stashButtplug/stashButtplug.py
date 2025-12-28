import sys
import json
import os

# Minimal Script
try:
    print(json.dumps({"content": "PYTHON_SUCCESS"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
