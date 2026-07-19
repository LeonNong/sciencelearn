export default function Loader({ className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 32 32" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="3">
        <clipPath id="ring-clip">
          <polygon points="0 0,32 0,32 32,0 32,0 30,14 16.1,0 16.1" />
        </clipPath>
        <g transform="rotate(90,16,16)">
          <g opacity="0.2">
            <circle r="3" cx="6.5" cy="16" strokeDasharray="14.737 4.712" />
            <circle r="9.5" cx="19" cy="16" clipPath="url(#ring-clip)" />
          </g>
          <g strokeLinecap="round">
            <circle r="3" cx="6.5" cy="16" strokeDasharray="14.137 64.4"
              style={{ animation: 'worm1-move 1.5s cubic-bezier(0.37,0,0.63,1) infinite' }} />
            <circle r="9.5" cx="19" cy="16" strokeDasharray="14.137 64.4" strokeDashoffset="14.137"
              transform="rotate(180,19,16)"
              style={{ animation: 'worm2-move 1.5s cubic-bezier(0.37,0,0.63,1) infinite' }} />
          </g>
        </g>
        <style>{`
          @keyframes worm1-move { from { stroke-dashoffset: -2.355; } to { stroke-dashoffset: 76.185; } }
          @keyframes worm2-move { from { stroke-dashoffset: 16.492; } to { stroke-dashoffset: -62.045; } }
        `}</style>
      </svg>
    </div>
  )
}
