import http.server
import socketserver
import urllib.parse
import os
import sys

# allow plugin to run even if port is busy (restart)
socketserver.TCPServer.allow_reuse_address = True

PORT = 9998

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/funscript':
            query = urllib.parse.parse_qs(parsed.query)
            if 'path' not in query:
                self.send_error(400, "Missing path")
                return
            
            file_path = query['path'][0]
            
            # Simple security check
            if not file_path.lower().endswith('.funscript'):
                self.send_error(403, "Only .funscript files allowed")
                return
                
            if not os.path.exists(file_path):
                self.send_error(404, "File not found: " + file_path)
                return

            try:
                # print(f"Serving: {file_path}")
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            except Exception as e:
                self.send_error(500, str(e))
        else:
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'Buttplug Bridge Active')

print(f"Stash-Buttplug Bridge running on port {PORT}...")
print("Keep this task running to allow funscript fetching.")
# Flush stdout for Stash logs
sys.stdout.flush()

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    pass
