"""
OneClick Voice Waste Tracker
Voice-enabled food waste logging kiosk with Claude AI interpretation
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os
import requests
from datetime import datetime
import json
import uuid

app = Flask(__name__)
CORS(app)

# Menu items and ingredients for Chick-fil-A style operations
MENU_ITEMS = {
    "entrees": [
        "Chicken Sandwich", "Spicy Chicken Sandwich", "Deluxe Sandwich",
        "Grilled Chicken Sandwich", "Chicken Nuggets", "Grilled Nuggets",
        "Chicken Strips", "Cool Wrap"
    ],
    "breakfast": [
        "Chicken Minis", "Chicken Biscuit", "Spicy Chicken Biscuit",
        "Egg Cheese Biscuit", "Sausage Biscuit", "Bacon Biscuit",
        "Hash Browns", "Yogurt Parfait", "Fruit Cup"
    ],
    "sides": [
        "Waffle Fries", "Mac and Cheese", "Chicken Soup",
        "Side Salad", "Superfood Side", "Kale Crunch"
    ],
    "treats": [
        "Ice Cream Cone", "Chocolate Cookie", "Fudge Brownie",
        "Vanilla Milkshake", "Chocolate Milkshake", "Strawberry Milkshake",
        "Frosted Lemonade", "Frosted Coffee"
    ],
    "beverages": [
        "Lemonade", "Diet Lemonade", "Iced Tea", "Sweet Tea",
        "Coffee", "Iced Coffee", "Soft Drinks"
    ],
    "sauces": [
        "Signature Sauce", "Polynesian Sauce", "Honey Mustard",
        "Ranch Sauce", "Buffalo Sauce", "BBQ Sauce", "Sriracha Sauce"
    ]
}

RAW_INGREDIENTS = {
    "proteins": [
        "Chicken Filets", "Chicken Breast", "Chicken Strips",
        "Raw Nuggets", "Grilled Chicken", "Bacon", "Sausage Patties", "Eggs"
    ],
    "breads": [
        "Biscuits", "Brioche Buns", "Multigrain Buns", "Mini Rolls",
        "English Muffins", "Tortillas", "Flatbread Wraps"
    ],
    "produce": [
        "Lettuce", "Tomatoes", "Pickles", "Cabbage", "Carrots",
        "Kale", "Mixed Greens", "Corn", "Black Beans", "Peppers",
        "Onions", "Jalapeños", "Strawberries", "Blueberries", "Apples"
    ],
    "dairy": [
        "American Cheese", "Colby Jack Cheese", "Pepper Jack Cheese",
        "Shredded Cheese", "Ice Cream Mix", "Greek Yogurt", "Butter", "Milk"
    ],
    "dry_goods": [
        "Flour", "Breading Mix", "Waffle Fry Batter", "Croutons",
        "Granola", "Tortilla Strips", "Almonds", "Sunflower Seeds"
    ],
    "oils_liquids": [
        "Peanut Oil", "Cooking Oil", "Lemonade Concentrate",
        "Tea Concentrate", "Coffee Grounds"
    ]
}

# In-memory waste log
waste_log = []


def get_claude_interpretation(user_input):
    """Use Claude AI to interpret natural language waste input"""

    api_key = os.environ.get('ANTHROPIC_API_KEY', '')

    if not api_key:
        return parse_basic(user_input)

    system_prompt = """You are a food waste tracking assistant for a quick-service restaurant.
Your job is to interpret what employees say about food waste and extract structured data.

EXTRACT:
1. Item name (standardized to common kitchen terminology)
2. Quantity (number)
3. Unit (count, lbs, oz, gallons, bags, cases, trays)
4. Category (menu_item or ingredient)
5. Subcategory (proteins, produce, breads, dairy, entrees, sides, etc.)

MATCHING RULES:
- "chicken filets" or "filets" → Chicken Filets (ingredient/proteins)
- "nuggets" → Chicken Nuggets (menu_item/entrees)
- "raw nuggets" → Raw Nuggets (ingredient/proteins)
- "fries" or "waffle fries" → Waffle Fries (menu_item/sides)
- "biscuits" → Biscuits (ingredient/breads)
- Accept natural language: "threw away", "dumped", "wasted", "expired", "went bad"

