export interface Sport {
  id: string             // "nfl-qb", "golf"
  label: string          // "NFL Quarterbacks"
  athleteNoun: string    // "QB", singular, used in the header counter
  athleteNounPlural: string // "QBs", used in share text and game over
  emoji: string          // "🏈", leads the share text
  detailLabel: string    // label for hint 2: "Teams" for QBs, "Country" for golfers
  inputPlaceholder: string // "Name the QB…"
  active: boolean        // false = back burner: hidden from the game, data kept
}

export interface Player {
  id: string          // kebab-case, e.g. "dan-marino"
  name: string        // display name, e.g. "Dan Marino"
  sportId: string     // must match a Sport id
  era: string         // hint 1, e.g. "1980s–1990s"
  detail: string[]    // hint 2, sport-specific: teams for QBs, country for golfers
  yearsActive: string // reveal card, e.g. "1983–1999"
  inPool: boolean     // true = has a clip, eligible as an answer
}

export interface Clip {
  id: string          // e.g. "dan-marino-01"
  playerId: string
  src: string         // "/clips/<id>.webm" or "placeholder"
  speed?: number      // playbackRate approximating real time (source footage
                      // is usually slow-mo); defaults to 4 when absent
  crop?: string       // render-time framing: "auto" or "cx,cy,zoom" (see lib/crop)
}
