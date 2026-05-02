import { useEffect, useState } from "react";

export type DemoCvUploadStage = "selected" | "uploading" | "extracting" | "structuring" | "done";

export interface DemoCvUploadStep {
  stage: DemoCvUploadStage;
  label: string;
  progress: number;
  atMs: number;
  detail: string;
}

export interface DemoCvUploadSession {
  fileName: string;
  fileSize: number;
  startedAt: number;
  stage: DemoCvUploadStage;
  progress: number;
}

interface DemoCvUploadSessionBase {
  fileName: string;
  fileSize: number;
  startedAt: number;
}

const demoCvUploadStorageKey = "matchcore.demo.candidate-cv-session";
const demoCvUploadEventName = "matchcore:demo-candidate-cv-session-changed";

export const demoCvUploadSteps: DemoCvUploadStep[] = [
  {
    stage: "selected",
    label: "File selected",
    progress: 0,
    atMs: 0,
    detail: "Your document is ready for processing.",
  },
  {
    stage: "uploading",
    label: "Uploading CV...",
    progress: 25,
    atMs: 700,
    detail: "Uploading your CV.",
  },
  {
    stage: "extracting",
    label: "Extracting information...",
    progress: 55,
    atMs: 1800,
    detail: "Extracting personal information, experience, and skills.",
  },
  {
    stage: "structuring",
    label: "Structuring profile...",
    progress: 80,
    atMs: 3000,
    detail: "Preparing your profile.",
  },
  {
    stage: "done",
    label: "Done",
    progress: 100,
    atMs: 4300,
    detail: "Your profile is ready.",
  },
];

let scheduledTimers: number[] = [];
let activeStartedAt: number | null = null;

const isBrowser = () => typeof window !== "undefined";

const emitDemoCvSessionChanged = () => {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new Event(demoCvUploadEventName));
};

const clearScheduledTimers = () => {
  if (!isBrowser()) {
    return;
  }

  scheduledTimers.forEach((timerId) => window.clearTimeout(timerId));
  scheduledTimers = [];
};

const toSessionBase = (value: Partial<DemoCvUploadSession> | null): DemoCvUploadSessionBase | null => {
  if (!value?.fileName || typeof value.startedAt !== "number") {
    return null;
  }

  return {
    fileName: String(value.fileName),
    fileSize: typeof value.fileSize === "number" ? value.fileSize : 0,
    startedAt: value.startedAt,
  };
};

const deriveDemoCvSession = (base: DemoCvUploadSessionBase): DemoCvUploadSession => {
  const elapsed = Math.max(0, Date.now() - base.startedAt);
  let currentStep = demoCvUploadSteps[0];

  demoCvUploadSteps.forEach((step) => {
    if (elapsed >= step.atMs) {
      currentStep = step;
    }
  });

  return {
    ...base,
    stage: currentStep.stage,
    progress: currentStep.progress,
  };
};

const persistDemoCvSession = (session: DemoCvUploadSession | null, emitChange = true) => {
  if (!isBrowser()) {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(demoCvUploadStorageKey);
  } else {
    window.localStorage.setItem(demoCvUploadStorageKey, JSON.stringify(session));
  }

  if (emitChange) {
    emitDemoCvSessionChanged();
  }
};

const scheduleDemoCvProgress = (base: DemoCvUploadSessionBase) => {
  if (!isBrowser()) {
    return;
  }

  clearScheduledTimers();
  activeStartedAt = base.startedAt;

  demoCvUploadSteps.forEach((step) => {
    const remainingMs = base.startedAt + step.atMs - Date.now();
    if (remainingMs <= 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      if (activeStartedAt !== base.startedAt) {
        return;
      }

      const nextSession = deriveDemoCvSession(base);
      persistDemoCvSession(nextSession);

      if (nextSession.stage === "done") {
        clearScheduledTimers();
      }
    }, remainingMs);

    scheduledTimers.push(timerId);
  });
};

export const getDemoCvUploadStep = (stage?: DemoCvUploadStage | null): DemoCvUploadStep => {
  if (!stage) {
    return demoCvUploadSteps[0];
  }

  return demoCvUploadSteps.find((step) => step.stage === stage) ?? demoCvUploadSteps[0];
};

export const isDemoCvUploadBusy = (session: DemoCvUploadSession | null): boolean =>
  Boolean(session && session.stage !== "done");

export const readDemoCvUploadSession = (): DemoCvUploadSession | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(demoCvUploadStorageKey);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<DemoCvUploadSession>;
    const sessionBase = toSessionBase(parsedValue);
    if (!sessionBase) {
      window.localStorage.removeItem(demoCvUploadStorageKey);
      return null;
    }

    const derivedSession = deriveDemoCvSession(sessionBase);
    const parsedStage = typeof parsedValue.stage === "string" ? parsedValue.stage : null;
    const parsedProgress = typeof parsedValue.progress === "number" ? parsedValue.progress : null;

    if (parsedStage !== derivedSession.stage || parsedProgress !== derivedSession.progress) {
      persistDemoCvSession(derivedSession, false);
    }

    return derivedSession;
  } catch {
    window.localStorage.removeItem(demoCvUploadStorageKey);
    return null;
  }
};

export const ensureDemoCvUploadProgress = () => {
  const currentSession = readDemoCvUploadSession();
  if (!currentSession || currentSession.stage === "done") {
    return;
  }

  scheduleDemoCvProgress({
    fileName: currentSession.fileName,
    fileSize: currentSession.fileSize,
    startedAt: currentSession.startedAt,
  });
};

export const startDemoCvUpload = (file: File): DemoCvUploadSession | null => {
  if (!isBrowser()) {
    return null;
  }

  const sessionBase: DemoCvUploadSessionBase = {
    fileName: file.name,
    fileSize: file.size,
    startedAt: Date.now(),
  };

  const initialSession = deriveDemoCvSession(sessionBase);
  persistDemoCvSession(initialSession);
  scheduleDemoCvProgress(sessionBase);

  return initialSession;
};

export const clearDemoCvUploadSession = () => {
  activeStartedAt = null;
  clearScheduledTimers();
  persistDemoCvSession(null);
};

export const formatDemoCvFileSize = (fileSize: number): string => {
  if (fileSize >= 1024 * 1024) {
    return `${(fileSize / 1024 / 1024).toFixed(2)} MB`;
  }

  if (fileSize >= 1024) {
    return `${(fileSize / 1024).toFixed(0)} KB`;
  }

  return `${fileSize} B`;
};

export const useDemoCvUploadSession = () => {
  const [session, setSession] = useState<DemoCvUploadSession | null>(() => readDemoCvUploadSession());

  useEffect(() => {
    if (!isBrowser()) {
      return undefined;
    }

    ensureDemoCvUploadProgress();

    const syncSession = () => {
      setSession(readDemoCvUploadSession());
    };

    syncSession();
    window.addEventListener(demoCvUploadEventName, syncSession);
    window.addEventListener("storage", syncSession);

    return () => {
      window.removeEventListener(demoCvUploadEventName, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  return session;
};
