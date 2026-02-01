import { GameRoom } from '../rooms/GameRoom';

export function makeTestRoom() {
  const room = new GameRoom();
  room.setPatchRate(0);
  room.autoDispose = false;
  return room;
}
