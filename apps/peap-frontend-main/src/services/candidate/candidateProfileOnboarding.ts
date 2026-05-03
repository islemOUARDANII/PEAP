import type { QueryClient } from '@tanstack/react-query';

import { ApiServiceError } from '@/services/api/client';
import { isMissingCandidateProfileError } from '@/services/api/errors';
import {
  gatewayApi,
  type CandidateCvParseResult,
  type CandidateCvRecord,
} from '@/services/api/gateway';
import { queryKeys } from '@/services/api/queryKeys';

const JOB_SEEKER_PROFILE_NOT_FOUND_PATTERN =
  /job seeker profile not found/i;

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const collectErrorTexts = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectErrorTexts(item));
  }

  const record = toRecord(value);
  if (!record) {
    return [];
  }

  return Object.entries(record).flatMap(([key, nestedValue]) =>
    ['message', 'detail', 'error'].includes(key.toLowerCase())
      ? collectErrorTexts(nestedValue)
      : [],
  );
};

export const getCandidatePortalErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (error instanceof ApiServiceError) {
    return `${fallback}: ${error.message}`;
  }

  return error instanceof Error ? error.message : fallback;
};

export const isJobSeekerProfileNotFoundError = (error: unknown): boolean => {
  if (isMissingCandidateProfileError(error)) {
    return true;
  }

  if (error instanceof ApiServiceError && error.status === 404) {
    return true;
  }

  const texts = [
    ...(error instanceof Error ? [error.message] : []),
    ...(error instanceof ApiServiceError
      ? collectErrorTexts(error.details)
      : collectErrorTexts(error)),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return texts.some((value) =>
    JOB_SEEKER_PROFILE_NOT_FOUND_PATTERN.test(value),
  );
};

export const shouldRetryCandidateProfileQuery = (
  failureCount: number,
  error: unknown,
): boolean =>
  !isJobSeekerProfileNotFoundError(error) && failureCount < 2;

export const invalidateCandidatePortalQueries = async (
  queryClient: QueryClient,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.candidate.dashboard(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.candidate.profile(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.candidate.profilePresence(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.candidate.keywords(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.candidate.offerThreshold(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.candidate.bundle(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.candidate.cvRecords(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.candidate.matches(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.candidate.jobOffers(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.candidate.recommendations(),
    }),
    queryClient.invalidateQueries({
      queryKey: ['candidate', 'offers'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['search', 'offers'],
    }),
  ]);
};

export const uploadAndParseCandidateCv = async (
  file: File,
  options?: {
    onUploaded?: (record: CandidateCvRecord) => void | Promise<void>;
  },
): Promise<{
  record: CandidateCvRecord;
  parseResult: CandidateCvParseResult;
}> => {
  const record = await gatewayApi.candidate.uploadCv(file);

  if (options?.onUploaded) {
    await options.onUploaded(record);
  }

  const parseResult = await gatewayApi.candidate.parseCv(record.id);

  return {
    record,
    parseResult,
  };
};
