/**
 * SplitPane — 递归分栏容器
 */
import React, { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../store';
import { resizePanel } from '../../store/slices/panelLayoutSlice';
import type { SplitPanel as SplitPanelType, PanelNode } from './types';
import { renderPanelNode } from './PanelGrid';

interface Props {
  node: SplitPanelType;
  path: string;
  editorChildren?: React.ReactNode;
  getDocContent?: () => string;
}

const MIN_PCT = 12;

const SplitPane: React.FC<Props> = ({ node, path, editorChildren, getDocContent }) => {
  const dispatch = useDispatch<AppDispatch>();
  const ref = useRef<HTMLDivElement>(null);
  const dc = node.direction === 'horizontal' ? 'pn-split--horizontal' : 'pn-split--vertical';

  const onDividerDown = useCallback((idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const horz = node.direction === 'horizontal';
    const start = horz ? e.clientX : e.clientY;
    const total = horz ? r.width : r.height;
    const startSizes = [...node.sizes];

    const onMove = (ev: MouseEvent) => {
      const pos = horz ? ev.clientX : ev.clientY;
      const dp = ((pos - start) / total) * 100;

      // Apply delta to left/top panel
      const ns = [...startSizes];
      ns[idx] = Math.max(MIN_PCT, startSizes[idx] + dp);
      // Right/bottom panel gets the remainder
      const delta = ns[idx] - startSizes[idx];
      ns[idx + 1] = Math.max(MIN_PCT, startSizes[idx + 1] - delta);

      dispatch(resizePanel({ splitId: node.id, sizes: ns }));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dispatch, node.id, node.direction, node.sizes]);

  return (
    <div className={'pn-split ' + dc} ref={ref} data-split-id={node.id}>
      {node.children.map((c: PanelNode, i: number) => (
        <React.Fragment key={c.id}>
          <div
            className="pn-split__child"
            style={{
              flexBasis: `${node.sizes[i] ?? 100 / node.children.length}%`,
              flexGrow: 0,
              flexShrink: 0,
            }}
          >
            {renderPanelNode(c, `${path}/${i}`, editorChildren, getDocContent)}
          </div>
          {i < node.children.length - 1 && (
            <div
              className={'pn-divider pn-divider--' + node.direction}
              onMouseDown={(e) => onDividerDown(i, e)}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default React.memo(SplitPane);
