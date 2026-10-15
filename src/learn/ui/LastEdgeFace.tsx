const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`

/** A side face: solved upper rows, ignored bottom corners, emphasized bottom edge. */
export default function LastEdgeFace({ edgeColor, label, x, y, width = 112, height = 108, highlight = true }: {
  edgeColor: number; label: string
  x?: number; y?: number; width?: number | string; height?: number | string
  highlight?: boolean
}) {
  return <svg x={x} y={y} viewBox="0 0 112 108" width={width} height={height === 'auto' ? undefined : height} role="img" aria-label={label} style={{ overflow: 'visible', height: height === 'auto' ? 'auto' : undefined }}>
    <title>{label}</title>
    {Array.from({ length: 9 }, (_, i) => {
      if (i === 7) return null
      return <rect key={i} x={14 + i % 3 * 31} y={7 + Math.floor(i / 3) * 31} width="26" height="26" rx="3"
        fill="#64748b" stroke="var(--rb-border-strong)" />
    })}
    <rect x={highlight ? 43 : 45} y={highlight ? 67 : 69} width={highlight ? 30 : 26} height={highlight ? 30 : 26} rx="4" fill={hex(edgeColor)} stroke={highlight ? 'var(--rb-accent-link)' : 'var(--rb-border-strong)'} strokeWidth={highlight ? 2.5 : 1}
      style={{ filter: highlight ? 'drop-shadow(0 0 4px var(--rb-accent-link))' : undefined }} />
  </svg>
}
