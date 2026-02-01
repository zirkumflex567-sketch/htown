import { GameAdapter } from './gameAdapter';
import {
  listPlayers,
  getPlayer,
  updatePlayerBan,
  updatePlayerMute,
  updatePlayerNotes,
  updatePlayerFlags,
  upsertPlayer
} from '../db/repos/players';
import { listRooms, getRoom, updateRoomStatus, upsertRoom } from '../db/repos/rooms';
import { listMatches, getMatch, updateMatchStatus, upsertMatch } from '../db/repos/matches';
import { BanRequest, MuteRequest, NotesRequest, FlagsRequest, RoomActionRequest, MatchActionRequest } from '@htown/admin-shared';
import { logger } from '../logging/logger';
import { nowIso } from '../utils/time';

export class StubGameAdapter implements GameAdapter {
  async listPlayers(params: { q?: string; limit: number; offset: number }) {
    return listPlayers(params);
  }

  async getPlayer(id: string) {
    return getPlayer(id);
  }

  async banPlayer(id: string, input: BanRequest) {
    await updatePlayerBan(id, input.until);
    logger.log('info', 'Player ban updated', { playerId: id, until: input.until });
  }

  async mutePlayer(id: string, input: MuteRequest) {
    await updatePlayerMute(id, input.until);
    logger.log('info', 'Player mute updated', { playerId: id, until: input.until });
  }

  async updatePlayerNotes(id: string, input: NotesRequest) {
    await updatePlayerNotes(id, input.notes ?? null);
  }

  async updatePlayerFlags(id: string, input: FlagsRequest) {
    await updatePlayerFlags(id, input.flags);
  }

  async listRooms(params: { q?: string; limit: number; offset: number }) {
    return listRooms(params);
  }

  async getRoom(id: string) {
    return getRoom(id);
  }

  async actOnRoom(id: string, input: RoomActionRequest) {
    if (input.action === 'close') {
      await updateRoomStatus(id, 'closed');
      logger.log('warn', 'Room closed', { roomId: id });
    }
    if (input.action === 'kick') {
      logger.log('info', 'Room kick issued', { roomId: id, reason: input.reason ?? '' });
    }
  }

  async listMatches(params: { q?: string; limit: number; offset: number }) {
    return listMatches(params);
  }

  async getMatch(id: string) {
    return getMatch(id);
  }

  async actOnMatch(id: string, input: MatchActionRequest) {
    if (input.action === 'close') {
      await updateMatchStatus(id, 'ended');
      logger.log('warn', 'Match closed', { matchId: id, reason: input.reason ?? '' });
    }
  }
}

export async function seedStubData() {
  const playerCount = 20;
  for (let i = 1; i <= playerCount; i += 1) {
    await upsertPlayer({
      id: `player-${i}`,
      displayName: `Pilot-${i}`,
      createdAt: nowIso()
    });
  }

  for (let i = 1; i <= 6; i += 1) {
    await upsertRoom({
      id: `room-${i}`,
      status: i % 3 === 0 ? 'in-progress' : 'open',
      playerCount: Math.floor(Math.random() * 5) + 1,
      maxPlayers: 5,
      mode: i % 2 === 0 ? 'solo' : 'crew'
    });
  }

  for (let i = 1; i <= 8; i += 1) {
    await upsertMatch({
      id: `match-${i}`,
      roomId: `room-${(i % 6) + 1}`,
      status: i % 4 === 0 ? 'ended' : 'active',
      summary: { wave: 3 + i, kills: 12 + i }
    });
  }
}
