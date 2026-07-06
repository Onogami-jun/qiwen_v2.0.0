/** FloatingLayer — 渲染所有浮动窗口，按 zIndex 排序 */
import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import type { FloatingPanelState } from '../../store/slices/panelLayoutSlice';
import FloatingPanel from './FloatingPanel';

interface Props { editorChildren?: React.ReactNode; getDocContent?: () => string; }

const FloatingLayer: React.FC<Props> = ({ editorChildren, getDocContent }) => {
  const panels = (useSelector((s: RootState) => (s as any).panelLayout?.floatingPanels) as FloatingPanelState[] | undefined) || [];
  if (!panels.length) return null;
  return <>{[...panels].sort((a, b) => a.zIndex - b.zIndex).map(fp => <FloatingPanel key={fp.id} fp={fp} editorChildren={editorChildren} getDocContent={getDocContent} />)}</>;
};

export default React.memo(FloatingLayer);
