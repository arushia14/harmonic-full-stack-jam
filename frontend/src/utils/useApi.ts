// frontend/src/utils/useApi.ts

import { useEffect, useState, useCallback } from "react";

// Define the shape of the return value from the hook
interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void; // Add a refetch function
}

const useApi = <T,>(apiFunction: () => Promise<T>): UseApiReturn<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);

  // Memoize the fetchData function so it has a stable identity
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

  // Initial fetch when the component mounts
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Return the state and the refetch function
  return { data, loading, error, refetch: fetchData };
};

export default useApi;