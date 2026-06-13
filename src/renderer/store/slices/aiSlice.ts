import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AIMessage } from '../../../shared/types';

interface AIState {
  messages: AIMessage[];
  isThinking: boolean;
  suggestion: string | null;
  contextDocumentId: string | null;
}

const aiSlice = createSlice({
  name: 'ai',
  initialState: {
    messages: [] as AIMessage[],
    isThinking: false,
    suggestion: null as string | null,
    contextDocumentId: null as string | null,
  },
  reducers: {
    addMessage: (state, action: PayloadAction<AIMessage>) => {
      state.messages.push(action.payload);
    },
    clearMessages: (state) => { state.messages = []; },
    setThinking: (state, action: PayloadAction<boolean>) => { state.isThinking = action.payload; },
    setSuggestion: (state, action: PayloadAction<string | null>) => { state.suggestion = action.payload; },
    setContextDocument: (state, action: PayloadAction<string | null>) => {
      state.contextDocumentId = action.payload;
    },
  },
});

export const { addMessage, clearMessages, setThinking, setSuggestion, setContextDocument } = aiSlice.actions;
export default aiSlice.reducer;
