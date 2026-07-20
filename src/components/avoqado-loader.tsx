import { useId, type SVGProps } from 'react'
import { cn } from '@/lib/utils'

const GREEN_PATH = `M3955 7773 c-191 -10 -668 -83 -870 -132 -664 -164 -1341 -588 -1748
-1096 -394 -492 -612 -1055 -668 -1730 -16 -190 -6 -566 20 -761 81 -601 278
-1135 596 -1614 181 -272 364 -482 580 -664 240 -204 387 -301 640 -426 321
-158 635 -247 990 -280 143 -13 947 -13 1090 0 166 16 289 38 405 75 183 58
226 56 292 -13 19 -20 114 -152 211 -292 192 -279 249 -348 363 -439 156 -126
278 -164 524 -165 185 -1 215 5 308 62 171 103 294 228 367 373 53 107 70 196
62 329 -7 119 -34 216 -98 349 -58 122 -108 194 -218 316 -140 154 -211 277
-211 367 0 47 24 91 109 197 351 442 566 971 627 1551 19 188 15 558 -10 748
-125 956 -596 1868 -1266 2456 -536 471 -1137 734 -1794 786 -124 10 -168 10
-301 3z m103 -1534 c399 -43 787 -196 1122 -442 120 -88 337 -305 417 -417
260 -366 351 -758 268 -1165 -79 -390 -224 -816 -360 -1055 -215 -380 -423
-526 -850 -598 -238 -41 -984 -79 -1195 -62 -389 31 -671 149 -895 375 -245
245 -385 584 -426 1029 -28 302 12 842 82 1118 138 544 506 946 1031 1127 259
89 536 120 806 90z`

const SEED_PATH = `M3882 5326 c-239 -46 -438 -152 -611 -327 -212 -214 -324 -475 -323
-759 0 -283 99 -473 354 -686 174 -145 264 -183 574 -241 180 -34 215 -37 369
-37 146 -1 182 3 254 22 256 69 409 219 481 472 31 108 38 328 16 473 -58 367
-210 696 -409 883 -98 92 -185 142 -312 179 -112 33 -283 42 -393 21z`

const GROWTH_PATH = `M 595 641 L 570 608 C 544 578 533 552 548 533 C 602 475 633 400
611 314 C 586 219 509 158 395 163 C 283 167 198 255 186 367 C 175 455 222 519
298 527 C 359 533 394 483 403 430`

export type AvoqadoLoaderProps = Omit<SVGProps<SVGSVGElement>, 'children'>

/**
 * Brand loader whose green silhouette grows from the rounded tail and closes
 * around the terracotta seed. The exact logo paths come from public/favicon.svg.
 */
export function AvoqadoLoader({ className, ...props }: AvoqadoLoaderProps) {
  const instanceId = useId().replace(/:/g, '')
  const maskId = `avoqado-loader-growth-${instanceId}`

  return (
    <svg
      viewBox="0 0 800 800"
      className={cn('avoqado-loader', className)}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <defs>
        <mask id={maskId} x="0" y="0" width="800" height="800" maskUnits="userSpaceOnUse">
          <rect width="800" height="800" fill="black" />
          <path
            className="avoqado-loader__growth-path"
            d={GROWTH_PATH}
            fill="none"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={194}
          />
        </mask>
      </defs>

      <g className="avoqado-loader__mark">
        <g className="avoqado-loader__seed">
          <g transform="translate(0 800) scale(.1 -.1)">
            <path d={SEED_PATH} fill="var(--avoqado-loader-seed, #d97452)" />
          </g>
        </g>

        <g className="avoqado-loader__green-traced" mask={`url(#${maskId})`}>
          <g transform="translate(0 800) scale(.1 -.1)">
            <path d={GREEN_PATH} fill="var(--avoqado-loader-green, #7add2c)" />
          </g>
        </g>

        <g className="avoqado-loader__green-complete">
          <g transform="translate(0 800) scale(.1 -.1)">
            <path d={GREEN_PATH} fill="var(--avoqado-loader-green, #7add2c)" />
          </g>
        </g>
      </g>
    </svg>
  )
}
