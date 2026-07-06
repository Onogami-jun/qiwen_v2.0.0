/**
 * SplitPane — 递归分栏容器，可拖拽调节尺寸
 */
import React, { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../../store';
import { resizePanel } from '../../../store/slices/panelLayoutSlice';
import type { SplitPanel as SplitPanelType, PanelNode } from './types';
import { renderPanelNode } from './PanelGrid';

interface Props { node: SplitPanelType; containerId: string; editorChildren?: React.ReactNode; getDocContent?: () => string; }

const SplitPane: React.FC<Props> = ({ node, containerId, editorChildren, getDocContent }) => {
  const dispatch = useDispatch<AppDispatch>();
  const containerRef = useRef<HTMLDivElement>(null);
  const dc = node.direction === 'horizontal' ? 'pn-split--horizontal' : 'pn-split--vertical';

  const onDividerDown = useCallback((idx: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const el = containerRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const horiz = node.direction === 'horizontal';
    const start = horiz ? e.clientX : e.clientY;
    const total = horiz ? rect.width : rect.height;
    const startSizes = [...node.sizes];

    const onMove = (ev: MouseEvent) => {
      const delta = ((horiz ? ev.clientX : ev.clientY) - start) / total * 100;
      const ns = [...startSizes];
      ns[idx] = Math.max(10, startSizes[idx] + delta);
      ns[idx + 1] = Math.max(10, startSizes[idx + 1] - delta);
      dispatch(resizePanel({ splitId: node.id, sizes: ns }));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dispatch, node.id, node.direction, node.sizes]);

  return (
    <div className={`pn-split ${dc}`} ref={containerRef} data-container-id={containerId} data-split-id={node.id}>
      {node.children.map((c: PanelNode, i: number) => (
        <React.Fragment key={c.id}>
          <div className="pn-split__child" style={{ flexBasis: `${node.sizes[i] ?? 50}%`, flexGrow: 0, flexShrink: 0 }} data-container-id={`${containerId}/${i}`}>
            {renderPanelNode(c, `${containerId}/${i}`, editorChildren, getDocContent)}
          </div>
          {i < node.children.length - 1 && (
            <div className={`pn-divider pn-divider--${node.direction}`} onMouseDown={(e) => onDividerDown(i, e)} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default React.memo(SplitPane);
