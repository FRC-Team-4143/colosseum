import { apiGet, apiSend } from "./http";
import type { MatchPacket } from "$lib/native/types";

export interface BoardRecord {
  id: string;
  packet: MatchPacket;
  updatedAt: string;
}

export const listBoards = (): Promise<{ boards: BoardRecord[] }> => apiGet("/api/whiteboards");

export const getBoard = (id: string): Promise<BoardRecord> =>
  apiGet(`/api/whiteboards/${encodeURIComponent(id)}`);

export const createBoard = (packet: MatchPacket): Promise<BoardRecord> =>
  apiSend("POST", "/api/whiteboards", { packet });

export const updateBoard = (
  id: string,
  packet: MatchPacket,
  expectedUpdatedAt?: string,
): Promise<BoardRecord> =>
  apiSend("PUT", `/api/whiteboards/${encodeURIComponent(id)}`, { packet, expectedUpdatedAt });

export const deleteBoard = (id: string): Promise<void> =>
  apiSend("DELETE", `/api/whiteboards/${encodeURIComponent(id)}`);

export const clearBoards = (): Promise<void> => apiSend("DELETE", "/api/whiteboards");
