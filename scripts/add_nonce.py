import re
import os


def has_nonce_already(html_content):
    # Detect any existing nonce attribute in <script> or <style> tags (any template syntax)
    return re.search(r'<(script|style)\s+[^>]*nonce\s*=\s*"', html_content, re.IGNORECASE) is not None


def add_nonce_to_scripts_and_styles(html_content):
    # Add nonce to <script src> and <style> tags only when they don't already have a nonce attribute
    script_pattern = re.compile(r'(<script\s+(?:(?![^>]*nonce\s*=)[^>])*src="[^"]+"[^>]*)(>)', re.IGNORECASE)
    style_pattern = re.compile(r'(<style\s+(?:(?![^>]*nonce\s*=)[^>])*)(>)', re.IGNORECASE)

    updated_html_content = re.sub(script_pattern, r'\1 nonce="<%= nonce %>"\2', html_content)
    updated_html_content = re.sub(style_pattern, r'\1 nonce="<%= nonce %>"\2', updated_html_content)

    return updated_html_content


def process_html_file(file_path):
    # Read the HTML content from the file
    with open(file_path, 'r', encoding='utf-8') as file:
        html_content = file.read()

    # Apply the updates idempotently (adds nonce only where missing)
    updated_html_content = add_nonce_to_scripts_and_styles(html_content)

    # Write the updated HTML content back to the file
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(updated_html_content)
    print(f"Updated: {file_path}")


if __name__ == "__main__":
    # Resolve candidate paths to index.html
    base_dir = os.path.dirname(__file__)
    candidates = [
        os.path.normpath(os.path.join(base_dir, '../client/browser/index.html')),
        os.path.normpath(os.path.join(base_dir, '../client/index.html')),
    ]

    target_path = None
    for candidate in candidates:
        if os.path.exists(candidate):
            target_path = candidate
            break

    if not target_path:
        raise FileNotFoundError(f"No se encontró index.html. Rutas probadas: {', '.join(candidates)}")

    # Process the HTML file
    process_html_file(target_path)
