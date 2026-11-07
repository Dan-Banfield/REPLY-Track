import type { HexagonView } from '@features/logic/stats/types';

import styles from './Hexagon.module.css';

const RADIUS = 80;
const LABEL_RADIUS = RADIUS + 14;

/** Rings at each rank. `value` is linear in rank, so ranks 2 to 5 sit at 0.25 to 1. */
const RINGS = [0.25, 0.5, 0.75, 1];

/** Keeps a brand-new student's shape visible instead of collapsing to a dot. */
const MIN_VALUE = 0.05;

/** Point on the i-th vertex, clockwise from the top. `value` runs from 0 (centre) to 1 (edge). */
function vertex(index: number, value: number, radius = RADIUS): [number, number] {
  const angle = ((index * 60 - 90) * Math.PI) / 180;
  return [Math.cos(angle) * radius * value, Math.sin(angle) * radius * value];
}

function points(values: number[]): string {
  return values.map((value, index) => vertex(index, value).join(',')).join(' ');
}

function textAnchor(x: number): 'start' | 'middle' | 'end' {
  if (Math.abs(x) < 1) return 'middle';
  return x > 0 ? 'start' : 'end';
}

/** Card with a radar chart of a subject's six stats, and the same numbers listed beside it. */
export function Hexagon({
  hexagon,
  title = 'My progress',
}: {
  hexagon: HexagonView;
  title?: string;
}) {
  const { axes } = hexagon;

  return (
    <section className={styles.card}>
      <div className={styles.heading}>
        <h2 className="md-typescale-title-medium">{title}</h2>
        <p className="md-typescale-body-medium">
          {hexagon.label} · Overall rank {hexagon.overallRank} · {hexagon.totalXp} XP
        </p>
      </div>

      <svg viewBox="-195 -110 390 220" role="img" aria-label={`${hexagon.label} stats chart`}>
        {RINGS.map((ring) => (
          <polygon key={ring} className={styles.ring} points={points(axes.map(() => ring))} />
        ))}
        {axes.map((axis, index) => {
          const [x, y] = vertex(index, 1);
          return <line key={axis.id} className={styles.ring} x1={0} y1={0} x2={x} y2={y} />;
        })}
        <polygon
          className={styles.shape}
          points={points(axes.map((axis) => MIN_VALUE + (1 - MIN_VALUE) * axis.value))}
        />
        {axes.map((axis, index) => {
          const [x, y] = vertex(index, 1, LABEL_RADIUS);
          return (
            <text
              key={axis.id}
              className={styles.axisLabel}
              x={x}
              y={y}
              textAnchor={textAnchor(x)}
              dominantBaseline="middle"
            >
              {axis.label}
            </text>
          );
        })}
      </svg>

      <ul className={styles.statList}>
        {axes.map((axis) => (
          <li key={axis.id} className="md-typescale-body-medium">
            <span>{axis.label}</span>
            <span>
              {axis.rankTitle} · {axis.xp} XP
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
