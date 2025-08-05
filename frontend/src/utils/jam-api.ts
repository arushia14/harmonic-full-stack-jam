// frontend/src/utils/jam-api.ts

import axios from "axios";

const BASE_URL = "http://localhost:8000";

// --- Interfaces ---

export interface ICompany {
  id: number;
  company_name: string;
  liked: boolean;
}

export interface ICollection {
  id: string;
  collection_name: string;
  companies: ICompany[];
  total: number;
}

export interface ICollectionMetadata {
  id: string;
  collection_name: string;
}

export interface ICompanyBatchResponse {
  companies: ICompany[];
  total: number;
}

export interface ITaskOut {
  task_id: string;
  status: string;
}

export interface ITaskStatusOut extends ITaskOut {
  progress: number;
  total: number;
  detail: string;
}

// --- API Service Functions ---

// --- Read Operations ---
export async function getCollectionsMetadata(): Promise<ICollectionMetadata[]> {
  try {
    const response = await axios.get(`${BASE_URL}/collections`);
    return response.data;
  } catch (error) {
    console.error("Error fetching collections metadata:", error);
    throw error;
  }
}

export async function getCollectionsById(id: string, offset?: number, limit?: number): Promise<ICollection> {
  try {
    const response = await axios.get(`${BASE_URL}/collections/${id}`, { params: { offset, limit } });
    return response.data;
  } catch (error) {
    console.error(`Error fetching collection by id ${id}:`, error);
    throw error;
  }
}

// --- Write Operations ---

export async function addCompanyToCollection(collectionId: string, companyId: number): Promise<any> {
  try {
    return await axios.post(`${BASE_URL}/collections/${collectionId}/companies`, { company_id: companyId });
  } catch (error) {
    console.error("Error adding company to collection:", error);
    throw error;
  }
}

export async function removeCompanyFromCollection(collectionId: string, companyId: number): Promise<void> {
  try {
    await axios.delete(`${BASE_URL}/collections/${collectionId}/companies/${companyId}`);
  } catch (error) {
    console.error("Error removing company from collection:", error);
    throw error;
  }
}

// --- Bulk Action Triggers (New and Existing) ---

export async function startBulkTransfer(sourceCollectionId: string, destinationCollectionId: string): Promise<ITaskOut> {
  try {
    const response = await axios.post(`${BASE_URL}/actions/transfer-collection`, {
      source_collection_id: sourceCollectionId,
      destination_collection_id: destinationCollectionId,
    });
    return response.data;
  } catch (error) {
    console.error("Error starting bulk transfer:", error);
    throw error;
  }
}

/**
 * NEW: Initiates a task to transfer a selection of companies.
 */
export async function startSelectiveTransfer(companyIds: number[], destinationCollectionId: string): Promise<ITaskOut> {
  try {
    const response = await axios.post(`${BASE_URL}/actions/transfer-selection`, {
      company_ids: companyIds,
      destination_collection_id: destinationCollectionId,
    });
    return response.data;
  } catch (error) {
    console.error("Error starting selective transfer:", error);
    throw error;
  }
}

/**
 * NEW: Initiates a task to delete all companies from a collection.
 */
export async function startBulkDelete(collectionId: string): Promise<ITaskOut> {
  try {
    // For DELETE requests with a body, axios requires the data to be in a `data` field.
    const response = await axios.delete(`${BASE_URL}/actions/collection-contents`, {
      data: { collection_id: collectionId },
    });
    return response.data;
  } catch (error) {
    console.error("Error starting bulk delete:", error);
    throw error;
  }
}

export async function getTaskStatus(taskId: string): Promise<ITaskStatusOut> {
  try {
    const response = await axios.get(`${BASE_URL}/actions/tasks/${taskId}/status`);
    return response.data;
  } catch (error) {
    console.error("Error fetching task status:", error);
    throw error;
  }
}
