import type { TruthAsset, TruthSearchFilter } from '@/types';

export const phaseLabels = { control: '对照阶段', dosing: '给药', withdrawal: '停药', unknown: '未记录' };
export const sexLabels = { female: '雌性', male: '雄性', unknown: '未记录' };
export const captureLabels = { before: '实验前', after: '实验后', unknown: '未记录' };
export const imageLabels = { thermal: '热成像', visible: '可见光', unknown: '未记录' };
export const filterLabels: Record<keyof TruthSearchFilter, string> = { drugName: '药物', batchCode: '实验批次', animalId: '动物编号', species: '物种', strain: '品系', sex: '性别', phase: '阶段', timeValue: '时间值', timeUnit: '时间单位', bodyPart: '部位', groupName: '实验分组', captureStage: '实验前后', imageType: '图片类型' };
export function timeLabel(asset: Pick<TruthAsset, 'timeValue' | 'timeUnit'>) { return asset.timeValue == null ? '时间未记录' : `${asset.timeValue} ${asset.timeUnit === 'hour' ? '小时' : asset.timeUnit === 'day' ? '天' : '（单位未记录）'}`; }
export function conditionLabel(key: string, value: string | number): string {
  if (key === 'phase') return phaseLabels[value as keyof typeof phaseLabels] || String(value);
  if (key === 'sex') return sexLabels[value as keyof typeof sexLabels] || String(value);
  if (key === 'captureStage') return captureLabels[value as keyof typeof captureLabels] || String(value);
  if (key === 'imageType') return imageLabels[value as keyof typeof imageLabels] || String(value);
  if (key === 'timeUnit') return value === 'hour' ? '小时' : '天';
  return String(value);
}
