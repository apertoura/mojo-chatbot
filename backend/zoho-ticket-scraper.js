import axios from 'axios';
import { writeFile } from 'fs/promises';

// Zoho credentials from the Django script
const ZOHO_CONFIG = {
  tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
  apiUrl: 'https://desk.zoho.com/api/v1',
  orgId: '848046498',
  clientId: '1000.0OCHPLQGAJP3P05KI6REG0FMXPEHYY',
  clientSecret: 'fe1229e477042ecd28eae7e1584df4e65874618f51',
  redirectUri: 'https://devlb.mojosells.com/login/',
  refreshToken: '1000.f432fa6aff8e6322c2ec101a992f47fc.4954657dba9d77eddc0c722647c95449',
  scope: 'Desk.tickets.ALL'
};

async function getAccessToken() {
  console.log('🔑 Getting Zoho access token...');
  
  try {
    const response = await axios.post(ZOHO_CONFIG.tokenUrl, null, {
      params: {
        grant_type: 'refresh_token',
        client_id: ZOHO_CONFIG.clientId,
        client_secret: ZOHO_CONFIG.clientSecret,
        redirect_uri: ZOHO_CONFIG.redirectUri,
        refresh_token: ZOHO_CONFIG.refreshToken,
        scope: ZOHO_CONFIG.scope
      }
    });
    
    if (response.data.access_token) {
      console.log('✅ Access token obtained');
      return response.data.access_token;
    } else {
      throw new Error('No access token in response');
    }
  } catch (error) {
    console.error('❌ Failed to get access token:', error.message);
    throw error;
  }
}

async function getTicketsList(accessToken, from = 0, limit = 100) {
  console.log(`📥 Fetching tickets (from ${from}, limit ${limit})...`);
  
  try {
    const response = await axios.get(`${ZOHO_CONFIG.apiUrl}/tickets`, {
      headers: {
        'orgId': ZOHO_CONFIG.orgId,
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      },
      params: {
        from,
        limit,
        include: 'contacts,products'
      }
    });
    
    if (response.status === 200 && response.data.data) {
      console.log(`   Found ${response.data.data.length} tickets`);
      return response.data.data;
    } else {
      console.log('   No tickets found');
      return [];
    }
  } catch (error) {
    console.error(`   ❌ Error fetching tickets: ${error.message}`);
    return [];
  }
}

async function getTicketDetails(accessToken, ticketId) {
  try {
    const response = await axios.get(`${ZOHO_CONFIG.apiUrl}/tickets/${ticketId}`, {
      headers: {
        'orgId': ZOHO_CONFIG.orgId,
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    });
    
    if (response.status === 200) {
      return response.data;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`   ⚠️  Error fetching ticket ${ticketId}: ${error.message}`);
    return null;
  }
}

async function scrapeAllTickets() {
  console.log('🎫 Starting Zoho Desk ticket scraper...\n');
  console.log('=' .repeat(60));
  
  try {
    // Get access token
    const accessToken = await getAccessToken();
    
    // Fetch all tickets in batches
    let allTickets = [];
    let from = 0;
    const limit = 100;
    let hasMore = true;
    
    while (hasMore) {
      const tickets = await getTicketsList(accessToken, from, limit);
      
      if (tickets.length === 0) {
        hasMore = false;
      } else {
        allTickets = allTickets.concat(tickets);
        from += limit;
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`\n📊 Total tickets fetched: ${allTickets.length}`);
    console.log('📝 Fetching detailed information...\n');
    
    // Get detailed info for each ticket
    const detailedTickets = [];
    for (let i = 0; i < allTickets.length; i++) {
      const ticket = allTickets[i];
      console.log(`   [${i+1}/${allTickets.length}] ${ticket.subject.substring(0, 60)}...`);
      
      const details = await getTicketDetails(accessToken, ticket.id);
      
      if (details) {
        detailedTickets.push({
          id: details.id,
          ticketNumber: details.ticketNumber,
          subject: details.subject,
          description: details.description || '',
          status: details.status,
          priority: details.priority,
          category: details.category || 'General',
          createdTime: details.createdTime,
          modifiedTime: details.modifiedTime,
          customerName: details.contact?.firstName + ' ' + details.contact?.lastName || 'Unknown',
          customerEmail: details.contact?.email || '',
          resolution: details.resolution || '',
          url: `https://desk.zoho.com/agent/mojosellingsolutions/mojo-selling-solutions/tickets/details/${details.id}/`,
          scrapedAt: new Date().toISOString()
        });
      }
      
      // Rate limit - be nice to API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Save to JSON
    const outputPath = '../data/zoho-tickets.json';
    await writeFile(outputPath, JSON.stringify(detailedTickets, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ Done! Scraped ${detailedTickets.length} tickets`);
    console.log(`💾 Saved to: ${outputPath}`);
    
    // Stats
    const statuses = {};
    const categories = {};
    detailedTickets.forEach(t => {
      statuses[t.status] = (statuses[t.status] || 0) + 1;
      categories[t.category] = (categories[t.category] || 0) + 1;
    });
    
    console.log(`\n📊 By Status:`);
    Object.keys(statuses).forEach(status => {
      console.log(`   - ${status}: ${statuses[status]} tickets`);
    });
    
    console.log(`\n📁 By Category:`);
    Object.keys(categories).forEach(cat => {
      console.log(`   - ${cat}: ${categories[cat]} tickets`);
    });
    
    console.log('\n🎉 Scrape complete!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

scrapeAllTickets();
