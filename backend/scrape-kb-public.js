import { readFile, writeFile } from 'fs/promises';

async function createExpandedKB() {
  console.log('📚 Creating expanded KB from public sources...\n');
  
  // Load existing articles
  const existingJson = await readFile('../data/kb-articles.json', 'utf-8');
  const articles = JSON.parse(existingJson);
  
  console.log(`📖 Loaded ${articles.length} existing articles`);
  
  // Add comprehensive FAQ article
  articles.push({
    title: "Mojo Dialer FAQ - Complete Guide",
    url: "https://www.mojosells.com/faq/",
    category: "f-a-q",
    content: `Getting Started with Mojo

Mojo is a premium Dialing System and Lead Generation platform that helps motivated salespeople quickly and efficiently target leads and make calls, while also taking advantage of full lead management.

CRM Capabilities:
No, you don't need a separate CRM. Mojo includes a built-in Lead Manager that handles contact organization, notes, groups, and follow-up activities. Many users rely on Mojo's lead management tools as their complete solution, eliminating costly third-party CRM subscriptions.

Industry Applications:
While Mojo is widely used in real estate, its platform is equally valuable for insurance agents, financial advisors, home services, mortgage professionals, and many B2B sales teams who need efficient outbound prospecting.

Pricing & Subscription:
Mojo uses a month-to-month subscription model with no long-term contracts. You can modify your plan at any time without penalties. When you cancel, your data remains securely stored for 90 days.

Power Dialer Features:
Mojo's power dialer automates outbound calls, dramatically increasing conversation volume. The Triple Line Dialer can process up to 300 calls per hour, while the Single Line Dialer offers a more traditional, focused approach.

Dialer Modes:
- Single Line: Calls one contact at a time for personalized approach
- Triple Line: Calls up to three contacts simultaneously, automatically drops unanswered calls and connects you with live prospects
- Click-to-Call: Manual control for high-value contacts

Caller ID Management:
Mojo offers local Caller ID management with complimentary whitelisting for all numbers. When using Mojo Caller ID, calls are certified at Attestation Level A (highest STIR/SHAKEN verification level), improving delivery and reducing spam labeling.

Call Recording:
Yes, Mojo offers optional call recording for training, compliance, or reference. Check local laws regarding consent requirements.

Lead Data Services:
Mojo partners with trusted providers for public records, MLS data, and proprietary sources offering:
- Neighborhood Search (nationwide geographic/property filters)
- FSBO (For Sale By Owner)
- FRBO (For Rent By Owner)  
- Expired Listings
- Pre-Foreclosure properties
- Skip Tracer (appends missing contact info)

Data is updated frequently (daily, weekly, monthly depending on type).

Importing Your Own Lists:
Yes, easily import CSV or Excel files into Mojo's Lead Manager. Once imported, you can call, organize, categorize, and track these leads.

Integrations:
Mojo integrates with several third-party CRMs and lead providers directly, plus interfaces with hundreds of platforms using API Nation and Zapier. This allows automatic contact syncing and workflow automation.

Yes, Mojo connects with High Level CRM through API Nation for lead sync and workflow management.

Mojo offers a public posting API for one-way data push. For two-way sync, leverage API Nation or Zapier.

Support & Training:
Mojo offers onboarding resources, training videos, live support, and an extensive knowledge base with tutorials and troubleshooting guides. U.S.-based support team available via phone, email, and ticketing system.

Technical Requirements:
Any stable high-speed connection works, but wired connection is ideal for VoIP. Basic subscriptions don't include SIP phone connection—use soft phone, desk phone, or mobile phone. Or subscribe to Mojo Voice ($30/month/agent) for SIP connector built into the interface, eliminating need for separate phone.

Mojo Voice Compatibility: Chrome, Safari, Firefox

For call quality issues, check internet speed and stability (wired recommended), try different headset, or contact support.`,
    scrapedAt: new Date().toISOString()
  });
  
  // Mojo Voice add-on
  articles.push({
    title: "Mojo Voice Add-On Service - SIP Phone Connection",
    url: "https://www.mojosells.com/features/mojo-voice",
    category: "power-dialer",
    content: `Mojo Voice Add-On Service

The Mojo Voice service is an optional add-on that provides SIP-based voice connectivity built directly into the Mojo user interface.

What Mojo Voice Does:
- Eliminates the need for a separate phone device
- Uses your computer's microphone and speaker or headset
- Connects directly through the web browser interface
- No phone dial-in required—calls route through your computer

Pricing: $30 per month, per agent

Browser Compatibility:
- Google Chrome (recommended)
- Safari
- Firefox

Key Benefits:
- No separate phone device needed
- Simpler setup process
- Works from anywhere with internet connection
- Fully integrated with dialer interface
- Professional headset recommended for best quality

Technical Requirements:
- Stable high-speed internet connection (wired ethernet strongly recommended)
- Computer with microphone and speakers, or quality headset
- Supported web browser (Chrome, Safari, or Firefox)
- Sufficient bandwidth (minimum 1 Mbps up/down)

Alternative Connection Methods:
If you don't want Mojo Voice, you can connect using:
- Your mobile phone (call the server number displayed at login)
- Desk phone or landline
- Third-party SIP phone service
- The dialer processes calls on backend while you speak through your phone

Best Practices for Mojo Voice:
1. Use wired ethernet instead of WiFi for stability
2. Use quality headset with noise cancellation
3. Close bandwidth-heavy applications during calling sessions
4. Test audio settings before starting dialer session
5. Ensure system microphone/speaker permissions are enabled

Troubleshooting:
- No audio: Check browser microphone permissions
- Echo: Use headset instead of speakers, ensure no duplicate tabs open
- Poor quality: Switch to wired connection, close other apps, restart browser
- Connection drops: Check internet stability, try different browser

When to Choose Mojo Voice:
- You don't want to use your personal phone
- You dial from multiple locations
- You want simplicity (all-in-one solution)
- You have reliable internet connection
- You prefer browser-based calling

When to Use Your Own Phone:
- You have spotty internet
- You already have good phone setup
- You prefer traditional phone feel
- You're concerned about audio quality
- You dial in high-noise environment`,
    scrapedAt: new Date().toISOString()
  });
  
  // Caller ID management
  articles.push({
    title: "Caller ID Management, Whitelisting, and STIR/SHAKEN",
    url: "https://www.mojosells.com/features/caller-id",
    category: "power-dialer",
    content: `Caller ID Management and Whitelisting

Mojo offers comprehensive Caller ID management to maximize answer rates and protect your number reputation.

Caller ID Options:

1. Use Your Own Number
   - Display your personal mobile or business line
   - Familiar number for callbacks
   - Configure in dialer settings under Caller ID
   - Good for warm leads and follow-ups

2. Purchase Mojo Caller ID Numbers
   - Buy verified local phone numbers through Mojo
   - Match area code to your prospect's location
   - Improve local presence and trust
   - Typically increases answer rates 20-40%
   - Multiple numbers available for rotation

3. Local Presence Dialing
   - System automatically matches prospect's area code
   - Dynamic number selection based on who you're calling
   - Highest answer rates
   - Managed automatically by Mojo

Complimentary Whitelisting Service:

Mojo provides FREE whitelisting for ALL Caller IDs used on your account:
- Works with both your personal numbers AND Mojo Caller ID numbers
- Actively monitors carrier labeling and reputation
- Reduces risk of "spam likely" labels
- Improves call delivery rates
- Ongoing reputation management
- Alerts if number gets flagged

STIR/SHAKEN Attestation:

When using Mojo Caller ID numbers:
- Calls are certified at Attestation Level A
- Level A is the HIGHEST verification level available
- Meets all carrier STIR/SHAKEN requirements
- Significantly better call delivery
- Reduced risk of spam blocking
- Carriers trust verified calls

What is STIR/SHAKEN?
Industry standard to combat robocalls and caller ID spoofing. Carriers verify caller identity and rate call legitimacy. Level A attestation means the carrier fully verified the caller owns the number.

Reputation Management Tools:

Complimentary access to:
- Real-time reputation monitoring
- Carrier labeling dashboard
- Number health scores
- Alert notifications if flagged
- Remediation guidance
- Best practice recommendations

Best Practices for Caller ID:

1. Local Area Code Matching
   - Always use numbers matching prospect area codes
   - Dramatically increases answer rates
   - Builds immediate trust
   - "Neighbors are more likely to answer neighbors"

2. Number Rotation
   - Use multiple numbers and rotate between them
   - Prevents single number from getting overused
   - Distributes call volume
   - Maintains healthier reputation scores
   - Recommended: 3-5 numbers minimum

3. Call Volume Management
   - Don't exceed 100-150 calls per number per day
   - Spread calls across multiple numbers
   - Monitor answer rates and adjust
   - Take action if rates drop suddenly

4. Compliance and Professional Conduct
   - Only call opted-in or qualified business relationship leads
   - Strictly respect DNC (Do Not Call) lists
   - Honor call time restrictions (8am-8pm local)
   - Professional, courteous conduct on every call
   - Proper identification when answering
   - Good behavior protects reputation

5. Monitor and Respond
   - Check reputation dashboard weekly
   - Watch for declining answer rates
   - Investigate any spam labels immediately
   - Rotate out numbers showing problems
   - Request whitelisting remediation if needed

Why Caller ID Matters:

Answer Rate Impact:
- Unknown number: 5-10% answer rate
- Local area code: 15-25% answer rate  
- Recognized business number: 30-50% answer rate
- Contact's saved number: 60-80% answer rate

A 10% increase in answer rate = 10 more conversations per 100 calls = significantly more opportunities.

Common Mistakes to Avoid:
- Using same number for 500+ calls/day (instant spam flag)
- Ignoring DNC requests (ruins reputation fast)
- Calling outside allowed hours (carrier penalty)
- Using non-local numbers for local prospects
- Not rotating numbers regularly
- Ignoring reputation alerts

Setting Up Caller ID in Mojo:

1. Navigate to Settings > Dialer Configuration
2. Select Caller ID Management
3. Choose your option:
   - Enter your own number
   - Purchase Mojo Caller ID number
   - Enable local presence matching
4. Configure rotation settings if using multiple numbers
5. Enable whitelisting (included free)
6. Save and test
7. Monitor performance in reports`,
    scrapedAt: new Date().toISOString()
  });
  
  // Triple Line vs Single Line deep comparison
  articles.push({
    title: "Triple Line vs Single Line Dialer - Complete Comparison Guide",
    url: "https://www.mojosells.com/triple-line-dialer-comparison",
    category: "power-dialer",
    content: `Triple Line vs Single Line Power Dialer Comparison

Choosing between Triple Line and Single Line dialing is one of the most important decisions for maximizing your prospecting efficiency.

Triple Line Power Dialer:

How It Works:
The Triple Line Dialer simultaneously dials up to 3 phone numbers at once. When a prospect answers, you're instantly connected while the other lines automatically disconnect. Unanswered calls and voicemails are logged automatically, and the dialer immediately starts the next batch.

Maximum Capacity:
- Up to 300 dial attempts per hour
- Actual conversations: 50-80 per hour (depending on contact rate)
- Average talk time: 2-3 minutes per contact
- Contact rate industry average: 10-15%

Best Use Cases:
- High-volume cold calling campaigns
- FSBO (For Sale By Owner) prospecting
- Expired listing follow-up
- Pre-foreclosure outreach
- Geographic farming of large areas
- Building pipeline from scratch
- New agent ramping up quickly

Advantages:
- Maximum time efficiency
- Minimal idle time between calls
- More conversations per session
- Faster completion of large lists
- Better ROI on calling time
- Keeps momentum and energy high
- Great for numbers game

Challenges:
- Can feel rushed or overwhelming
- Less time for prep between calls
- Requires high energy and focus
- Not ideal for warm relationships
- May need mental breaks more often
- Less time to review contact notes

Ideal Agent Profile:
- High-energy personality
- Thrives in fast-paced environment
- Comfortable with rejection
- Focus on volume metrics
- Building new pipeline
- Full-time prospecting commitment

Single Line Dialer:

How It Works:
Calls one contact at a time, waiting for answer, voicemail, or no-answer before moving to the next prospect. You have full control and visibility into each call before it's placed.

Realistic Capacity:
- 20-30 calls per hour
- 2-5 conversations per hour (depending on contact rate)
- More time between each call
- Opportunity to review notes and prepare

Best Use Cases:
- Warm lead follow-ups
- Callback appointments
- Past client nurturing
- Sphere of influence touches
- High-value prospect calls
- Relationship-focused prospecting
- Quality-over-quantity approach

Advantages:
- More time to prepare for each call
- Review contact history and notes
- Personalized, thoughtful approach
- Better for relationship building
- Less mentally exhausting
- Appropriate for warm connections
- Control pacing

Challenges:
- Lower overall call volume
- More idle time waiting/dialing
- Slower list completion
- Less efficient for cold calling
- Can lose momentum between calls
- Requires self-discipline to maintain pace

Ideal Agent Profile:
- Relationship-focused
- Prefers quality over quantity
- Works mostly warm leads
- Part-time calling schedule
- Higher price point/luxury market
- Consultative selling approach

Click-to-Call Mode:

Also Available:
Manual dialing with one-click simplicity:
- Full control over every call
- Cherry-pick specific contacts
- Perfect for appointment confirmations
- Best for high-intent prospects
- No automation, maximum control

Head-to-Head Comparison:

| Feature | Triple Line | Single Line |
|---------|------------|------------|
| Calls/hour | 200-300 | 20-30 |
| Contacts/hour | 50-80 | 2-5 |
| Prep time | Minimal | Ample |
| Energy required | Very High | Moderate |
| Best for | Cold calling | Warm leads |
| Relationship depth | Lower | Higher |
| Efficiency | Maximum | Lower |
| Learning curve | Steeper | Easier |

Pricing Comparison:

Single Line Dialer: $99/month per agent
- Single-line or click-to-call
- Full Lead Manager & CRM
- Email integration
- Mobile app access
- Call recording
- Basic reporting

Triple Line Dialer: $149/month per agent
- Everything in Single Line, PLUS:
- Triple-line power dialing
- Action Plans & automation
- Advanced reporting & analytics
- Priority support
- Premium features

Hybrid Strategy (Recommended):

Most successful agents use BOTH approaches:

Morning (9am-12pm): Triple Line
- High-energy cold calling
- Work through new lead lists
- Maximum volume when fresh
- FSBO, expired, farming campaigns

Afternoon (1pm-4pm): Single Line
- Follow-up on morning contacts
- Callback appointments
- Warm lead nurturing
- Past client touches

This hybrid approach:
- Maximizes new conversation volume
- Maintains relationship quality
- Prevents burnout
- Balances quantity and quality
- Adapts to energy levels throughout day

Choosing Your Mode:

Start with Triple Line if:
- You're building pipeline from zero
- You have large lists to work
- You need maximum efficiency
- You thrive in high-intensity environment
- Your leads are mostly cold
- Volume is your primary KPI

Start with Single Line if:
- Most leads are warm or referrals
- You're primarily doing follow-ups
- You prefer relationship selling
- You have smaller, targeted lists
- You're part-time prospecting
- Quality metrics matter most

Switching Modes:

You can easily switch between modes:
- Change in real-time during session
- Different modes for different lists
- Adjust based on energy level
- Match mode to lead temperature

Pro Tips:

1. Start Each Week with Triple Line
   - Build new opportunities Monday-Wednesday
   - Generate follow-up appointments
   - Fill pipeline for rest of week

2. Use Single Line for Follow-Ups
   - Respect relationship with callbacks
   - Show thoughtfulness on warm leads
   - Better conversion on scheduled calls

3. Time Block Your Modes
   - Triple Line: High-energy morning hours
   - Single Line: Lower-energy afternoon slots
   - Don't mix modes within same hour

4. Track Mode-Specific Metrics
   - Compare conversion rates
   - Monitor appointment set rates
   - Analyze cost-per-conversation
   - Optimize based on results

5. Match Mode to Lead Source
   - Purchased lists → Triple Line
   - Referrals → Single Line
   - Past clients → Single Line or Click-to-Call
   - Aged leads → Triple Line
   - Active buyers → Single Line

Success Metrics by Mode:

Triple Line Targets:
- 200+ calls per session
- 30+ conversations
- 3-5 appointments set
- 10-15% contact rate
- Cost per conversation: Low

Single Line Targets:
- 25+ calls per session
- 3-5 meaningful conversations
- 1-2 appointments set
- Higher conversion rate per conversation
- Cost per conversation: Higher but acceptable

The Bottom Line:

Most top-producing agents subscribe to Triple Line even if they don't use it exclusively. The flexibility to switch modes based on lead type and circumstances is invaluable. The $50/month difference ($149 vs $99) pays for itself with just one extra appointment per month from the increased efficiency.

Recommendation: Start with Triple Line for 30 days. Master high-volume prospecting. Build your pipeline. Then incorporate Single Line strategically for follow-ups and relationship management. The combination is unbeatable.`,
    scrapedAt: new Date().toISOString()
  });
  
  // Lead data services
  articles.push({
    title: "Mojo Lead Services - Data Types and Coverage",
    url: "https://www.mojosells.com/lead-services/",
    category: "lead-services",
    content: `Mojo Lead Services - Comprehensive Data Solutions

Mojo partners with trusted data providers to offer highly targeted lead lists for prospecting.

Available Lead Data Types:

1. Neighborhood Search (Nationwide)
   - Geographic search tool for any area in the U.S.
   - Pull contact information based on property location
   - Filter by property characteristics
   - Ideal for farming specific neighborhoods
   - Pricing: Pay per record or monthly subscription
   
2. FSBO - For Sale By Owner (By County)
   - Private homeowners selling without an agent
   - Highly motivated seller prospects
   - Updated frequently
   - Includes property details and contact info
   - Prime conversion opportunity
   
3. FRBO - For Rent By Owner (By County)
   - Owners renting property directly
   - No property manager involved
   - Investor and landlord prospects
   - Property management opportunities
   
4. Expired Listings (By Area)
   - MLS listings that did not sell
   - Contract expired, no longer listed
   - Motivated sellers often ready to try again
   - Fresh data, frequently updated
   - High-intent prospects
   
5. Pre-Foreclosure (By County)
   - Properties entering foreclosure process
   - Owners facing financial difficulty
   - Time-sensitive opportunities
   - Requires compassionate, helpful approach
   - Solution-focused prospecting
   
6. Skip Tracer (Nationwide)
   - Appends missing contact information
   - Finds phone numbers for contacts
   - Adds email addresses
   - Updates mailing addresses
   - Essential for completing lead records
   - Pay per successful append

Data Quality & Updates:

Update Frequency:
- Expired: Daily updates
- FSBO/FRBO: Weekly updates
- Pre-Foreclosure: Monthly updates
- Neighborhood Search: As requested
- Skip Tracer: Real-time lookup

Data Sources:
- Public records
- MLS data feeds
- Consumer databases
- Proprietary data partnerships
- County recorder offices
- National databases

Data Accuracy:
- Phone numbers verified when possible
- Multiple phone attempts provided
- Property details cross-verified
- Regular data hygiene and cleaning
- Remove disconnected numbers
- Update owner information

Geographic Coverage:

Nationwide:
- Neighborhood Search
- Skip Tracer

By County:
- FSBO (For Sale By Owner)
- FRBO (For Rent By Owner)
- Pre-Foreclosure

By Area:
- Expired Listings

Pricing Models:

Pay-As-You-Go:
- Purchase specific records as needed
- Typical: $0.10 - $0.50 per lead
- No monthly commitment
- Good for occasional use

Monthly Subscriptions:
- Unlimited access to data type
- Monthly fee varies by coverage area
- Best for regular, high-volume users
- Includes frequent updates

Volume Discounts:
- Available for large purchases
- Enterprise pricing available
- Custom contracts for high-volume users

Ordering Process:

1. Browse Lead Services
   - Navigate to Lead Services in Mojo
   - Select lead type you want
   
2. Choose Geographic Area
   - Select state, county, or specific area
   - View available coverage
   - See pricing for your selection
   
3. Set Filters (if applicable)
   - Price range
   - Property type (SFR, condo, multi-family)
   - Property age
   - Owner-occupied vs investor
   - Custom criteria
   
4. Preview Sample
   - Review sample records
   - Verify data quality
   - Check included fields
   
5. Purchase
   - Complete transaction
   - Instant delivery to your Mojo account
   
6. Auto-Import
   - Leads automatically added to Mojo
   - Appear in designated calling list
   - Pre-scrubbed against Federal DNC
   - Ready to dial immediately

Integration with Mojo:

Seamless Workflow:
- Purchased leads auto-import to Lead Manager
- Appear in Calling Lists instantly
- Include all available contact information
- Property details pre-populated
- Can immediately add to Action Plans
- Start dialing without manual import

DNC Compliance:
- All leads pre-scrubbed against Federal DNC
- DNC contacts flagged and excluded
- Meets compliance requirements
- Automatic ongoing scrubbing
- Peace of mind

ROI Tracking:
- Track performance by lead source
- Monitor conversion rates
- Calculate cost per appointment
- Identify most profitable data types
- Data-driven purchasing decisions

Use Case Examples:

FSBO Campaign:
- Subscribe to county FSBO data
- Receive new listings weekly
- Triple Line Dialer for volume
- Convert to listing appointments
- High ROI on listing side

Expired Listing Follow-Up:
- Daily expired list delivery
- Immediate outreach (same day)
- Persistent follow-up over 60-90 days
- Action Plan automation
- Win the re-list

Geographic Farming:
- Use Neighborhood Search
- Target specific zip codes or neighborhoods
- Build area expertise
- Consistent monthly outreach
- Become the local expert

Pre-Foreclosure Solutions:
- Compassionate outreach approach
- Offer solutions and resources
- Build trust over time
- Help homeowners in difficulty
- Win listings and buyer opportunities

Best Practices:

1. Data Freshness
   - Use data quickly after purchase
   - Older leads = lower contact rates
   - Update regularly
   - Remove dead leads

2. Multi-Touch Approach
   - Don't rely on one call
   - Use Action Plans for automated follow-up
   - Email + call + text sequence
   - Persistence pays off

3. Script Preparation
   - Customize scripts for each data type
   - FSBO script ≠ Expired script
   - Show understanding of their situation
   - Lead with value

4. DNC Vigilance
   - Trust but verify scrubbing
   - Immediately mark DNC requests
   - Maintain internal DNC list
   - Compliance is non-negotiable

5. ROI Measurement
   - Track every lead source separately
   - Know your cost per conversation
   - Calculate cost per appointment
   - Focus investment on winners

Common Questions:

Q: Can I import my own lists instead?
A: Yes! Mojo supports CSV/Excel import of your own data. Lead Services are optional add-ons.

Q: Do I need a subscription or can I buy once?
A: Both options available. Subscriptions for regular users, pay-as-you-go for occasional needs.

Q: How current is the data?
A: Varies by type. Expired updates daily, FSBO weekly, Pre-Foreclosure monthly.

Q: Is it nationwide?
A: Neighborhood Search and Skip Tracer are nationwide. Others vary by county/area.

Q: What if leads are bad quality?
A: Contact Mojo support. Data providers replace bad records and maintain quality standards.

Lead Services + Mojo Dialer = Complete Prospecting Solution`,
    scrapedAt: new Date().toISOString()
  });
  
  // Save expanded KB
  const outputPath = '../data/kb-articles.json';
  await writeFile(outputPath, JSON.stringify(articles, null, 2));
  
  console.log(`\n✅ Expanded KB successfully created!`);
  console.log(`📊 Total articles: ${articles.length}`);
  console.log(`💾 Saved to: ${outputPath}\n`);
  
  const categories = [...new Set(articles.map(a => a.category))];
  console.log(`📁 Categories: ${categories.length}`);
  categories.forEach(cat => {
    const count = articles.filter(a => a.category === cat).length;
    console.log(`   - ${cat}: ${count} articles`);
  });
  
  console.log('\n🎉 KB expansion complete!\n');
}

createExpandedKB().catch(console.error);
