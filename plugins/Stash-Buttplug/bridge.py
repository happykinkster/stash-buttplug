import sys
import json
import os

# Debug logging
try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    log_path = os.path.join(script_dir, "bridge_debug.log")
    # with open(log_path, "a") as f:
    #    f.write("Task started\n")
except:
    pass

def return_error(msg):
    print(json.dumps({"error": msg}))
    sys.exit(0)

def main():
    try:
        # Stash passes arguments as JSON via stdin
        input_data = sys.stdin.read()
        if not input_data:
            return_error("No input data received")

        try:
            args = json.loads(input_data)
        except json.JSONDecodeError:
            return_error("Invalid JSON input")
            
        # Extract 'path' argument
        # Stash might pass it as a flat dict if using interface: raw
        # Or as args map. Let's assume simple dict from 'raw' or args.
        # But 'runPluginTask' arguments come in as a map.
        
        file_path = args.get('path')
        if not file_path:
            return_error("Missing 'path' argument")

        if not file_path.lower().endswith('.funscript'):
            return_error("Only .funscript files allowed")

        if not os.path.exists(file_path):
            return_error(f"File not found: {file_path}")

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # Validate it's JSON
                json.loads(content)
                
            # Return content wrapped. 
            # Note: The output must be JSON.
            # We will return { "content": <raw_json_string> } or just the object if Stash handles it.
            # Let's return the parsed object structure directly, so JS receives it as an object.
            # But wait, Stash task output is stringmap or similar?
            # It's safest to return it as a string in a field, or just the JSON if Stash relays it.
            # Let's try returning the raw content structure.
            print(json.dumps({"content": content}))
            
        except Exception as e:
            return_error(f"Read error: {str(e)}")

    except Exception as e:
        return_error(f"System error: {str(e)}")

if __name__ == '__main__':
    main()
