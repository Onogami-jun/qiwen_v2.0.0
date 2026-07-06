/**
 * EditorPanel — 编辑器面板壳
 */
import React from 'react';
import Panel from './Panel';
import type { LeafPanel as LeafPanelType } from './types';

interface Props { node: LeafPanelType; children: React.ReactNode; }

const EditorPanel: React.FC<Props> = ({ node, children }) => <Panel node={node}>{children}</Panel>;

export default React.memo(EditorPanel);
