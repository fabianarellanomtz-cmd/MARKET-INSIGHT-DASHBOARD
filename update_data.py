
import csv
import json
import os

csv_path = r"c:/Users/Fabian Arellano/OneDrive - ODELLÁ/Documentos/Marketing/INFORMACIÓN DE MERCADO/OTROS/ARTÍCULOS/ARTÍCULOS.csv"
js_output_path = r"C:/Users/Fabian Arellano/.gemini/antigravity/brain/6ceee79c-7312-4d81-b731-c5625f331605/NewsDashboard/data.js"

if not os.path.exists(csv_path):
    print(f"Error: CSV file not found at {csv_path}")
    exit(1)

def update_data():
    data_list = []
    
    # Read CSV
    try:
        with open(csv_path, mode='r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # Clean up keys if necessary (trim whitespace)
                clean_row = {k.strip(): v.strip() for k, v in row.items() if k}
                if clean_row.get('URL'): # Ensure there is at least a URL or id
                     data_list.append(clean_row)
        
        print(f"Successfully read {len(data_list)} articles from CSV.")
        
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    # Write to JS
    try:
        # Wrap the JSON array in the PRELOADED_DATA constant assignment
        json_str = json.dumps(data_list, indent=4, ensure_ascii=False)
        js_content = f"const PRELOADED_DATA = {json_str};\n"
        
        with open(js_output_path, mode='w', encoding='utf-8') as jsfile:
            jsfile.write(js_content)
            
        print(f"Successfully updated {js_output_path}")
        
    except Exception as e:
        print(f"Error writing to JS file: {e}")

if __name__ == "__main__":
    update_data()
