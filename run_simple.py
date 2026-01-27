#!/usr/bin/env python3
"""
Simple HTTP server for testing OneClick Waste Tracker
Serves static files and provides mock API endpoints
"""

import http.server
import socketserver
import json
import os
from datetime import datetime
from urllib.parse import parse_qs, urlparse
import re
import uuid

PORT = 5000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

waste_log = []

# Menu items for basic parsing
ITEMS = {
    "chicken": ("Chicken Filets", "proteins", "🍗"),
    "filet": ("Chicken Filets", "proteins", "🍗"),
    "nugget": ("Chicken Nuggets", "entrees", "🍗"),
    "fries": ("Waffle Fries", "sides", "🍟"),
    "biscuit": ("Biscuits", "breads", "🥐"),
    "lettuce": ("Lettuce", "produce", "🥬"),
    "tomato": ("Tomatoes", "produce", "🍅"),
    "flour": ("Flour", "dry_goods", "🌾"),
    "lemonade": ("Lemonade", "beverages", "🍋"),
    "tea": ("Sweet Tea", "beverages", "🥤"),
    "cheese": ("American Cheese", "dairy", "🧀"),
    "milk": ("Milk", "dairy", "🥛"),
    "bacon": ("Bacon", "proteins", "🥓"),
    "egg": ("Eggs", "proteins", "🥚"),
    "oil": ("Peanut Oil", "oils_liquids", "🫗"),
    "sauce": ("Signature Sauce", "sauces", "🫙"),
}


def parse_waste(text):
    """Simple waste parser"""
    text_lower = text.lower()
    
    # Find quantity
    numbers = re.findall(r'(\d+(?:\.\d+)?)', text)
    quantity = float(numbers[0]) if numbers else 1
    
    # Find unit
    unit = "count"
    if any(u in text_lower for u in ["lb", "pound"]):
        unit = "lbs"
    elif any(u in text_lower for u in ["oz", "ounce"]):
        unit = "oz"
    elif any(u in text_lower for u in ["gallon", "gal"]):
        unit = "gallons"
    elif "bag" in text_lower:
        unit = "bags"
    elif "case" in text_lower:
        unit = "cases"
    elif "tray" in text_lower:
        unit = "trays"
    
    # Find item
    item_name = "Unknown Item"
    subcategory = "unknown"
    
    for keyword, (name, cat, icon) in ITEMS.items():
        if keyword in text_lower:
            item_name = name
            subcategory = cat
            break
    
    return {
        "items": [{
            "name": item_name,
            "quantity": quantity,
            "unit": unit,
            "category": "ingredient" if subcategory in ["proteins", "produce", "breads", "dairy", "dry_goods", "oils_liquids"] else "menu_item",
            "subcategory": subcategory
        }],
        "confidence": 0.8 if item_name != "Unknown Item" else 0.3,
        "clarification_needed": item_name == "Unknown Item"
    }


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def do_GET(self):
        parsed = urlparse(self.path)
        
        if parsed.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            with open(os.path.join(DIRECTORY, 'templates', 'index.html'), 'rb') as f:
                self.wfile.write(f.read())
        elif parsed.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "healthy"}).encode())
        elif parsed.path == '/api/log':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(waste_log[-10:][::-1]).encode())
        elif parsed.path.startswith('/static/'):
            super().do_GET()
        else:
            self.send_error(404)
    
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode())
        
        if self.path == '/api/parse':
            result = parse_waste(data.get('text', ''))
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        
        elif self.path == '/api/log':
            entry = {
                'id': str(uuid.uuid4())[:8],
                'timestamp': datetime.now().isoformat(),
                'original_input': data.get('original_input', ''),
                'item_name': data.get('item_name', 'Unknown'),
                'quantity': data.get('quantity', 1),
                'unit': data.get('unit', 'count'),
                'category': data.get('category', 'other'),
                'subcategory': data.get('subcategory', 'unknown')
            }
            waste_log.append(entry)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'entry': entry,
                'message': f"Logged: {entry['item_name']} - {entry['quantity']} {entry['unit']}"
            }).encode())
        else:
            self.send_error(404)
    
    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]}")


if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"OneClick Waste Tracker running at http://localhost:{PORT}")
        print("Press Ctrl+C to stop")
        httpd.serve_forever()
