import sys
import json
import os

# Debug logging
import io

# Enforce UTF-8
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def log(msg):
    # Log to stderr so it shows up in StashApp logs
    print(f"[Buttplug] {msg}", file=sys.stderr)
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        log_file = os.path.join(script_dir, "bridge_debug.log")
        with open(log_file, "a") as f:
            f.write(f"{msg}\n")
    except: pass

log(f"Task started. CWD: {os.getcwd()}")

def return_error(msg):
    log(f"Error: {msg}")
    print(json.dumps({"error": msg}))
    sys.exit(0)

def main():
    try:
        # Stash passes arguments as JSON via stdin
        input_data = sys.stdin.read()
        log(f"Input: {input_data}")

        if not input_data:
            return_error("No input data received")

        try:
            args = json.loads(input_data)
        except json.JSONDecodeError:
            return_error("Invalid JSON input")
            
        # Extract 'path' argument
        file_path = args.get('path')
        if not file_path:
            return_error("Missing 'path' argument")

        if not file_path.lower().endswith('.funscript'):
            return_error("Only .funscript files allowed")

        if not os.path.exists(file_path):
            # Fallback: Try to find ANY funscript in the same directory
            search_dir = os.path.dirname(file_path)
            found_fallback = False
            
            if os.path.exists(search_dir):
                try:
                    for f in os.listdir(search_dir):
                        if f.lower().endswith(".funscript"):
                            fallback_path = os.path.join(search_dir, f)
                            log(f"Exact match not found. Fallback to: {fallback_path}")
                            file_path = fallback_path
                            found_fallback = True
                            break
                except Exception as e:
                    log(f"Fallback search error: {e}")

            if not found_fallback:
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
