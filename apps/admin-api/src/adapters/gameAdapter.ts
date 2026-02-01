import { BanRequest, MuteRequest, NotesRequest, FlagsRequest, RoomActionRequest, MatchActionRequest } from '@htown/admin-shared';
import { PlayerRow } from '../db/repos/players';
import { RoomRow } from '../db/repos/rooms';
import { MatchRow } from '../db/repos/matches';

export type ListResult<T> = { rows: T[]; total: number };

export interface GameAdapter {
  listPlayers(params: { q?: string; limit: number; offset: number }): Promise<ListResult<PlayerRow>>;
  getPlayer(id: string): Promise<PlayerRow | undefined>;
  banPlayer(id: string, input: BanRequest): Promise<void>;
  mutePlayer(id: string, input: MuteRequest): Promise<void>;
  updatePlayerNotes(id: string, input: NotesRequest): Promise<void>;
  updatePlayerFlags(id: string, input: FlagsRequest): Promise<void>;

  listRooms(params: { q?: string; limit: number; offset: number }): Promise<ListResult<RoomRow>>;
  getRoom(id: string): Promise<RoomRow | undefined>;
  actOnRoom(id: string, input: RoomActionRequest): Promise<void>;

  listMatches(params: { q?: string; limit: number; offset: number }): Promise<ListResult<MatchRow>>;
  getMatch(id: string): Promise<MatchRow | undefined>;
  actOnMatch(id: string, input: MatchActionRequest): Promise<void>;
}
