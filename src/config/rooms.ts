import type { Room, RoomType } from '../types/index.js';

const DEFAULT_ROOMS: Room[] = [
  {
    id: 'c_1883tdik22bnahe1mnbf53niep1to@resource.calendar.google.com',
    name: 'L1',
    capacity: 12,
    type: 'meeting',
  },
  {
    id: 'c_188di61j3rvr8jtrhg894c2vt3qko@resource.calendar.google.com',
    name: 'L2',
    capacity: 16,
    type: 'meeting',
  },
  {
    id: 'c_1880qmv921dvgi6hmc85mb55ospkc@resource.calendar.google.com',
    name: 'M1',
    capacity: 5,
    type: 'meeting',
  },
  {
    id: 'c_1889vss41qg9uhg8g87jafob0gh4m@resource.calendar.google.com',
    name: 'M2',
    capacity: 5,
    type: 'meeting',
  },
  {
    id: 'c_1888kjr830138h6cjit5a9c5qdph0@resource.calendar.google.com',
    name: 'Focus 3',
    capacity: 1,
    type: 'focus',
  },
  {
    id: 'c_188bo3q7b3a0ugfml101uo54v34ru@resource.calendar.google.com',
    name: 'Focus 4',
    capacity: 1,
    type: 'focus',
  },
  {
    id: 'c_1884kiuvauqv6j7en9de4f9gdoeqi@resource.calendar.google.com',
    name: 'Focus 5',
    capacity: 1,
    type: 'focus',
  },
  {
    id: 'c_188e6vgnvhpl6jpgina2gtpnkjuru@resource.calendar.google.com',
    name: 'Focus 6',
    capacity: 1,
    type: 'focus',
  },
  {
    id: 'c_1881umbrkhoaohodm37q2d8fmpgjg@resource.calendar.google.com',
    name: 'Focus 7',
    capacity: 1,
    type: 'focus',
  },
  {
    id: 'c_188avl7ro1to4jvhkoufq0is4dv1m@resource.calendar.google.com',
    name: 'Focus 8',
    capacity: 1,
    type: 'focus',
  },
  {
    id: 'c_1888oiugtfu74j1onp9pbq36ba10c@resource.calendar.google.com',
    name: 'Focus 9',
    capacity: 1,
    type: 'focus',
  },
];

function loadRooms(): Room[] {
  const config = process.env['ROOMS_CONFIG'];
  if (!config) return DEFAULT_ROOMS;

  try {
    const parsed = JSON.parse(config) as unknown;
    if (!Array.isArray(parsed)) {
      console.warn('⚠️ ROOMS_CONFIG가 배열 형식이 아닙니다. 기본 미팅룸 목록을 사용합니다.');
      return DEFAULT_ROOMS;
    }
    return parsed as Room[];
  } catch {
    console.warn('⚠️ ROOMS_CONFIG JSON 파싱 실패. 기본 미팅룸 목록을 사용합니다.');
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
