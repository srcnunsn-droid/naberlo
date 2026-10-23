import { useId } from 'react';

export function Stadium({
  seed = 0,
  large = false,
  color = '#27866a',
  empty = false,
}: {
  seed?: number;
  large?: boolean;
  color?: string;
  empty?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const style = seed % 5;
  const ribs = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return {
      x: 400 + 245 * Math.cos(a),
      y: 235 + 112 * Math.sin(a),
      ix: 400 + 157 * Math.cos(a),
      iy: 227 + 64 * Math.sin(a),
      angle: a,
    };
  });
  return (
    <svg
      viewBox="0 0 800 490"
      className={`stadium-art ${large ? 'large' : ''}`}
      role="img"
      aria-label={
        empty
          ? 'Boş arazi şeması'
          : 'Kavramsal stadyum şeması; fotoğraf veya üretilmiş görsel değildir'
      }
    >
      <defs>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#c0ccd4" />
          <stop offset="1" stopColor="#7b929d" />
        </linearGradient>
        <linearGradient id={`${id}-roof`} x1="0" y1="0" x2="0.8" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset=".35" stopColor="#dae5e9" />
          <stop offset="1" stopColor="#a5bbc4" />
        </linearGradient>
        <linearGradient id={`${id}-pitch`}>
          <stop stopColor="#476c3e" />
          <stop offset="1" stopColor="#294a31" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor={color} stopOpacity=".12" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <pattern
          id={`${id}-grid`}
          width="50"
          height="28"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-15)"
        >
          <path d="M50 0H0V28" fill="none" stroke="#4f7c68" strokeOpacity=".10" />
        </pattern>
      </defs>
      <rect width="800" height="490" fill={`url(#${id}-grid)`} />
      <ellipse cx="430" cy="270" rx="370" ry="230" fill={`url(#${id}-glow)`} />
      <g
        transform={
          large ? 'translate(-10 0) rotate(-7 400 250)' : 'translate(0 12) rotate(-7 400 250)'
        }
      >
        <path
          d="M55 286L353 102 739 272 437 451Z"
          fill="#e1e9e7"
          stroke="#bacac4"
          strokeWidth="1"
        />
        <path
          d="M30 330L407 112M180 408L612 158M95 200L625 439M192 129L745 363"
          stroke="#9eafa9"
          strokeOpacity=".35"
          strokeWidth="8"
        />
        {Array.from({ length: 18 }, (_, i) => {
          const x = 95 + (i % 6) * 107,
            y = 122 + Math.floor(i / 6) * 120;
          return (
            <path
              key={i}
              d={`M${x} ${y}l30 -16 32 14 -30 17Z m0 0v13l32 15 30 -17v-14`}
              fill="#d0dcdb"
              stroke="#a5b7b3"
              strokeWidth=".6"
            />
          );
        })}
        <ellipse cx="412" cy="315" rx="263" ry="114" fill="#75948a" opacity=".18" />
        {empty ? (
          <>
            <ellipse
              cx="400"
              cy="272"
              rx="247"
              ry="114"
              fill="#61513c"
              stroke="#a99c70"
              strokeWidth="4"
            />
            <ellipse cx="400" cy="281" rx="234" ry="96" fill="#3e3729" />
            <path d="M170 279Q400 445 633 279" fill="none" stroke="#877354" strokeWidth="15" />
          </>
        ) : (
          <>
            <path
              d="M155 231 C155 382 645 382 645 231 L645 282 C645 438 155 438 155 282Z"
              fill={`url(#${id}-wall)`}
              stroke="#738172"
            />
            {[0, 1, 2].map((i) => (
              <path
                key={i}
                d={`M155 ${246 + i * 17}C155 ${397 + i * 17} 645 ${397 + i * 17} 645 ${246 + i * 17}`}
                fill="none"
                stroke={i === 1 ? color : '#80937c'}
                strokeOpacity={i === 1 ? 0.65 : 0.35}
                strokeWidth={i === 1 ? 3 : 1}
              />
            ))}
            {ribs
              .filter((r) => r.angle < Math.PI)
              .map((r, i) => (
                <path
                  key={i}
                  d={`M${r.x} ${r.y}L${r.x + Math.sin(i) * 3} ${r.y + 57}`}
                  stroke={i % 4 === 0 ? color : '#748371'}
                  strokeOpacity=".55"
                  strokeWidth={style === 2 ? 5 : 2}
                />
              ))}
            <ellipse
              cx="400"
              cy="235"
              rx="246"
              ry="112"
              fill="#456358"
              stroke="#a8ba9a"
              strokeWidth="2"
            />
            {[0, 1, 2, 3, 4].map((i) => (
              <ellipse
                key={i}
                cx="400"
                cy={235 + i * 3}
                rx={193 - i * 10}
                ry={82 - i * 6}
                fill="none"
                stroke={i % 2 ? color : '#69845f'}
                strokeOpacity=".55"
                strokeWidth="4"
              />
            ))}
            <path
              d="M274 234L406 186 530 241 395 299Z"
              fill={`url(#${id}-pitch)`}
              stroke="#d2dec5"
              strokeOpacity=".65"
              strokeWidth="1.3"
            />
            <path
              d="M340 210L463 268M292 228L327 244 307 251M507 233L475 246 494 255"
              fill="none"
              stroke="#d4e1ca"
              strokeOpacity=".65"
            />
            <ellipse
              cx="402"
              cy="243"
              rx="23"
              ry="10"
              transform="rotate(3 402 243)"
              fill="none"
              stroke="#d4e1ca"
              strokeOpacity=".65"
            />
            <path
              d="M155 235A245 112 0 1 1 645 235A245 112 0 1 1 155 235ZM242 228A158 65 0 1 0 558 228A158 65 0 1 0 242 228Z"
              fill={`url(#${id}-roof)`}
              fillRule="evenodd"
              stroke="#b5c1a8"
              strokeWidth="1.3"
            />
            {ribs.map((r, i) => (
              <path
                key={i}
                d={
                  style === 1
                    ? `M${r.x} ${r.y}L${r.ix + 15} ${r.iy - 18}L${r.ix} ${r.iy}`
                    : `M${r.x} ${r.y}Q${(r.x + r.ix) / 2} ${(r.y + r.iy) / 2 - (style === 3 ? 25 : 7)} ${r.ix} ${r.iy}`
                }
                fill="none"
                stroke={i % 6 === 0 ? color : '#c5d4b7'}
                strokeOpacity={i % 3 === 0 ? 0.8 : 0.3}
                strokeWidth={style === 4 ? 3 : 1.2}
              />
            ))}
            {style === 0 && (
              <path
                d="M174 255Q390 46 626 260M201 273Q420 57 600 278"
                fill="none"
                stroke="#bfd2aa"
                strokeWidth="4"
              />
            )}
            <path
              d="M366 363L366 337 419 337 419 363"
              fill="#708f86"
              stroke={color}
              strokeOpacity=".6"
            />
            <path
              d="M375 363L351 399M410 363L438 399"
              stroke="#a3b48f"
              strokeOpacity=".5"
              strokeWidth="1.5"
            />
          </>
        )}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <g key={i} transform={`translate(${155 + i * 70} ${i % 2 ? 355 : 365})`}>
            <path d="M0 4v12" stroke="#76855d" />
            <ellipse rx="6" ry="10" fill="#526546" />
          </g>
        ))}
      </g>
      {large && (
        <g stroke="#a2b58c" strokeWidth=".8" fill="none" opacity=".5">
          <path d="M99 130H218L260 171M650 373H700V330M163 393H123V360" />
          <circle cx="260" cy="171" r="3" />
          <path d="M661 105h30m-15 -15v30" />
        </g>
      )}
    </svg>
  );
}
