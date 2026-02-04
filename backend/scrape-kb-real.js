import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFile, readFile } from 'fs/promises';

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
    'troubleshooting'
  ];
}

const axiosConfig = {
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  }
};

async function scrapeCategory(category) {
  const url = `${KB_BASE}/${category}`;
  console.log(`\n📂 Scraping category: ${category}`);
  
  try {
    const { data } = await axios.get(url, axiosConfig);
    const $ = cheerio.load(data);
    
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
    const { data } = await axios.get(article.url, axiosConfig);
    const $ = cheerio.load(data);
    
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
  console.log('🚀 Starting Mojo KB scrape (real site)...\n');
  console.log('=' .repeat(60));
  
  // Start fresh
  let allArticles = [];
  
  const categories = getCategories();
  for (const category of categories) {
    const categoryArticles = await scrapeCategory(category);
    
    for (const article of categoryArticles) {
      const fullArticle = await scrapeArticle(article);
      allArticles.push(fullArticle);
      
      // Rate limit - be nice to the server
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Pause between categories
    await new Promise(resolve => setTimeout(resolve, 2000));
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
