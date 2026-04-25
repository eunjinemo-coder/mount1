import { Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import type { ReactElement } from 'react';

export interface TechnicianStat {
  name: string;
  count: number;
}

export interface TechnicianBarsProps {
  stats: TechnicianStat[];
  max: number;
}

export function TechnicianBars(props: TechnicianBarsProps): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>기사별 오늘 건수</CardTitle>
      </CardHeader>
      <CardContent>
        {props.stats.length === 0 ? (
          <p className="text-muted-foreground text-sm">오늘 배차된 기사가 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {props.stats.map((stat) => {
              const widthPct = props.max > 0 ? (stat.count / props.max) * 100 : 0;
              return (
                <li key={stat.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{stat.name}</span>
                    <span className="text-muted-foreground tabular-nums">{stat.count}건</span>
                  </div>
                  <div className="bg-muted h-2 w-full overflow-hidden rounded">
                    <div
                      className="bg-primary h-full rounded transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
