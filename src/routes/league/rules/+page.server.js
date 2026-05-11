import { createClient } from '$lib/server/db.js';

const INITIAL_SECTIONS = [
  {
    section_num: '01', section_title: 'League Overview', sort_order: 1,
    entries: [
      { type: 'rule', rule_key: '1.1', title: 'Name & Identity', body: 'The official league name is Down Bad for Ghost. In casual conversation, text, and group chats, the league may be referred to simply as Down Bad. Both names are recognized as referring to the same league.' },
      { type: 'rule', rule_key: '1.2', title: 'Format', body: 'Down Bad is a redraft league. All rosters reset at the end of each season. No players, contracts, or draft capital carry over year to year. Every season is a clean slate.' },
      { type: 'rule', rule_key: '1.3', title: 'Entry & Cost', body: 'This is a free league. There is no buy-in, entry fee, or prize pool unless unanimously agreed upon by all active managers before the season begins. Any mid-season financial agreements require unanimous consent.' },
    ]
  },
  {
    section_num: '02', section_title: 'Platform & Community', sort_order: 2,
    entries: [
      { type: 'rule', rule_key: '2.1', title: 'Official Platform — Sleeper (Football)', body: "The fantasy football league is hosted on Sleeper. Every manager must have an active Sleeper account to participate in the football league. League invitations, rosters, scoring, waivers, trades, and standings are all handled through the app. If you don't have Sleeper, get it before the draft — not during." },
      { type: 'rule', rule_key: '2.2', title: 'Official Platform — ESPN (All Other Leagues)', body: 'All additional sport leagues (basketball, baseball, etc.) are hosted on ESPN Fantasy. Managers participating in any non-football Down Bad league must also have an active ESPN account. Both apps are required for full community participation. There is no workaround — download both, make accounts, done.' },
      { type: 'rule', rule_key: '2.3', title: 'Group Chat Requirement', body: "Participation in the Down Bad group chat is mandatory. Joining the group chat is a condition of membership — not optional. The group chat is the primary channel for league announcements, scheduling, trash talk, and general communication. A manager who leaves, mutes, or goes persistently silent in the group chat without explanation may have their spot reviewed by the Commissioner. You don't have to be chatty. You do have to be present." },
      { type: 'rule', rule_key: '2.4', title: 'Additional Sport Leagues', body: "Down Bad runs additional fantasy leagues for other sports throughout the year on ESPN. These leagues operate under the same community standards and Commissioner authority as the football league. Participation is encouraged but not required unless otherwise stated. Sport-specific rules will be communicated by the Commissioner before each league's draft or start date." },
      { type: 'rule', rule_key: '2.5', title: 'Prediction Pools & Bracket Contests', body: "The Commissioner may organize occasional prediction pools and bracket contests throughout the year — including but not limited to playoff prediction pools and March Madness brackets. These are run at the Commissioner's discretion and may or may not involve a buy-in (communicated in advance). They are open to all active community members. The same character standards apply. Platform and format for each pool will be announced when relevant." },
    ]
  },
  {
    section_num: '03', section_title: 'Membership & Vetting', sort_order: 3,
    entries: [
      { type: 'callout', variant: 'warning', label: '⚠ Commissioner Authority', body: "The Commissioner reserves the right to deny or revoke membership at any time if the Character Clause (§ 3.3) is violated or if the vetting process (§ 3.2) raises legitimate concerns. This is not subject to manager vote." },
      { type: 'rule', rule_key: '3.1', title: 'Open Spots', body: 'When a roster spot opens up, the Commissioner will identify and invite a replacement. Returning managers have priority over new ones. All open spots must be filled before the draft.' },
      { type: 'rule', rule_key: '3.2', title: 'New Member Vetting', body: "Any new prospective member must formally acknowledge and consent to a background/character vetting process conducted by the Commissioner and Assistant Commissioner prior to joining. This is non-negotiable. By accepting a league invitation, new members confirm their consent. The Commissioner may investigate the prospective member through whatever reasonable means are available to determine whether they are a good fit for the league community. The Commissioner's decision is final." },
      { type: 'rule', rule_key: '3.3', title: 'The Character Clause', body: "All managers — new and returning — are expected to conduct themselves with basic human decency. This means: no harassment of other managers, no bigotry of any kind, no deliberately toxic or threatening behavior. Membership in Down Bad is a privilege, not a right. The Commissioner may remove any manager, mid-season or otherwise, who is found to be in serious violation of this clause. The affected manager forfeits their spot with no appeal process." },
      { type: 'rule', rule_key: '3.4', title: 'Trash Talk', body: 'Trash talk is part of the game and is encouraged. There is a meaningful difference between friendly competitive ribbing and actual harassment — the Commissioner makes that call. Know the difference.' },
      { type: 'rule', rule_key: '3.5', title: 'Sense of Humor — Required', body: "Down Bad has a culture of good-natured ribbing and dark humor. None of it is personal, none of it crosses a line, and all of it is part of what makes this community worth being in. New and returning members alike are expected to come equipped with a sense of humor and thick enough skin to participate. If a joke lands at your expense, the correct response is a better joke back — not a report to HR. As a standing example: it is an established and beloved tradition to regularly mock the Commissioner for his inability to get a date and his truly remarkable track record of being left on read. This is the tone. Embrace it." },
    ]
  },
  {
    section_num: '04', section_title: 'The Draft', sort_order: 4,
    entries: [
      { type: 'rule', rule_key: '4.1', title: 'Draft Format', body: 'The draft is a snake draft. Draft order reverses each round (e.g., the manager who picks first in Round 1 picks last in Round 2, first again in Round 3, and so on).' },
      { type: 'rule', rule_key: '4.2', title: 'Draft Timing', body: "The draft takes place in August or September, prior to the NFL regular season. The Commissioner sets the exact date and time. All managers are expected to be present and active. The date will be announced with at least two weeks' notice." },
      { type: 'rule', rule_key: '4.3', title: 'Draft Order', body: 'Draft order is determined randomly before the draft. The Commissioner will communicate the method (randomizer, live draw, etc.) in advance. All managers have an equal chance of any pick position.' },
      { type: 'rule', rule_key: '4.4', title: 'Auto-Pick Policy', body: "If a manager misses their pick window, the platform's auto-pick function will select for them. The Commissioner is not responsible for auto-drafted rosters. It is each manager's responsibility to be present. Repeated auto-picks may be grounds for replacement the following season." },
      { type: 'rule', rule_key: '4.5', title: 'Draft Picks Are Final', body: "Once a pick is submitted, it is final. No take-backs, no exceptions. Accidental picks due to platform errors may be reviewed by the Commissioner, whose ruling is final." },
    ]
  },
  {
    section_num: '05', section_title: 'Roster & Lineups', sort_order: 5,
    entries: [
      { type: 'rule', rule_key: '5.1', title: 'Lineup Deadlines', body: 'Managers are responsible for setting their own lineups before the NFL game kickoffs each week. The platform will lock players at their respective game times. It is your responsibility — no exceptions, no sympathy.' },
      { type: 'rule', rule_key: '5.2', title: 'Sitting Players / Tanking', body: 'Managers are expected to field their best available lineup every week. Deliberately starting injured or inactive players to lose — especially to influence playoff seeding or help a friend — is a violation of competitive integrity and may result in a penalty at the Commissioner\'s discretion.' },
      { type: 'rule', rule_key: '5.3', title: 'Waivers & Free Agency', body: "Waiver rules (order, FAAB vs. priority, etc.) will be set by the Commissioner before the season and communicated to all managers. These may carry over or reset year to year at the Commissioner's discretion." },
    ]
  },
  {
    section_num: '06', section_title: 'Trades', sort_order: 6,
    entries: [
      { type: 'rule', rule_key: '6.1', title: 'Trade Review', body: "Trades are reviewed by the Commissioner and/or a league vote (method TBD by the Commissioner before the season). The purpose of review is to catch collusion, not to punish bad deals. Lopsided trades are not automatically vetoed — managers have the right to make bad decisions." },
      { type: 'rule', rule_key: '6.2', title: 'Anti-Collusion', body: "Trading players to deliberately benefit a friend or harm a rival outside the bounds of legitimate competition is collusion and is subject to immediate reversal and potential removal from the league. The Character Clause (§ 3.3) applies." },
      { type: 'rule', rule_key: '6.3', title: 'Trade Deadline', body: 'A trade deadline will be set by the Commissioner prior to or during the season. No trades are processed after the deadline. The deadline will be communicated clearly to all managers.' },
    ]
  },
  {
    section_num: '07', section_title: 'Playoffs & Standings', sort_order: 7,
    entries: [
      { type: 'rule', rule_key: '7.1', title: 'Playoff Structure', body: 'The playoff bracket, number of teams, and seeding method will be set by the Commissioner before the season and communicated to all managers. Standard tiebreakers apply (points for, head-to-head record, etc.) unless otherwise specified.' },
      { type: 'rule', rule_key: '7.2', title: 'Championship', body: 'The league champion is the manager who wins the final playoff matchup. Since this is a free league, the prize is bragging rights — which, frankly, matter more.' },
    ]
  },
  {
    section_num: '08', section_title: 'Commissioner Authority', sort_order: 8,
    entries: [
      { type: 'callout', variant: 'note', label: 'Note', body: "The Commissioner runs this league. Decisions made in good faith to preserve competitive integrity and community standards are final. This is not a democracy — it's a benevolent dictatorship with good vibes." },
      { type: 'rule', rule_key: '8.1', title: 'Scope of Authority', body: 'The Commissioner has final say on: membership, rule interpretation, trade review, disputes, and any situation not explicitly covered by this rulebook. The Commissioner may establish supplemental rules during the season with reasonable notice.' },
      { type: 'rule', rule_key: '8.2', title: 'Disputes', body: "All disputes must be brought to the Commissioner. Managers may not take matters into their own hands (e.g., contacting the platform's support to reverse decisions). The Commissioner's ruling closes the dispute." },
      { type: 'rule', rule_key: '8.3', title: 'Rule Changes', body: 'Rules may be updated before each season begins. Mid-season rule changes require a majority vote of active managers unless they pertain to character/conduct issues, which remain under sole Commissioner authority.' },
    ]
  },
  {
    section_num: '09', section_title: 'Amendments & Catch-Alls', sort_order: 9,
    entries: [
      { type: 'rule', rule_key: '9.1', title: 'Gaps in the Rules', body: "Situations not covered by this rulebook are resolved at the Commissioner's discretion, guided by the spirit of fair competition and community integrity." },
      { type: 'rule', rule_key: '9.2', title: 'Acceptance of Rules', body: "Participating in the draft or accepting a league invitation constitutes full acceptance of this rulebook and all Commissioner decisions made under it. No signed contract required — your lineup is your signature." },
      { type: 'highlight', variant: 'highlight', label: 'The Spirit of the League', body: "Have fun. Don't be weird. Set your lineup. And remember: we're all Down Bad together." },
    ]
  },
];

export async function load({ parent }) {
  const { profile } = await parent();

  const db = await createClient();
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS rulebook_sections (
        id SERIAL PRIMARY KEY,
        section_num TEXT NOT NULL UNIQUE,
        section_title TEXT NOT NULL,
        entries JSONB NOT NULL DEFAULT '[]',
        sort_order INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const countRes = await db.query('SELECT COUNT(*) AS count FROM rulebook_sections');
    if (parseInt(countRes.rows[0].count) === 0) {
      for (const s of INITIAL_SECTIONS) {
        await db.query(
          `INSERT INTO rulebook_sections (section_num, section_title, entries, sort_order)
           VALUES ($1, $2, $3, $4) ON CONFLICT (section_num) DO NOTHING`,
          [s.section_num, s.section_title, JSON.stringify(s.entries), s.sort_order]
        );
      }
    }

    const result = await db.query(
      'SELECT * FROM rulebook_sections ORDER BY sort_order ASC, section_num ASC'
    );

    return { sections: result.rows, profile };
  } catch (e) {
    console.error('rulebook load error:', e);
    return { sections: [], profile };
  } finally {
    await db.end();
  }
}
