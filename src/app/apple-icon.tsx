import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// The ShadowForm mark for iOS home screens: a white silhouette bust on the
// warm-dark tile with a gold baseline. Built from flex/positioned divs so
// Satori can render it (no inline SVG paths).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#100e0a',
        }}
      >
        {/* head */}
        <div
          style={{
            position: 'absolute',
            left: 58,
            top: 40,
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#f5f2ec',
          }}
        />
        {/* shoulders */}
        <div
          style={{
            position: 'absolute',
            left: 22,
            top: 108,
            width: 136,
            height: 60,
            borderRadius: '68px 68px 0 0',
            background: '#f5f2ec',
          }}
        />
        {/* gold baseline */}
        <div
          style={{
            position: 'absolute',
            left: 34,
            bottom: 22,
            width: 112,
            height: 8,
            borderRadius: 4,
            background: '#ffc53d',
          }}
        />
      </div>
    ),
    { ...size },
  )
}
