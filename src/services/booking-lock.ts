/**
 * In-process per-room mutex
 * 단일 Node.js 프로세스 내에서 동일 미팅룸에 대한 동시 예약 요청을 직렬화합니다.
 * Promise chaining을 이용한 간단하고 효과적인 구현입니다.
 */

const locks = new Map<string, Promise<void>>();

/**
 * 특정 미팅룸에 대한 작업을 직렬화합니다.
 * 동일 roomId에 대한 동시 호출은 순서대로 실행됩니다.
 */
export async function withRoomLock<T>(
  roomId: string,
  fn: () => Promise<T>,
): Promise<T> {
  // 현재 lock이 없으면 즉시 실행
  const currentLock = locks.get(roomId) ?? Promise.resolve();

  let releaseLock!: () => void;
  const nextLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  // 다음 요청을 위한 lock 등록
  locks.set(roomId, nextLock);

  try {
    // 이전 작업이 완료될 때까지 대기
    await currentLock;
    return await fn();
  } finally {
    // lock 해제
    releaseLock();
    // 이 lock이 현재 등록된 lock과 동일하면 Map에서 제거 (memory leak 방지)
    if (locks.get(roomId) === nextLock) {
      locks.delete(roomId);
    }
  }
}
