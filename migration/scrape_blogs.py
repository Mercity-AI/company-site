import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

def get_blog_urls_from_sitemap(sitemap_url):
    """Extract all blog post URLs from the sitemap"""
    response = requests.get(sitemap_url)
    root = ET.fromstring(response.content)
    
    # Define the namespace
    namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    
    # Extract all URLs from the sitemap
    urls = []
    for url in root.findall('ns:url', namespace):
        loc = url.find('ns:loc', namespace).text
        # Only include blog post URLs
        if '/blog-post/' in loc:
            urls.append(loc)
    
    return urls

def scrape_blog_content(url):
    """Scrape the rich-text content from a blog post"""
    try:
        print(f"Scraping: {url}")
        response = requests.get(url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find the div with class "rich-text w-richtext"
        rich_text_div = soup.find('div', class_='rich-text w-richtext')
        
        if rich_text_div:
            # Get the HTML content
            content = str(rich_text_div)
            return content
        else:
            print(f"  Warning: No rich-text div found for {url}")
            return None
            
    except Exception as e:
        print(f"  Error scraping {url}: {str(e)}")
        return None

def extract_slug_from_url(url):
    """Extract the slug from a blog post URL"""
    # URL format: https://www.mercity.ai/blog-post/slug-name
    parts = url.rstrip('/').split('/')
    return parts[-1]

def main():
    print("Starting blog scraping process...")
    
    # Load the sitemap and get blog URLs
    sitemap_url = "https://www.mercity.ai/sitemap.xml"
    print(f"\nFetching sitemap from {sitemap_url}")
    blog_urls = get_blog_urls_from_sitemap(sitemap_url)
    print(f"Found {len(blog_urls)} blog post URLs")
    
    # Create a dictionary mapping slug to scraped content
    scraped_data = {}
    
    # Scrape each blog post
    for i, url in enumerate(blog_urls, 1):
        slug = extract_slug_from_url(url)
        print(f"\n[{i}/{len(blog_urls)}] Processing slug: {slug}")
        
        content = scrape_blog_content(url)
        scraped_data[slug] = content
        
        # Be polite and add a small delay between requests
        time.sleep(1)
    
    # Load the existing CSV
    csv_path = "Pranav's Radical Site - Blog Posts.csv"
    print(f"\nLoading CSV from {csv_path}")
    df = pd.read_csv(csv_path)
    
    print(f"CSV has {len(df)} rows")
    
    # Add the scraped_content column
    df['scraped_content'] = df['Slug'].map(scraped_data)
    
    # Check how many were successfully scraped
    successful_scrapes = df['scraped_content'].notna().sum()
    print(f"\nSuccessfully scraped content for {successful_scrapes}/{len(df)} blog posts")
    
    # Save the updated CSV
    output_path = "Pranav's Radical Site - Blog Posts.csv"
    df.to_csv(output_path, index=False)
    print(f"\nUpdated CSV saved to {output_path}")
    
    # Print summary
    print("\n" + "="*50)
    print("SUMMARY")
    print("="*50)
    print(f"Total blog posts in CSV: {len(df)}")
    print(f"Successfully scraped: {successful_scrapes}")
    print(f"Failed to scrape: {len(df) - successful_scrapes}")
    
    # Show which ones failed (if any)
    failed = df[df['scraped_content'].isna()]['Slug'].tolist()
    if failed:
        print(f"\nFailed slugs:")
        for slug in failed:
            print(f"  - {slug}")

if __name__ == "__main__":
    main()

