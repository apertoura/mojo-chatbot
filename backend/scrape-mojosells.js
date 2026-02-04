import { exec } from 'child_process';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import { writeFile } from 'fs/promises';

const execPromise = promisify(exec);
const BASE_URL = 'https://www.mojosells.com';

// Key pages to scrape
const IMPORTANT_PAGES = [
  'https://www.mojosells.com',
  'https://www.mojosells.com/about/',
  'https://www.mojosells.com/contact/',
  'https://www.mojosells.com/faq/',
  'https://www.mojosells.com/pricing/',
  'https://www.mojosells.com/features/',
  'https://www.mojosells.com/caller-id/',
  'https://www.mojosells.com/lead-management/',
  'https://www.mojosells.com/mobile-apps/',
  'https://www.mojosells.com/integrations-page/',
  'https://www.mojosells.com/general-privacy-policy/',
  'https://www.mojosells.com/blog/',
];

async function fetchWithCurl(url) {
  try {
    const { stdout } = await execPromise(`curl -s -L '${url}'`);
    return stdout;
  } catch (error) {
    throw new Error(`Curl failed: ${error.message}`);
  }
}

async function extractLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = new Set();
  
  $('a[href]').each((i, elem) => {
    let href = $(elem).attr('href');
    if (!href) return;
    
    // Make absolute URLs
    if (href.startsWith('/')) {
      href = baseUrl + href;
    } else if (!href.startsWith('http')) {
      return;
    }
    
    // Only mojosells.com URLs (both with and without www)
    if (href.includes('mojosells.com') && !href.includes('lb11.mojosells.com')) {
      // Clean up URL
      href = href.split('#')[0].split('?')[0];
      if (href.endsWith('/')) href = href.slice(0, -1);
      links.add(href);
    }
  });
  
  return Array.from(links);
}

async function scrapePage(url) {
  console.log(`📄 ${url}`);
  
  try {
    const html = await fetchWithCurl(url);
    const $ = cheerio.load(html);
    
    // Extract title
    const title = $('title').text().trim() || 
                  $('h1').first().text().trim() || 
                  'Untitled';
    
    // Extract meta description
    const description = $('meta[name="description"]').attr('content') || '';
    
    // Extract main content
    let content = '';
    const selectors = [
      'main',
      'article',
      '.content',
      '#content',
      '.main-content',
      '.entry-content',
      'body'
    ];
    
    for (const selector of selectors) {
      const $el = $(selector);
      if ($el.length > 0) {
        // Remove unwanted elements
        $el.find('script, style, nav, footer, header, .navigation, .menu, .sidebar, .comments, form').remove();
        content = $el.text();
        break;
      }
    }
    
    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    return {
      url,
      title,
      description,
      content: content.substring(0, 8000), // Increased to 8000 chars
      scrapedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function crawlSite() {
  console.log('🚀 Starting mojosells.com scrape...\n');
  console.log('=' .repeat(60));
  
  const visited = new Set();
  const pages = [];
  
  // First scrape important pages
  console.log('\n📋 Scraping important pages...\n');
  for (const url of IMPORTANT_PAGES) {
    if (!visited.has(url)) {
      visited.add(url);
      const pageData = await scrapePage(url);
      if (pageData) pages.push(pageData);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Then discover and scrape blog posts
  console.log('\n📝 Discovering blog posts...\n');
  try {
    const blogHtml = await fetchWithCurl('https://www.mojosells.com/blog/');
    const blogLinks = await extractLinks(blogHtml, BASE_URL);
    
    const blogPosts = blogLinks
      .filter(link => link.includes('/blog/') && link !== 'https://www.mojosells.com/blog')
      .slice(0, 20); // Limit to 20 blog posts
    
    console.log(`Found ${blogPosts.length} blog posts\n`);
    
    for (const url of blogPosts) {
      if (!visited.has(url)) {
        visited.add(url);
        const pageData = await scrapePage(url);
        if (pageData) pages.push(pageData);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  } catch (error) {
    console.error(`Error scraping blog: ${error.message}`);
  }
  
  // Save to JSON
  const outputPath = '../data/mojosells-pages.json';
  await writeFile(outputPath, JSON.stringify(pages, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Done! Scraped ${pages.length} pages`);
  console.log(`💾 Saved to: ${outputPath}`);
  
  // Show breakdown
  const blogCount = pages.filter(p => p.url.includes('/blog/')).length;
  const mainCount = pages.length - blogCount;
  
  console.log(`\n📊 Breakdown:`);
  console.log(`   - Main pages: ${mainCount}`);
  console.log(`   - Blog posts: ${blogCount}`);
  
  console.log('\n🎉 Scrape complete!\n');
}

crawlSite().catch(console.error);
