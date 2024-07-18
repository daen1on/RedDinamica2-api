import re
import os

def has_nonce_already(html_content):
    # Check if nonce="{{nonce}}" is already present in <script> and <style> tags
    script_nonce = re.search(r'<script\s+[^>]*nonce="{{nonce}}"', html_content)
    style_nonce = re.search(r'<style\s+[^>]*nonce="{{nonce}}"', html_content)
    return script_nonce or style_nonce

def add_nonce_to_scripts_and_styles(html_content):
    # Define the regex patterns to match <script src="..."> and <style> tags
    script_pattern = re.compile(r'(<script\s+[^>]*src="[^"]+"[^>]*)(?<!nonce="{{nonce}}")([^>]*>)')
    style_pattern = re.compile(r'(<style\s+[^>]*)(?<!nonce="{{nonce}}")([^>]*>)')

    # Add nonce="{{nonce}}" to the matched patterns
    updated_html_content = re.sub(script_pattern, r'\1 nonce="{{nonce}}"\2', html_content)
    updated_html_content = re.sub(style_pattern, r'\1 nonce="{{nonce}}"\2', updated_html_content)

    return updated_html_content

def process_html_file(file_path):
    # Read the HTML content from the file
    with open(file_path, 'r', encoding='utf-8') as file:
        html_content = file.read()

    # Check if the process has already been done
    if has_nonce_already(html_content):
        print("Process already done.")
        return

    # Apply the updates
    updated_html_content = add_nonce_to_scripts_and_styles(html_content)

    # Write the updated HTML content back to the file
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(updated_html_content)
    print(f"Updated: {file_path}")

if __name__ == "__main__":
    # Define the path to the index.html file
    file_path = os.path.join(os.path.dirname(__file__), '../client/index.html')

    # Process the HTML file
    process_html_file(file_path)
