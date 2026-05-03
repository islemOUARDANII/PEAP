export const CustomValueLabel = (props) => {
  const { x, y, width, value, color } = props;
  return (
    <text
      x={x + width / 2}
      y={y}
      dy={-10}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={12}
      fontWeight={'600'}
      fill={color}
    >
      {value}
    </text>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground">
          Offer Id : {label}
        </p>
        <p className="text-xs text-primary">
          {'● '}Matches:{' '}
          <span className="font-semibold text-primary">{payload[0].value}</span>
        </p>
        <p className="text-xs text-accent">
          {'● '}Application:{' '}
          <span className="font-semibold text-accent">{payload[1].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const CustomNameLabel = (props) => {
  const { x, y, width, value } = props;
  return (
    <text
      x={x + width / 2}
      y={y}
      dy={-15}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={12}
      fill="#222222ff"
    >
      {value}
    </text>
  );
};
