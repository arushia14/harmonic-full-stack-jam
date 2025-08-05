
import "./App.css";
import {
  createTheme,
  ThemeProvider,
  CssBaseline,
  CircularProgress,
  Box,
  Button,
  IconButton,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import CompanyTable from "./components/CompanyTable";
import { getCollectionsMetadata } from "./utils/jam-api";
import useApi from "./utils/useApi";
import { ICollectionMetadata } from "./utils/jam-api";
import { useTask } from "./contexts/TaskContext";
import toast from 'react-hot-toast'; // keeping this import for the toast

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  
  const {
    data: collections,
    loading: collectionsLoading,
    error: collectionsError,
    refetch: refetchCollections,
  } = useApi<ICollectionMetadata[]>(getCollectionsMetadata);

  const { startTransfer, startCollectionDelete, isProcessing, task } = useTask();

  const collectionIds = useMemo(() => {
    if (!collections) return {};
    return {
      myList: collections.find((c) => c.collection_name === "My List")?.id,
      liked: collections.find((c) => c.collection_name === "Liked Companies List")?.id,
    };
  }, [collections]);

  useEffect(() => {
    if (task?.status === 'SUCCESS' || task?.status === 'FAILED') {
      setTimeout(() => refetchCollections(), 500);
    }
  }, [task?.status, refetchCollections]);

  useEffect(() => {
    if (collections && collections.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollectionId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get("collection");
    if (collectionId) setSelectedCollectionId(collectionId);
  }, []);

  const handleSelectCollection = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    window.history.pushState({}, "", `?collection=${collectionId}`);
  };

  const handleBulkTransfer = () => {
    if (collectionIds.myList && collectionIds.liked) {
      startTransfer(collectionIds.myList, collectionIds.liked);
    } else {
      toast.error("Could not find required collections.");
    }
  };

  const handleBulkDelete = (collectionId: string | undefined) => {
    if (collectionId) {
      if (window.confirm("Are you sure you want to remove all companies from this list?")) {
        startCollectionDelete(collectionId);
      }
    } else {
      toast.error("Collection ID not found.");
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="mx-8">
        <div className="font-bold text-xl border-b p-2 mb-4 text-left">
          Harmonic Jam
        </div>
        <div className="flex">
          <div className="w-1/5">
            <p className="font-bold border-b mb-2 pb-2 text-left">
              Collections
            </p>
            <div className="flex flex-col gap-2 text-left">
              {collectionsLoading && <CircularProgress />}
              {collectionsError && <p>Error loading collections.</p>}
              {collections?.map((collection) => (
                <div
                  key={collection.id}
                  className="flex items-center justify-between pr-2"
                >
                  <div
                    className={`py-1 pl-4 hover:cursor-pointer hover:bg-orange-300 flex-grow ${
                      selectedCollectionId === collection.id
                        ? "bg-orange-500 font-bold"
                        : ""
                    }`}
                    onClick={() => handleSelectCollection(collection.id)}
                  >
                    {collection.collection_name}
                  </div>
                  {collection.id === collectionIds.liked && (
                    <IconButton
                      size="small"
                      onClick={() => handleBulkDelete(collectionIds.liked)}
                      disabled={isProcessing}
                      title="Remove all from this list"
                      sx={{ color: '#f44336' }} // red color
                    >
                      {/* inline SVG instead of imported icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </IconButton>
                  )}
                </div>
              ))}
              <Box sx={{ mt: 2, p: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleBulkTransfer}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Processing..." : "Move All from 'My List' to 'Liked'"}
                </Button>
              </Box>
            </div>
          </div>
          <div className="w-4/5 pl-4">
            {selectedCollectionId && collections ? (
              <CompanyTable
                selectedCollectionId={selectedCollectionId}
                collections={collections}
              />
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
              </Box>
            )}
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;