import re
import os

def has_already_processed(html_content):
    # Check if the modifications are already applied
    base_match = re.search(r'<base\s+href="/reddinamica/', html_content)
    script_match = re.search(r'<script\s+[^>]*src="/reddinamica/', html_content)
    link_match = re.search(r'<link\s+rel[^>]*href="/reddinamica/', html_content)
    return base_match or script_match or link_match

def update_base_href(html_content):
    # Update <base href="/">
    base_pattern = re.compile(r'(<base\s+href=")(/)([^"]*")')
    updated_html_content = re.sub(base_pattern, r'\1/reddinamica/\3', html_content)
    return updated_html_content

def update_script_src(html_content):
    # Update <script src="/...">
    script_pattern = re.compile(r'(<script\s+[^>]*src=")(/)([^"]*")')
    updated_html_content = re.sub(script_pattern, r'\1/reddinamica/\3', html_content)
    return updated_html_content

def update_link_href(html_content):
    # Update <link rel... href="/...">
    link_pattern = re.compile(r'(<link\s+rel[^>]*href=")(/)([^"]*")')
    updated_html_content = re.sub(link_pattern, r'\1/reddinamica/\3', html_content)
    return updated_html_content

def process_html_file(file_path):
    # Read the HTML content from the file
    with open(file_path, 'r', encoding='utf-8') as file:
        html_content = file.read()

    # Check if the process has already been done
    if has_already_processed(html_content):
        print("Process already done.")
        return

    # Apply the updates
    html_content = update_base_href(html_content)
    html_content = update_script_src(html_content)
    html_content = update_link_href(html_content)

    # Write the updated HTML content back to the file
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(html_content)

if __name__ == "__main__":
    client_folder = os.path.join(os.path.dirname(__file__), '../client')

    # Find all index.html files in the client folder
    for root, dirs, files in os.walk(client_folder):
        for file in files:
            if file == 'index.html':
                file_path = os.path.join(root, file)
                process_html_file(file_path)
                print(f"Updated: {file_path}")
