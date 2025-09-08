type Props = { data: number[]; width?: number; height?: number; stroke?: string }

export default function Sparkline({ data, width = 160, height = 48, stroke = '#334155' }: Props) {
  if (!data?.length) return null
  const min = Math.min(...data), max = Math.max(...data)
  const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min))
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - norm(v) * height
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} />
    </svg>
  )
}