Respond ONLY with valid JSON:
{
    "items": [
        {
            "name": "Item Name",
            "quantity": 50,
            "unit": "count",
            "category": "ingredient",
            "subcategory": "proteins"
        }
    ],
    "confidence": 0.95,
    "clarification_needed": false
}"""

    try:
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'Content-Type': 'application/json',
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01'
            },
            json={
                'model': 'claude-3-5-haiku-20241022',
                'max_tokens': 500,
                'system': system_prompt,
                'messages': [{'role': 'user', 'content': f'Parse this waste report: "{user_input}"'}]
            },
            timeout=15
        )

        if response.status_code == 200:
            result = response.json()
            content = result['content'][0]['text']
            # Clean up response if it has markdown code blocks
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0]
            elif '```' in content:
                content = content.split('```')[1].split('```')[0]
            parsed = json.loads(content.strip())
            return parsed
        else:
            print(f"Claude API error: {response.status_code} - {response.text}")
            return parse_basic(user_input)

    except Exception as e:
        print(f"Claude API error: {e}")
        return parse_basic(user_input)


def parse_basic(user_input):
    """Basic fallback parser when Claude API unavailable"""
    import re

    numbers = re.findall(r'(\d+(?:\.\d+)?)', user_input)
    quantity = float(numbers[0]) if numbers else 1

    unit = "count"
    unit_patterns = {
        'lbs': ['lb', 'lbs', 'pound', 'pounds'],
        'oz': ['oz', 'ounce', 'ounces'],
        'gallons': ['gallon', 'gallons', 'gal'],
        'cups': ['cup', 'cups'],
        'bags': ['bag', 'bags'],
        'cases': ['case', 'cases'],
        'trays': ['tray', 'trays']
    }

    lower_input = user_input.lower()
    for unit_name, patterns in unit_patterns.items():
        if any(p in lower_input for p in patterns):
            unit = unit_name
            break

    item_name = "Unknown Item"
    category = "other"
    subcategory = "unknown"

    # Check menu items
    for cat, items in MENU_ITEMS.items():
        for item in items:
            if item.lower() in lower_input or any(word in lower_input for word in item.lower().split() if len(word) > 3):
                item_name = item
                category = "menu_item"
                subcategory = cat
                break
        if item_name != "Unknown Item":
            break

    # Check ingredients
    if item_name == "Unknown Item":
        for cat, items in RAW_INGREDIENTS.items():
            for item in items:
                if item.lower() in lower_input or any(word in lower_input for word in item.lower().split() if len(word) > 3):
                    item_name = item
                    category = "ingredient"
                    subcategory = cat
                    break
            if item_name != "Unknown Item":
                break

    return {
        "items": [{
            "name": item_name,
            "quantity": quantity,
            "unit": unit,
            "category": category,
            "subcategory": subcategory
        }],
        "confidence": 0.6 if item_name != "Unknown Item" else 0.3,
        "clarification_needed": item_name == "Unknown Item"
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/parse', methods=['POST'])
def parse_waste():
    """Parse voice input without logging"""
    data = request.json
    user_input = data.get('text', '')

    if not user_input:
        return jsonify({'error': 'No input provided'}), 400

    interpretation = get_claude_interpretation(user_input)
    return jsonify(interpretation)


@app.route('/api/log', methods=['POST'])
def log_waste():
    """Confirm and log a waste entry"""
    data = request.json

    entry = {
        'id': str(uuid.uuid4())[:8],
        'timestamp': datetime.now().isoformat(),
        'original_input': data.get('original_input', ''),
        'item_name': data.get('item_name', 'Unknown'),
        'quantity': data.get('quantity', 1),
        'unit': data.get('unit', 'count'),
        'category': data.get('category', 'other'),
        'subcategory': data.get('subcategory', 'unknown'),
        'employee_photo': data.get('employee_photo', None)
    }

    waste_log.append(entry)

    return jsonify({
        'success': True,
        'entry': entry,
        'message': f"Logged: {entry['item_name']} - {entry['quantity']} {entry['unit']}"
    })


@app.route('/api/log', methods=['GET'])
def get_log():
    """Get recent waste entries"""
    limit = request.args.get('limit', 10, type=int)
    return jsonify(waste_log[-limit:][::-1])


@app.route('/api/summary', methods=['GET'])
def get_summary():
    """Get waste summary by category"""
    summary = {}
    for entry in waste_log:
        cat = entry.get('subcategory', 'unknown')
        if cat not in summary:
            summary[cat] = {'count': 0, 'items': {}}
        summary[cat]['count'] += 1

        item = entry.get('item_name')
        if item not in summary[cat]['items']:
            summary[cat]['items'][item] = 0
        summary[cat]['items'][item] += entry.get('quantity', 1)

    return jsonify(summary)


@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
