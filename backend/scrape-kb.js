import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFile } from 'fs/promises';

const KB_BASE = 'https://mojodialersupport.mojosells.com/portal/en/kb';

const categories = [
  'getting-started',
  'importing-and-adding-data',
  'power-dialer',
  'account-management',
  'calling-lists-and-groups',
  'action-plans',
  'calendar',
  'do-not-call',
  'emailing-from-mojo',
  'how-to-videos',
  'integrations',
  'reports',
  'lead-services',
  'troubleshooting',
  'f-a-q'
];

async function scrapeCategory(category) {
  const url = `${KB_BASE}/${category}`;
  console.log(`\n📂 Scraping category: ${category}`);
  
  try {
    const { data } = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(data);
    
    const articles = [];
    const seen = new Set();
    
    // Find all article links
    $('a').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href && href.includes('/kb/articles/')) {
        const fullUrl = href.startsWith('http') ? href : `https://mojodialersupport.mojosells.com${href}`;
        const title = $(elem).text().trim();
        
        if (title && !seen.has(fullUrl) && title.length > 3) {
          seen.add(fullUrl);
          articles.push({
            title,
            url: fullUrl,
            category
          });
        }
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
    const { data } = await axios.get(article.url, { timeout: 10000 });
    const $ = cheerio.load(data);
    
    // Try multiple selectors for content
    let content = '';
    const selectors = [
      '.article-content',
      '.ArticleBody',
      '#seoBodyContent',
      'article',
      '.kb-article-content',
      '.content-body'
    ];
    
    for (const selector of selectors) {
      const text = $(selector).text().trim();
      if (text && text.length > 100) {
        content = text;
        break;
      }
    }
    
    if (!content) {
      // Fallback: get all p tags
      const paragraphs = [];
      $('p').each((i, elem) => {
        const text = $(elem).text().trim();
        if (text.length > 20) {
          paragraphs.push(text);
        }
      });
      content = paragraphs.join('\n\n');
    }
    
    return {
      ...article,
      content: content || 'Content not available',
      scrapedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return {
      ...article,
      content: 'Error fetching content',
      error: error.message
    };
  }
}

async function scrapeAll() {
  console.log('🚀 Starting Mojo KB scrape...\n');
  console.log('=' .repeat(60));
  
  const allArticles = [];
  
  for (const category of categories) {
    const categoryArticles = await scrapeCategory(category);
    
    for (const article of categoryArticles) {
      const fullArticle = await scrapeArticle(article);
      allArticles.push(fullArticle);
      
      // Rate limit - be nice to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Brief pause between categories
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Save to JSON
  const outputPath = '../data/kb-articles.json';
  await writeFile(outputPath, JSON.stringify(allArticles, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Done! Scraped ${allArticles.length} articles`);
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
