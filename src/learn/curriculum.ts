import { allDone, LAST_CORNERS } from './goals'
import { lastEdgesDone } from './guide/lastEdgesGuide'
import { getStage, type StageCopy } from './copy/copy'
import { STAGES, type StageDef, type StageId } from './stages'

/** Lesson roadmap. The standalone beginner solver retains its existing stage order. */
export const CURRICULUM_STAGES: readonly StageDef[] = [
  ...STAGES.slice(0, 4),
  { id: 'topEdges', index: 4, prerequisite: 'topCross', isDone: lastEdgesDone },
  { id: 'topCorners', index: 5, prerequisite: 'topEdges', isDone: (s) => lastEdgesDone(s) && LAST_CORNERS.every((i) => s.cp[i] === i) },
  { id: 'topFace', index: 6, prerequisite: 'topCorners', isDone: allDone }
]
const LAST_COPY: Partial<Record<StageId, StageCopy>> = {
  topEdges: { id: 'topEdges', title: 'Đưa cạnh vàng về đúng vị trí', goal: 'Đổi thứ tự bốn cạnh quanh đáy, rồi căn D ở cuối', why: 'Làm cạnh trước, sau đó đặt góc đúng chỗ và lật góc.', check: ['Bốn cạnh vàng khớp tâm các mặt bên', 'Dấu cộng vàng và hai tầng phía trên được giữ'] },
  topCorners: { id: 'topCorners', title: 'Đưa góc vàng về đúng vị trí', goal: 'Đặt mỗi góc vào đúng chỗ theo bộ ba màu, chưa cần vàng hướng xuống', why: 'Góc đúng chỗ trước, đúng hướng sau.', check: ['Bốn góc đúng vị trí theo bộ ba màu', 'Các cạnh vàng vẫn đúng vị trí'] },
  topFace: { id: 'topFace', title: 'Lật các góc vàng', goal: 'Xoay đúng hướng các góc đã ở đúng chỗ để hoàn thành Rubik', why: 'Bước cuối cùng của lộ trình: hoàn thành hướng của các góc.', check: ['Mặt vàng hoàn chỉnh', 'Toàn bộ Rubik đã được giải'] }
}
export const getCurriculumStageCopy = (id: StageId): StageCopy => LAST_COPY[id] ?? getStage(id)
