
import { useEffect, useState, useCallback } from "react";

// hook return value shape
interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void; // refetch function
}

const useApi = <T,>(apiFunction: () => Promise<T>): UseApiReturn<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // start loading
  const [error, setError] = useState<string | null>(null);

  // memoize fetchData for stable identity
  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFunction()
      .then((response) => {
        setData(response);
      })
      .catch((err) => {
        setError(err.message || "An unknown error occurred");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiFunction]);

  // initial fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // return state and refetch function
  return { data, loading, error, refetch: fetchData };
};

export default useApi;