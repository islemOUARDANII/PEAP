import { UseQueryResult } from '@tanstack/react-query';
import React from 'react';

const ErrorCard = ({
  queryResult,
  text,
}: {
  queryResult: UseQueryResult;
  text: string;
}) => {
  return (
    <div className="panel p-6 text-sm text-destructive card-border-destructive flex gap-2 items-center justify-center">
      <p className="text-xs font-medium uppercase text-destructive">
        {queryResult.error instanceof Error ? queryResult.error.message : text}
      </p>
    </div>
  );
};

export default ErrorCard;
