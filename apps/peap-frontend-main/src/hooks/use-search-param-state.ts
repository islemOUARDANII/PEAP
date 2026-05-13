import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";

export function useSearchParamState(paramName = "q"): [string, Dispatch<SetStateAction<string>>] {
  const [searchParams] = useSearchParams();
  const paramValue = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(paramValue);

  useEffect(() => {
    setValue(paramValue);
  }, [paramValue]);

  return [value, setValue];
}
