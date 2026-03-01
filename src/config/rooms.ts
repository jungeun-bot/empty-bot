import type { Room, RoomType } from '../types/index.js';

const DEFAULT_ROOMS: Room[] = [
  {
    id: 'meeting-room-1@resource.calendar.google.com',
    name: 'Meeting Room 1',
    capacity: 8,
    type: 'meeting',
  },
  {
    id: 'meeting-room-2@resource.calendar.google.com',
    name: 'Meeting Room 2',
    capacity: 8,
    type: 'meeting',
  },
  {
    id: 'meeting-room-3@resource.calendar.google.com',
    name: 'Meeting Room 3',
    capacity: 5,
    type: 'meeting',
  },
  {
    id: 'meeting-room-7@resource.calendar.google.com',
    name: 'Meeting Room 7',
    capacity: 5,
    type: 'meeting',
  },
  {
    id: 'focusing-room-4@resource.calendar.google.com',
    name: 'Focusing Room 4',
    capacity: 1,
    type: 'focusing',
  },
  {
    id: 'focusing-room-5@resource.calendar.google.com',
    name: 'Focusing Room 5',
    capacity: 1,
    type: 'focusing',
  },
  {
    id: 'focusing-room-6@resource.calendar.google.com',
    name: 'Focusing Room 6',
    capacity: 1,
    type: 'focusing',
  },
  {
    id: 'focusing-room-7@resource.calendar.google.com',
    name: 'Focusing Room 7',
    capacity: 1,
    type: 'focusing',
  },
  {
    id: 'focusing-room-8@resource.calendar.google.com',
    name: 'Focusing Room 8',
    capacity: 1,
    type: 'focusing',
  },
  {
    id: 'focusing-room-9@resource.calendar.google.com',
    name: 'Focusing Room 9',
    capacity: 1,
    type: 'focusing',
  },
];

function loadRooms(): Room[] {
  const config = process.env['ROOMS_CONFIG'];
  if (!config) return DEFAULT_ROOMS;

  try {
    const parsed = JSON.parse(config) as unknown;
    if (!Array.isArray(parsed)) {
      console.warn('⚠️ ROOMS_CONFIG가 배열 형식이 아닙니다. 기본 회의실 목록을 사용합니다.');
      return DEFAULT_ROOMS;
    }
    return parsed as Room[];
  } catch {
    console.warn('⚠️ ROOMS_CONFIG JSON 파싱 실패. 기본 회의실 목록을 사용합니다.');
    return DEFAULT_ROOMS;
  }
}

export const ROOMS: Room[] = loadRooms();

export function getRoomById(id: string): Room | undefined {
  return ROOMS.find((room) => room.id === id);
}

export function getRoomsByMinCapacity(minCapacity: number, type?: RoomType): Room[] {
  return ROOMS.filter((room) => room.capacity >= minCapacity && (!type || room.type === type));
}

export function getRoomsByType(type: RoomType): Room[] {
  return ROOMS.filter((room) => room.type === type);
}
