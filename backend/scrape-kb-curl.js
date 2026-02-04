import { exec } from 'child_process';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import { writeFile, readFile } from 'fs/promises';

const execPromise = promisify(exec);
const KB_BASE = 'https://mojodialersupport.mojosells.com/portal/en/kb';

function getCategories() {
  return [
    'getting-started',
    'importing-and-adding-data',
    'power-dialer',
    'account-management',
    'calling-lists-and-groups',
    'action-plans',
    'calendar',
    'do-not-call',
    'emailing-from-mojo',
    'integrations',
    'reports',
    'troubleshooting',
    'f-a-q',
    'how-to-videos',
    'lead-services'
  ];
}

async function fetchWithCurl(url) {
  try {
    const { stdout } = await execPromise(`curl -s '${url}'`);
    return stdout;
  } catch (error) {
    throw new Error(`Curl failed: ${error.message}`);
  }
}

async function scrapeCategory(category) {
  const url = `${KB_BASE}/${category}`;
  console.log(`\n📂 Scraping category: ${category}`);
  
  try {
    const html = await fetchWithCurl(url);
    const $ = cheerio.load(html);
    
    const articles = [];
    
    // Find all article links in the seoBodyContent div
    $('#seoBodyContent ul li').each((i, elem) => {
      const $elem = $(elem);
      const $link = $elem.find('a');
      const articleUrl = $link.attr('href');
      const title = $link.find('h2').text().trim();
      const description = $elem.find('div span').text().trim();
      
      if (articleUrl && title) {
        articles.push({
          title,
          url: articleUrl,
          category,
          description: description || ''
        });
      }
    });
    
    console.log(`   Found ${articles.length} articles`);
    return articles;
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return [];
  }
}

async function scrapeArticle(article) {
  console.log(`   📄 ${article.title.substring(0, 60)}...`);
  
  try {
    const html = await fetchWithCurl(article.url);
    const $ = cheerio.load(html);
    
    // Extract content from seoBodyContent div
    const $content = $('#seoBodyContent');
    
    if ($content.length > 0) {
      // Get text content and clean it up
      let content = $content.text()
        .replace(/\s+/g, ' ')
        .trim();
      
      return {
        ...article,
        content,
        scrapedAt: new Date().toISOString()
      };
    }
    
    return {
      ...article,
      content: article.description || 'Content not available',
      scrapedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return {
      ...article,
      content: article.description || 'Error fetching content',
      error: error.message,
      scrapedAt: new Date().toISOString()
    };
  }
}

async function scrapeAll() {
  console.log('🚀 Starting Mojo KB scrape (using curl)...\n');
  console.log('=' .repeat(60));
  
  // Start fresh
  let allArticles = [];
  
  const categories = getCategories();
  for (const category of categories) {
    const categoryArticles = await scrapeCategory(category);
    
    for (const article of categoryArticles) {
      const fullArticle = await scrapeArticle(article);
      allArticles.push(fullArticle);
    }
  }
  
  // Save to JSON
  const outputPath = '../data/kb-articles.json';
  await writeFile(outputPath, JSON.stringify(allArticles, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Done! Total articles: ${allArticles.length}`);
  console.log(`💾 Saved to: ${outputPath}`);
  
  // Stats
  const uniqueCategories = [...new Set(allArticles.map(a => a.category))];
  console.log(`\n📊 Categories: ${uniqueCategories.length}`);
  uniqueCategories.forEach(cat => {
    const count = allArticles.filter(a => a.category === cat).length;
    console.log(`   - ${cat}: ${count} articles`);
  });
  
  console.log('\n🎉 Scrape complete!\n');
}

scrapeAll().catch(console.error);
