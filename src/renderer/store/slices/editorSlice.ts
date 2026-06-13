import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface EditorState {
  cursorLine: number;
  cursorCol: number;
  selectionLength: number;
  wordCount: number;
  charCount: number;
  readingTime: number;
  completionPercent: number;
  wordGoal: number;
  isFindOpen: boolean;
  findQuery: string;
  replaceQuery: string;
}

const initialState: EditorState = {
  cursorLine: 1,
  cursorCol: 1,
  selectionLength: 0,
  wordCount: 0,
  charCount: 0,
  readingTime: 0,
  completionPercent: 0,
  wordGoal: 5000,
  isFindOpen: false,
  findQuery: '',
  replaceQuery: '',
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    updateCursor: (state, action: PayloadAction<{ line: number; col: number }>) => {
      state.cursorLine = action.payload.line;
      state.cursorCol = action.payload.col;
    },
    updateStats: (state, action: PayloadAction<{ wordCount: number; charCount: number }>) => {
      state.wordCount = action.payload.wordCount;
      state.charCount = action.payload.charCount;
      state.readingTime = Math.ceil(action.payload.wordCount / 300);
      state.completionPercent = Math.min(100, Math.round((action.payload.wordCount / state.wordGoal) * 100));
    },
    setSelection: (state, action: PayloadAction<number>) => {
      state.selectionLength = action.payload;
    },
    setWordGoal: (state, action: PayloadAction<number>) => {
      state.wordGoal = action.payload;
    },
    setFindOpen: (state, action: PayloadAction<boolean>) => {
      state.isFindOpen = action.payload;
    },
    setFindQuery: (state, action: PayloadAction<string>) => {
      state.findQuery = action.payload;
    },
    setReplaceQuery: (state, action: PayloadAction<string>) => {
      state.replaceQuery = action.payload;
    },
  },
});

export const { updateCursor, updateStats, setSelection, setWordGoal, setFindOpen, setFindQuery, setReplaceQuery } = editorSlice.actions;
export default editorSlice.reducer;
