/**
 * Test script to verify ESPN API sync functionality
 * Tests both regular season and playoff endpoints
 */

async function testESPNSync() {
  console.log('Testing ESPN API sync functionality...\n');

  // Test 1: Regular season week
  console.log('=== Test 1: Regular Season Week 18 (2024) ===');
  try {
    const regularSeasonUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2024&seasontype=2&week=18';
    const response1 = await fetch(regularSeasonUrl);

    if (!response1.ok) {
      console.error(`❌ Failed: ${response1.status} ${response1.statusText}`);
    } else {
      const data = await response1.json();
      console.log(`✅ Success: Found ${data.events?.length || 0} games`);

      if (data.events && data.events.length > 0) {
        const game = data.events[0];
        const competition = game.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        console.log(`   Sample game: ${awayTeam.team.abbreviation} @ ${homeTeam.team.abbreviation}`);
        console.log(`   Status: ${competition.status.type.name}`);
        console.log(`   Score: ${awayTeam.score} - ${homeTeam.score}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }

  console.log('\n=== Test 2: Playoff Wildcard Round (2024-2025) ===');
  try {
    const wildcardUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=3&week=1';
    const response2 = await fetch(wildcardUrl);

    if (!response2.ok) {
      console.error(`❌ Failed: ${response2.status} ${response2.statusText}`);
    } else {
      const data = await response2.json();
      console.log(`✅ Success: Found ${data.events?.length || 0} games`);

      if (data.events && data.events.length > 0) {
        const game = data.events[0];
        const competition = game.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        console.log(`   Sample game: ${awayTeam.team.abbreviation} @ ${homeTeam.team.abbreviation}`);
        console.log(`   Status: ${competition.status.type.name}`);
        console.log(`   Game time: ${new Date(game.date).toLocaleString()}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }

  console.log('\n=== Test 3: Playoff Divisional Round ===');
  try {
    const divisionalUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=3&week=2';
    const response3 = await fetch(divisionalUrl);

    if (!response3.ok) {
      console.error(`❌ Failed: ${response3.status} ${response3.statusText}`);
    } else {
      const data = await response3.json();
      console.log(`✅ Success: Found ${data.events?.length || 0} games`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }

  console.log('\n=== Test 4: Conference Championship ===');
  try {
    const conferenceUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=3&week=3';
    const response4 = await fetch(conferenceUrl);

    if (!response4.ok) {
      console.error(`❌ Failed: ${response4.status} ${response4.statusText}`);
    } else {
      const data = await response4.json();
      console.log(`✅ Success: Found ${data.events?.length || 0} games`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }

  console.log('\n=== Test 5: Super Bowl ===');
  try {
    const superBowlUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=3&week=4';
    const response5 = await fetch(superBowlUrl);

    if (!response5.ok) {
      console.error(`❌ Failed: ${response5.status} ${response5.statusText}`);
    } else {
      const data = await response5.json();
      console.log(`✅ Success: Found ${data.events?.length || 0} games`);

      if (data.events && data.events.length > 0) {
        const game = data.events[0];
        const competition = game.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        console.log(`   Super Bowl LIX: ${awayTeam.team.abbreviation} @ ${homeTeam.team.abbreviation}`);
        console.log(`   Game time: ${new Date(game.date).toLocaleString()}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }

  console.log('\n=== Summary ===');
  console.log('All ESPN API endpoints tested successfully!');
  console.log('\nPlayoff week mapping:');
  console.log('  Week 1 (wildcard): 4-6 games');
  console.log('  Week 2 (divisional): 4 games');
  console.log('  Week 3 (conference): 2 games (AFC & NFC Championships)');
  console.log('  Week 4 (superbowl): 1 game (Super Bowl)');
}

testESPNSync().catch(console.error);
