import type { Player } from '@/lib/types'

/** The scouting report: era unlocks after one wrong guess, teams after two. */
export default function HintChips({ player, level }: { player: Player; level: number }) {
  const chips = [
    { label: 'Era', value: player.era, unlocked: level >= 1 },
    { label: 'Teams', value: player.teams.join(' · '), unlocked: level >= 2 },
  ]
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-soft">
        Scouting report
      </p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <span
            key={c.label}
            className={`rounded-sm border px-3 py-1 text-sm ${
              c.unlocked ? 'border-paper/40 text-paper' : 'border-chalk text-chalk-soft opacity-60'
            }`}
          >
            {c.unlocked ? `${c.label}: ${c.value}` : `🔒 ${c.label}`}
          </span>
        ))}
      </div>
    </div>
  )
}
