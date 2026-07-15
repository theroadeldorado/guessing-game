export interface Sport {
  id: string
  label: string
}

export interface Player {
  id: string          // kebab-case, e.g. "dan-marino"
  name: string        // display name, e.g. "Dan Marino"
  sportId: string     // "nfl-qb"
  era: string         // hint 1, e.g. "1980s–1990s"
  teams: string[]     // hint 2, primary teams, e.g. ["Dolphins"]
  yearsActive: string // reveal card, e.g. "1983–1999"
  inPool: boolean     // true = has a clip, eligible as an answer
}

export interface Clip {
  id: string          // e.g. "dan-marino-01"
  playerId: string
  src: string         // "/clips/<id>.webm" or "placeholder"
}
