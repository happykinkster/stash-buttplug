import sys
import json
import os

# Robust Debug Script
# Writes to /tmp to avoid permission issues in mounted dirs
debug_file = "/tmp/stash_debug.log"

def log(msg):
    try:
        with open(debug_file, "a") as f:
            f.write(msg + "\n")
    except: pass

log("DEBUG SCRIPT STARTED")
log(f"CWD: {os.getcwd()}")
log(f"Files in CWD: {os.listdir('.')}")

# Try to match Stash expected (Raw) Interface
try:
    input_data = sys.stdin.read()
    log(f"Stdin: {input_data}")
except:
    log("Failed to read stdin")

# Echo Success
output = {"content": "PYTHON_EXECUTION_SUCCESS"}
print(json.dumps(output))
log("Finished execution")
