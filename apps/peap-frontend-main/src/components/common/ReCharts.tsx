export const CustomValueLabel = (props) => {
  const { x, y, width, height, value } = props;
  return (
    <text
      x={x + width}
      y={y + height / 2}
      dx={-25}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={14}
      fill="#fff"
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
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">
          Count:{' '}
          <span className="font-semibold text-foreground">
            {payload[0].value}
          </span>
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
