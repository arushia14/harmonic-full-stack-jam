// frontend/src/components/CompanyTable.tsx

import {
  DataGrid,
  GridColDef,
  GridRowSelectionModel,
  GridToolbarContainer,
} from "@mui/x-data-grid";
import { useEffect, useState } from "react";
import {
  getCollectionsById,
  addCompanyToCollection,
  removeCompanyFromCollection,
  ICompany,
  ICollectionMetadata,
} from "../utils/jam-api";
import { Button, CircularProgress, Box } from "@mui/material";
import { useTask } from "../contexts/TaskContext";

// --- Custom Toolbar for Bulk Actions ---
interface CustomToolbarProps {
  selectedCompanyIds: number[];
  likedCollectionId: string | undefined;
}

function CustomToolbar(props: CustomToolbarProps) {
  const { startSelectionTransfer, isProcessing } = useTask();
  const { selectedCompanyIds, likedCollectionId } = props;

  const handleMoveSelected = () => {
    if (!likedCollectionId) {
      alert("Could not find the 'Liked Companies List'.");
      return;
    }
    if (window.confirm(`Are you sure you want to move ${selectedCompanyIds.length} companies to the Liked list?`)) {
      startSelectionTransfer(selectedCompanyIds, likedCollectionId);
    }
  };

  // Only render the toolbar content if there are selected items
  if (selectedCompanyIds.length === 0) {
    return null;
  }

  return (
    <GridToolbarContainer>
      {/* This Box acts as a flexible spacer to push the button to the right */}
      <Box sx={{ flexGrow: 1 }} />
      <Button
        variant="contained"
        onClick={handleMoveSelected}
        disabled={isProcessing}
        sx={{ m: 1 }} // Add some margin for better spacing
      >
        Move {selectedCompanyIds.length} selected to Liked
      </Button>
    </GridToolbarContainer>
  );
}


// --- Main CompanyTable Component ---
interface CompanyTableProps {
  selectedCollectionId: string;
  collections: ICollectionMetadata[];
}

const CompanyTable = (props: CompanyTableProps) => {
  const [rows, setRows] = useState<ICompany[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [loading, setLoading] = useState<boolean>(false);
  const [rowLoading, setRowLoading] = useState<Record<number, boolean>>({});
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>([]);

  const { isProcessing, task } = useTask();

  const likedCompaniesCollectionId = props.collections.find(
    (c) => c.collection_name === "Liked Companies List"
  )?.id;

  const fetchData = () => {
    if (!props.selectedCollectionId) return;
    setLoading(true);
    getCollectionsById(
      props.selectedCollectionId,
      paginationModel.page * paginationModel.pageSize,
      paginationModel.pageSize
    ).then((newResponse) => {
      setRows(newResponse.companies);
      setTotal(newResponse.total);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, [props.selectedCollectionId, paginationModel, task?.status]);


  const handleLikeCompany = async (companyId: number) => {
    if (!likedCompaniesCollectionId) return;
    setRowLoading((prev) => ({ ...prev, [companyId]: true }));
    try {
      await addCompanyToCollection(likedCompaniesCollectionId, companyId);
      fetchData();
    } catch (error) {
      console.error("Failed to like company", error);
    } finally {
      setRowLoading((prev) => ({ ...prev, [companyId]: false }));
    }
  };

  const handleUnlikeCompany = async (companyId: number) => {
    if (!likedCompaniesCollectionId) return;
    setRowLoading((prev) => ({ ...prev, [companyId]: true }));
    try {
      await removeCompanyFromCollection(likedCompaniesCollectionId, companyId);
      fetchData();
    } catch (error) {
      console.error("Failed to unlike company", error);
    } finally {
      setRowLoading((prev) => ({ ...prev, [companyId]: false }));
    }
  };

  const columns: GridColDef[] = [
    { field: "liked", headerName: "Liked", width: 90, type: "boolean" },
    { field: "id", headerName: "ID", width: 90 },
    { field: "company_name", headerName: "Company Name", width: 200 },
    {
      field: "actions",
      headerName: "Actions",
      width: 150,
      renderCell: (params) => {
        const company = params.row as ICompany;
        const isLoading = rowLoading[company.id];

        if (isLoading) return <CircularProgress size={24} />;

        if (company.liked) {
          return (
            <Button variant="outlined" color="secondary" size="small" onClick={() => handleUnlikeCompany(company.id)} disabled={isProcessing}>
              Unlike
            </Button>
          );
        }
        return (
          <Button variant="outlined" color="primary" size="small" onClick={() => handleLikeCompany(company.id)} disabled={isProcessing}>
            Like
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ height: 650, width: "100%" }}>
      <DataGrid
        rows={rows}
        columns={columns}
        rowCount={total}
        loading={loading}
        pageSizeOptions={[25, 50, 100]}
        paginationModel={paginationModel}
        paginationMode="server"
        onPaginationModelChange={setPaginationModel}
        checkboxSelection
        disableRowSelectionOnClick
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={(newSelectionModel) => setSelectionModel(newSelectionModel)}
        keepNonExistentRowsSelected
        slots={{
          //@ts-ignore
          toolbar: CustomToolbar,
        }}
        slotProps={{
          toolbar: {
            selectedCompanyIds: selectionModel as number[],
            likedCollectionId: likedCompaniesCollectionId,
          },
        }}
      />
    </div>
  );
};

export default CompanyTable;
